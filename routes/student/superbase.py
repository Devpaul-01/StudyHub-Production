import requests

# Your Supabase details


# File to upload (local path on your phone)
SUPABASE_URL = os.environ("SUPABASE_URL")
SERVICE_ROLE_KEY = os.environ("SERVICE_ROLE_KEY")
BUCKET = "Study Hub"
headers = {
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/octet-stream"
}

import secrets
import datetime
from werkzeug.utils import secure_filename


class FilenameService:
    """Generate secure, unique filenames for uploads"""
    
    @staticmethod
    def _get_extension(original_filename):
        """Extract and validate file extension"""
        if '.' not in original_filename:
            raise ValueError("File has no extension")
        
        ext = original_filename.rsplit('.', 1)[1].lower()
        return ext
    
    @staticmethod
    def _generate_token(length=8):
        """Generate random hex token"""
        return secrets.token_hex(length)
    
    @staticmethod
    def _get_timestamp():
        """Get current timestamp in YYYYMMDD format"""
        return datetime.datetime.utcnow().strftime('%Y%m%d')
    
    @staticmethod
    def _get_date_path():
        """Get date-based folder path (YYYY/MM)"""
        now = datetime.datetime.utcnow()
        return f"{now.year}/{now.month:02d}"
    
        
    # ========================================
    # AVATAR FILENAMES
    # ========================================
    
    @staticmethod
    def generate_avatar_filename(user_id, original_filename):
        """
        Generate avatar filename
        Format: user_{id}_{timestamp}_{token}.{ext}
        Example: user_123_20240101_a3f5c9.jpg
        """
        ext = FilenameService._get_extension(original_filename)
        timestamp = FilenameService._get_timestamp()
        token = FilenameService._generate_token(6)
        
        return f"user_{user_id}_{timestamp}_{token}.{ext}"
    
    @staticmethod
    def get_avatar_path(user_id, original_filename):
        """
        Get full Cloudinary path for avatar
        Returns: (folder, filename)
        Example: ("studyhub/avatars", "user_123_20240101_a3f5c9.jpg")
        """
        filename = FilenameService.generate_avatar_filename(user_id, original_filename)
        return "studyhub/avatars", filename
    
    # ========================================
    # POST FILENAMES
    # ========================================
    
    @staticmethod
    def generate_post_filename(post_id, original_filename, file_type="image"):
        """
        Generate post file filename
        Format: post_{id}_{timestamp}_{token}.{ext}
        Example: post_456_20240101_f3a5c9b2.jpg
        """
        ext = FilenameService._get_extension(original_filename)
        timestamp = FilenameService._get_timestamp()
        token = FilenameService._generate_token(8)
        
        return f"post_{post_id}_{timestamp}_{token}.{ext}"
    
    @staticmethod
    def get_post_file_path(post_id, original_filename, file_type="image"):
        """
        Get full path for post file with date-based folders
        Returns: (folder, filename)
        Example: ("studyhub/posts/images/2024/01", "post_456_20240101_f3a5c9b2.jpg")
        """
        date_path = FilenameService._get_date_path()
        filename = FilenameService.generate_post_filename(post_id, original_filename, file_type)
        folder = f"studyhub/posts/{file_type}s/{date_path}"
        
        return folder, filename
    
    # ========================================
    # MESSAGE FILENAMES
    # ========================================
    
    @staticmethod
    def generate_message_filename(message_id, original_filename):
        """
        Generate message attachment filename
        Format: msg_{id}_{token}.{ext}
        Example: msg_789_a3f5c9b2.jpg
        """
        ext = FilenameService._get_extension(original_filename)
        token = FilenameService._generate_token(8)
        
        return f"msg_{message_id}_{token}.{ext}"
    
    @staticmethod
    def get_message_file_path(message_id, original_filename, file_type="image"):
        """
        Get full path for message attachment
        Returns: (folder, filename)
        Example: ("studyhub/messages/images", "msg_789_a3f5c9b2.jpg")
        """
        filename = FilenameService.generate_message_filename(message_id, original_filename)
        folder = f"studyhub/messages/{file_type}s"
        
        return folder, filename
    
    # ========================================
    # RESOURCE LIBRARY FILENAMES
    # ========================================
    
    @staticmethod
    def generate_resource_filename(resource_id, original_filename):
        """
        Generate resource library filename
        Format: resource_{id}_{timestamp}_{token}.{ext}
        Example: resource_12_20240101_9b1c4d.pdf
        """
        ext = FilenameService._get_extension(original_filename)
        timestamp = FilenameService._get_timestamp()
        token = FilenameService._generate_token(8)
        
        return f"resource_{resource_id}_{timestamp}_{token}.{ext}"
    
    @staticmethod
    def get_resource_file_path(resource_id, original_filename, file_type="document"):
        """
        Get full path for resource file
        Returns: (folder, filename)
        Example: ("studyhub/resources/documents/2024/01", "resource_12_20240101_9b1c4d.pdf")
        """
        date_path = FilenameService._get_date_path()
        filename = FilenameService.generate_resource_filename(resource_id, original_filename)
        folder = f"studyhub/resources/{file_type}s/{date_path}"
        
        return folder, filename
    
    # ========================================
    # AI ASSISTANT TEMP FILES
    # ========================================
    
    @staticmethod
    def generate_ai_temp_filename(user_id, original_filename):
        """
        Generate temporary filename for AI uploads
        Format: ai_temp_{user_id}_{token}.{ext}
        Example: ai_temp_123_a3f5c9b2.jpg
        """
        ext = FilenameService._get_extension(original_filename)
        token = FilenameService._generate_token(8)
        
        return f"ai_temp_{user_id}_{token}.{ext}"
    
    @staticmethod
    def get_ai_temp_path(user_id, original_filename):
        """
        Get path for temporary AI uploads
        Returns: (bucket, path)
        Example: ("studyhub-private", "ai-uploads/user_123/ai_temp_123_a3f5c9b2.jpg")
        """
        filename = FilenameService.generate_ai_temp_filename(user_id, original_filename)
        path = f"ai-uploads/user_{user_id}/{filename}"
        
        return "studyhub", path




response = requests.post(upload_url, headers=headers, data=file_data)

if response.status_code in [200, 201]:
    print("Upload successful!")
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{file_name}"
    print("Public URL:", public_url)
else:
    print("Upload failed:", response.status_code, response.text)