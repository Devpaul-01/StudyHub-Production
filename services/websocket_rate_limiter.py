"""
Rate Limiter for WebSocket Events
Prevents spam and abuse with per-user rate limiting
"""

from datetime import datetime, timezone
from typing import Dict, List
import threading


class RateLimiter:
    """
    Thread-safe rate limiter for WebSocket events
    Uses sliding window algorithm
    """
    
    def __init__(self):
        self.limits: Dict[str, List[datetime]] = {}
        self.lock = threading.Lock()
    
    def check_rate_limit(
        self, 
        key: str, 
        limit: int, 
        window: int
    ) -> tuple[bool, int]:
        """
        Check if request is within rate limit
        
        Args:
            key: Unique identifier (e.g., f"user_{user_id}_messages")
            limit: Maximum number of requests allowed
            window: Time window in seconds
        
        Returns:
            (allowed: bool, remaining: int)
        """
        with self.lock:
            now = datetime.now(timezone.utc)
            
            # Initialize if first request
            if key not in self.limits:
                self.limits[key] = []
            
            # Remove timestamps outside window
            cutoff = now.timestamp() - window
            self.limits[key] = [
                ts for ts in self.limits[key]
                if ts.timestamp() > cutoff
            ]
            
            # Check if limit exceeded
            current_count = len(self.limits[key])
            remaining = max(0, limit - current_count)
            
            if current_count >= limit:
                return False, 0
            
            # Add current timestamp
            self.limits[key].append(now)
            return True, remaining - 1
    
    def cleanup_old_entries(self, max_age: int = 3600):
        """
        Remove entries older than max_age seconds
        Call this periodically to prevent memory growth
        
        Args:
            max_age: Maximum age in seconds (default 1 hour)
        """
        with self.lock:
            now = datetime.now(timezone.utc)
            cutoff = now.timestamp() - max_age
            
            # Remove old entries
            keys_to_delete = []
            for key, timestamps in self.limits.items():
                self.limits[key] = [
                    ts for ts in timestamps
                    if ts.timestamp() > cutoff
                ]
                
                # Mark empty entries for deletion
                if not self.limits[key]:
                    keys_to_delete.append(key)
            
            # Delete empty entries
            for key in keys_to_delete:
                del self.limits[key]
    
    def reset_user_limits(self, user_id: int):
        """
        Reset all rate limits for a specific user
        Useful when user disconnects
        """
        with self.lock:
            keys_to_delete = [
                key for key in self.limits.keys()
                if key.startswith(f"user_{user_id}_")
            ]
            
            for key in keys_to_delete:
                del self.limits[key]
    
    def get_stats(self) -> dict:
        """Get current rate limiter statistics"""
        with self.lock:
            return {
                'total_keys': len(self.limits),
                'total_timestamps': sum(len(v) for v in self.limits.values())
            }


class TypingStatusManager:
    """
    Manages typing indicators with automatic expiration
    Thread-safe implementation
    """
    
    def __init__(self, timeout: int = 10):
        self.typing_status: Dict[str, Dict[int, datetime]] = {}
        self.lock = threading.Lock()
        self.timeout = timeout  # seconds
    
    def set_typing(self, conversation_key: str, user_id: int):
        """Mark user as typing in conversation"""
        with self.lock:
            if conversation_key not in self.typing_status:
                self.typing_status[conversation_key] = {}
            
            self.typing_status[conversation_key][user_id] = datetime.now(timezone.utc)
    
    def remove_typing(self, conversation_key: str, user_id: int):
        """Remove typing indicator"""
        with self.lock:
            if conversation_key in self.typing_status:
                self.typing_status[conversation_key].pop(user_id, None)
                
                # Clean up empty conversations
                if not self.typing_status[conversation_key]:
                    del self.typing_status[conversation_key]
    
    def get_typing_users(self, conversation_key: str) -> List[int]:
        """Get list of currently typing users (excluding expired)"""
        with self.lock:
            if conversation_key not in self.typing_status:
                return []
            
            now = datetime.now(timezone.utc)
            valid_users = []
            
            for user_id, timestamp in list(self.typing_status[conversation_key].items()):
                age = (now - timestamp).total_seconds()
                
                if age <= self.timeout:
                    valid_users.append(user_id)
                else:
                    # Auto-remove expired
                    del self.typing_status[conversation_key][user_id]
            
            return valid_users
    
    def cleanup_expired(self):
        """Remove all expired typing indicators"""
        with self.lock:
            now = datetime.now(timezone.utc)
            conversations_to_delete = []
            
            for conv_key, users in list(self.typing_status.items()):
                users_to_delete = []
                
                for user_id, timestamp in users.items():
                    age = (now - timestamp).total_seconds()
                    if age > self.timeout:
                        users_to_delete.append(user_id)
                
                # Remove expired users
                for user_id in users_to_delete:
                    del self.typing_status[conv_key][user_id]
                
                # Mark empty conversations
                if not self.typing_status[conv_key]:
                    conversations_to_delete.append(conv_key)
            
            # Delete empty conversations
            for conv_key in conversations_to_delete:
                del self.typing_status[conv_key]
    
    def remove_user_from_all(self, user_id: int):
        """Remove user from all typing indicators (on disconnect)"""
        with self.lock:
            for conv_key in list(self.typing_status.keys()):
                self.typing_status[conv_key].pop(user_id, None)
                
                # Clean up empty conversations
                if not self.typing_status[conv_key]:
                    del self.typing_status[conv_key]
