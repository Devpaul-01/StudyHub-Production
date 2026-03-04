# app.py - PRODUCTION READY VERSION WITH FLASK-MAIL
# ============================================================================
# IMPORTANT: Load environment variables FIRST before any other imports
# ============================================================================
 # This MUST be the first import!

from flask import Flask, render_template, request, jsonify
from flask_migrate import Migrate
from services.websocket_messages import init_message_websocket
from extensions import db, mail
import os

from routes.student.helpers import (
    token_required, success_response, error_response
)
import os


from waitlist import waitlist_bp
import logging
from routes.student import student_bp

from routes.student.auth import google_bp
from logging.handlers import RotatingFileHandler

#from services.push_notifications import PushNotificationService#
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

# ============================================================================
# Configuration Class
# ============================================================================
#PushNotificationService.initialize()#
migrate = Migrate()
class Config:
    """Production-ready configuration"""
    
    # Flask Core
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY environment variable is not set!")
    
    FLASK_ENV = os.environ.get('FLASK_ENV', 'production')
    DEBUG = False  # Always False in production
    TESTING = False
    
    # Database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set!")
    
    # Fix for Heroku/Railway postgres:// vs postgresql://
    if DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    
    # Flask-Mail Configuration (Gmail with App Password)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')
    
    # Email reliability settings for production
    MAIL_MAX_EMAILS = 50
    MAIL_TIMEOUT = 5
    # Reduced from 10
    # Add connection pooling settings
    MAIL_DEBUG = False

    
    # Suppress SSL warnings in production
    MAIL_SUPPRESS_SEND = False
    MAIL_ASCII_ATTACHMENTS = False
    
    if not MAIL_USERNAME or not MAIL_PASSWORD:
        print("⚠️  WARNING: Email credentials not configured!")
    else:
        print(f"✅ Email configured: {MAIL_USERNAME}")
    
    # Application Settings
    CURRENT_URL = os.environ.get('CURRENT_URL', 'http://127.0.0.1:5001/')
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'static/upload')
    
    # Mailchimp (Optional)
    MAILCHIMP_API_KEY = os.environ.get('MAILCHIMP_API_KEY')
    MAILCHIMP_LIST_ID = os.environ.get('MAILCHIMP_LIST_ID')
    
    # Security Settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload
    JSON_SORT_KEYS = False
    JSONIFY_PRETTYPRINT_REGULAR = False
    
    # Session Security
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hour


# ============================================================================
# Application Factory
# ============================================================================
def create_app(config_class=Config):
    """Create and configure the Flask application"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    mail.init_app(app)
    migrate.init_app(app, db)
    socketio = init_message_websocket(app)
    
    
    # Test email configuration on startup
    with app.app_context():
        try:
            # Verify mail configuration
            if app.config.get('MAIL_USERNAME'):
                print("📧 Flask-Mail initialized successfully")
                print(f"   Server: {app.config['MAIL_SERVER']}:{app.config['MAIL_PORT']}")
                print(f"   TLS: {app.config['MAIL_USE_TLS']}")
        except Exception as e:
            print(f"⚠️  Email configuration warning: {e}")
    
    # ========================================================================
    # Logging Configuration
    # ========================================================================
    if not app.debug and not app.testing:
        # Create logs directory if it doesn't exist
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        # File handler for error logs
        file_handler = RotatingFileHandler(
            'logs/studyhub.log',
            maxBytes=10240000,  # 10MB
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        
        app.logger.setLevel(logging.INFO)
        app.logger.info('StudyHub startup')
    
    # ========================================================================
    # Error Handlers
    # ========================================================================
    @app.errorhandler(400)
    def bad_request(error):
        app.logger.error(f"400 Bad Request: {error}")
        return jsonify({
            "status": "error",
            "message": "Bad request - Invalid data format"
        }), 400
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "status": "error",
            "message": "Resource not found"
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"500 Internal Error: {error}")
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": "Internal server error"
        }), 500
    
    # ========================================================================
    # Security Headers
    # ========================================================================
    @app.after_request
    def set_security_headers(response):
        """Add security headers to all responses"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Only set HSTS in production with HTTPS
        if not app.debug and app.config.get('SESSION_COOKIE_SECURE'):
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response
    
    # ========================================================================
    # Request Logging
    # ========================================================================
    

    @app.before_request
    def log_request():
        """Log important requests without exposing sensitive data"""
        if request.method in ['POST', 'PUT', 'DELETE']:
            app.logger.info(f"{request.method} {request.path} from {request.remote_addr}")
    
    # ========================================================================
    # Register Blueprints
    # ========================================================================
    app.register_blueprint(waitlist_bp)
    app.register_blueprint(google_bp, url_prefix='/google')
    app.register_blueprint(student_bp)
  
   
    
    # ========================================================================
    # Routes
    # ========================================================================
    @app.route("/")
    def home():
        """Landing page"""
        return render_template("index.html")
    
    @app.route("/health")
    def health_check():
        """Health check endpoint for monitoring"""
        try:
            # Check database connection
            db.session.execute('SELECT 1')
            
            # Check email configuration
            email_status = bool(app.config.get('MAIL_USERNAME') and app.config.get('MAIL_PASSWORD'))
            
            return jsonify({
                "status": "healthy",
                "database": "connected",
                "email_configured": email_status,
                "mail_server": app.config.get('MAIL_SERVER')
            }), 200
        except Exception as e:
            app.logger.error(f"Health check failed: {e}")
            return jsonify({
                "status": "unhealthy",
                "database": "disconnected"
            }), 500
    
    @app.route("/robots.txt")
    def robots():
        """Robots.txt for search engines"""
        return """User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /student/profile/
""", 200, {'Content-Type': 'text/plain'}
    
    # ========================================================================
    # Shell Context
    # ========================================================================
    @app.shell_context_processor
    def make_shell_context():
        """Add database and models to Flask shell"""
        from models import User, WaitlistSignup, Post, Comment
        return {
            'db': db,
            'User': User,
            'WaitlistSignup': WaitlistSignup,
            'Post': Post,
            'Comment': Comment
        }
    
    return app


# ============================================================================
# Application Instance
# ============================================================================
app = create_app()


# ============================================================================
# Run Application
# ============================================================================
# ============================================================================
# Run Application
# ============================================================================
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5001))
    host = "0.0.0.0"
    
    print("\n" + "="*60)
    print("🚀 StudyHub Starting...")
    print("="*60)
    print(f"📧 Email: {os.environ.get('MAIL_USERNAME', 'Not configured')}")
    print(f"🗄️  Database: {os.environ.get('DATABASE_URL', 'Not configured')}")
    print(f"🔑 Secret Key: {'✅ Set' if os.environ.get('SECRET_KEY') else '❌ Missing'}")
    print(f"🌐 WebSocket: Enabled with eventlet")
    print("="*60)
    print(f"🔗 Server running on: http://{host}:{port}")
    print(f"🔗 Local access: http://127.0.0.1:{port}")
    print(f"🔗 Network access: http://localhost:{port}")
    print("="*60 + "\n")
    
    # Create database tables if they don't exist
    with app.app_context():
        db.create_all()
        print("✅ Database tables created/verified\n")
    
    # Run with SocketIO
    from services.websocket_messages import message_ws_manager
    
    message_ws_manager.socketio.run(
        app,
        debug=True,
        host=host,
        port=port,
        use_reloader=False  # Disable reloader to prevent duplicate startup messages
    )
else:
    # This runs in production (Gunicorn)
    from services.websocket_messages import message_ws_manager
    with app.app_context():
        db.create_all()
        print("✅ Database tables initialized in production")
