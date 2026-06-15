"""
StudyHub Configuration - PRODUCTION READY
Dynamically loads URL from environment variables
"""
import os

# Get URL from environment variable
url = os.environ.get('CURRENT_URL', 'http://127.0.0.1:5001/')

# Ensure URL ends with /
if not url.endswith('/'):
    url += '/'