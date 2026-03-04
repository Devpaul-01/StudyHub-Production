"""
WebSocket Configuration for StudyHub
Production-ready settings with security and performance optimizations
"""

# ============================================================================
# MESSAGE CONSTRAINTS
# ============================================================================

MAX_MESSAGE_LENGTH = 10000  # characters
MAX_MESSAGE_RESOURCES = 10  # attachments per message
MAX_RESOURCE_SIZE = 50 * 1024 * 1024  # 50MB

# ============================================================================
# RATE LIMITING
# ============================================================================

# Message sending limits
MESSAGE_RATE_LIMIT = 20  # messages
MESSAGE_RATE_WINDOW = 60  # seconds

# Event rate limits (typing, reactions, etc.)
EVENT_RATE_LIMIT = 30  # events
EVENT_RATE_WINDOW = 60  # seconds

# Thread message limits (group chats can be spammier)
THREAD_MESSAGE_RATE_LIMIT = 30
THREAD_MESSAGE_RATE_WINDOW = 60

# ============================================================================
# TIMING SETTINGS
# ============================================================================

# How long before a typing indicator expires
TYPING_INDICATOR_TIMEOUT = 10  # seconds

# Cleanup intervals
TYPING_STATUS_CLEANUP_INTERVAL = 30  # seconds
RATE_LIMIT_CLEANUP_INTERVAL = 300  # 5 minutes

# Connection timeouts
PING_TIMEOUT = 90  # seconds (mobile-friendly)
PING_INTERVAL = 25  # seconds

# ============================================================================
# DATABASE SETTINGS
# ============================================================================

# Connection pool configuration
DB_POOL_SIZE = 20
DB_MAX_OVERFLOW = 40
DB_POOL_RECYCLE = 3600  # 1 hour
DB_POOL_PRE_PING = True  # Test connections before use

# ============================================================================
# SECURITY SETTINGS
# ============================================================================

# Allowed reaction types (emoji validation)
ALLOWED_REACTIONS = {
    'love': '❤️',
    'fire': '🔥',
    'laugh': '😂',
    'wow': '😮',
    'sad': '😢',
    'angry': '😡',
    'thumbs_up': '👍',
    'thumbs_down': '👎',
    'clap': '👏',
    'pray': '🙏',
    'celebrate': '🎉',
    'think': '🤔',
}

# HTML sanitization - allowed tags (none = strip all HTML)
ALLOWED_HTML_TAGS = []
ALLOWED_HTML_ATTRS = {}

# ============================================================================
# SOCKETIO CONFIGURATION
# ============================================================================

SOCKETIO_CONFIG = {
    'cors_allowed_origins': "*",  # In production, set to your domain
    'async_mode': 'eventlet',
    'logger': True,
    'engineio_logger': False,
    'ping_timeout': PING_TIMEOUT,
    'ping_interval': PING_INTERVAL,
    'max_http_buffer_size': 10 * 1024 * 1024  # 10MB
}

# ============================================================================
# ERROR CODES
# ============================================================================

class ErrorCodes:
    """Standardized error codes for client handling"""
    
    # Authentication errors
    AUTH_REQUIRED = 'AUTH_REQUIRED'
    AUTH_INVALID = 'AUTH_INVALID'
    AUTH_EXPIRED = 'AUTH_EXPIRED'
    
    # Permission errors
    PERMISSION_DENIED = 'PERMISSION_DENIED'
    NOT_CONNECTED = 'NOT_CONNECTED'
    NOT_MEMBER = 'NOT_MEMBER'
    
    # Validation errors
    INVALID_INPUT = 'INVALID_INPUT'
    MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG'
    TOO_MANY_RESOURCES = 'TOO_MANY_RESOURCES'
    INVALID_REACTION = 'INVALID_REACTION'
    
    # Rate limiting
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
    
    # Resource errors
    NOT_FOUND = 'NOT_FOUND'
    ALREADY_EXISTS = 'ALREADY_EXISTS'
    
    # Server errors
    SERVER_ERROR = 'SERVER_ERROR'
    DATABASE_ERROR = 'DATABASE_ERROR'
