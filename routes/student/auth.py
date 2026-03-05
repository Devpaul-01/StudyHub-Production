# routes/student/auth.py
# FIXED: All syntax errors corrected + cleaned up onboarding

from flask import Blueprint, request, jsonify, redirect, url_for, current_app, make_response, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash 
import re
import random
from flask_dance.contrib.google import make_google_blueprint, google
from flask_dance.consumer import oauth_authorized
from sqlalchemy import or_, and_
import jwt  
import datetime
import os

from models import User, StudentProfile, Notification, OnboardingDetails
from extensions import db
from utils import generate_verification_token, send_password_reset,generate_tokens_for_user,send_verification_email, verify_token, decode_token
from .helpers import (
    generate_tokens_for_user, token_required,
    success_response, error_response
)

auth_bp = Blueprint("student_auth", __name__)

# ============================================================================
# CONSTANTS
# ============================================================================
DEPARTMENTS = [
    "Architecture", "Computer Science", "Engineering (Civil)", "Engineering (Electrical)",
    "Engineering (Mechanical)", "Medicine & Surgery", "Pharmacy", "Nursing", "Law",
    "Accounting", "Business Administration", "Economics", "Mass Communication", "English",
    "History", "Biology", "Chemistry", "Physics", "Mathematics", "Statistics",
    "Psychology", "Sociology", "Political Science", "Agricultural Science",
    "Fine Arts", "Music", "Theatre Arts"
]

CLASS_LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"]
CLIENT_SECRET=os.environ.get("GOOGLE_CLIENT_SECRET")
CLIENT_ID=os.environ.get("GOOGLE_CLIENT_ID")

google_bp = make_google_blueprint(
    client_id=os.getenv("GOOGLE_OAUTH_CLIENT_ID") or CLIENT_ID,
    client_secret=os.getenv("GOOGLE_OAUTH_CLIENT_SECRET") or CLIENT_SECRET,
    scope=[
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "openid"
    ],
    redirect_to="google.google_callback"
)
# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def get_json_data():
    """Safely get JSON data from request"""
    try:
        if request.is_json:
            return request.get_json(force=True, silent=True)
        
        data = request.get_data(as_text=True)
        if data:
            import json
            return json.loads(data)
        
        return None
    except Exception as e:
        current_app.logger.error(f"JSON parsing error: {str(e)}")
        return None

def is_valid_email(email):
    """Returns True if the email is valid"""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return re.match(pattern, email) is not None

# ============================================================================
# GOOGLE OAUTH
# ============================================================================
@google_bp.route("/start")
def google_start():
    """Redirect to Google OAuth"""
    return redirect(url_for("google.login"))

@google_bp.route("/callback")
def google_callback():
    """Handle Google OAuth callback — single entry point for all Google sign-ins.

    Flow:
      1. Approved user      → log in directly, go to homepage
      2. Partially set up   → send to complete-registration to set password/username
      3. Brand new user     → create account, go to onboarding
    """
    try:
        if not google.authorized:
            return redirect(url_for("student.student_auth.login") + "?error=oauth_failed")

        resp = google.get("/oauth2/v2/userinfo")
        if not resp.ok:
            return redirect(url_for("student.student_auth.login") + "?error=oauth_failed")

        google_info = resp.json()
        email = google_info.get("email", "").lower().strip()
        name  = google_info.get("name", "")

        if not email:
            return redirect(url_for("student.student_auth.login") + "?error=oauth_failed")

        # ── 1. Existing user ──────────────────────────────────────────────────
        existing_user = User.query.filter_by(email=email).first()

        if existing_user:
            if existing_user.status == "approved":
                # Fully registered — log straight in
                access_token, refresh_token_val = generate_tokens_for_user(existing_user)
                response = make_response(redirect("/student/profile/homepage"))
                response.set_cookie("access_token",  access_token,     httponly=False, secure=False, samesite="Lax", max_age=30*60)
                response.set_cookie("refresh_token",  refresh_token_val, httponly=True,  secure=False, samesite="Lax", max_age=7*24*60*60)
                current_app.logger.info(f"✅ Google login: existing user {email}")
                return response

            # Partially registered — still needs password/username
            current_app.logger.info(f"⚠️  Google login: incomplete user {email}, redirecting to complete-registration")
            return redirect(f"/student/complete-registration?email={email}")

        # ── 2. Brand-new user — create account ───────────────────────────────
        new_user = User(
            name=name,
            email=email,
            role="student",
            pin="PENDING_VERIFICATION",
            status="pending_onboarding",
            email_verified=True,          # Google already verified the email
            privacy_settings=privacy_settings,
            notification_settings=notification_settings,
            connection_settings=connection_settings
        )
        db.session.add(new_user)
        db.session.flush()

        student_profile = StudentProfile(
            user_id=new_user.id,
            full_name=name,
            date_of_birth=None,
            pin="PENDING_VERIFICATION",
            status="incomplete",
            department="",
            class_name=""
        )
        db.session.add(student_profile)

        welcome_notification = Notification(
            user_id=new_user.id,
            link=url_for("student.student_auth.features"),
            title="🎉 Welcome to StudyHub!",
            body=f"Welcome {name}! 🎓 Complete your profile to find the perfect study partners.",
            notification_type="welcome",
            related_type="user",
            related_id=new_user.id
        )
        db.session.add(welcome_notification)
        db.session.commit()

        # Keep name in session so onboard page can pre-fill the name field
        session["google_name"]  = name
        session["google_email"] = email

        current_app.logger.info(f"✅ Google signup: new user {email} created, redirecting to onboarding")
        return redirect(f"/student/onboard/{email}")

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Google OAuth error: {str(e)}")
        return redirect(url_for("student.student_auth.login") + "?error=oauth_failed")
    
@auth_bp.route("/google_temp_info")
def temp_info():
    """Get temporary OAuth info from session"""
    return jsonify({
        "status": "success", 
        "email": session.get("google_email"), 
        "name": session.get('google_name')
    })
    
@auth_bp.route("/clear-session", methods=["POST"])
def clear_session():
    """Clear OAuth session data"""
    session.pop("google_email", None)
    session.pop("google_name", None)
    return jsonify({"status": "success"})

# ============================================================================
# ONBOARDING - FIXED AND CLEANED UP
# ============================================================================
notification_settings = {
    "enable_notification_sound": True, 
    "notification_category": [], 
    "enable_notification": True, 
    "send_email_notification": False
}

connection_settings = {
    "enable_sound": True
}

privacy_settings = {
    "set_profile_private": False, 
    "show_active_status": True, 
    "set_dark_mode": False, 
    "send_weeekly_notifications": True
}

@auth_bp.route('/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
  return jsonify({
"status": "success",
"data": {
"user": {
"id":       current_user.id,
"name":     current_user.name,
"username": current_user.username,
"avatar":   current_user.avatar,
}
}
})

@auth_bp.route("/features", methods=["GET"])
def features():
    return render_template('features.html')

@auth_bp.route("/demo", methods=["GET", "POST"])
def demo():
    return render_template('demo.html')

@auth_bp.route("/onboard/suggestions-by-email/<email>", methods=["GET"])
def onboard_suggestions_by_email(email):
    """Get study buddy suggestions using email directly"""
    try:
        if not email:
            return error_response("Email required")
        
        # Find user
        user = User.query.filter_by(email=email).first()
        if not user:
            return error_response("User not found")
        
        # Generate matches
        matches = generate_onboarding_matches(user.id)
        
        # If no good matches, return top users by reputation
        if not matches:
            top_users = User.query.filter(
                User.id != user.id,
                User.status == 'approved'
            ).order_by(User.reputation.desc()).limit(5).all()
            
            matches = []
            for top_user in top_users:
                matches.append({
                    "user": {
                        "id": top_user.id,
                        "username": top_user.username,
                        "name": top_user.name,
                        "avatar": top_user.avatar or "/static/default-avatar.png",
                        "reputation": top_user.reputation,
                        "reputation_level": top_user.reputation_level
                    },
                    "match_score": random.randint(50, 70),
                    "reasons": ["Top contributor", "Active member"]
                })
        
        return success_response("Suggestions generated", data={"matches": matches})
        
    except Exception as e:
        current_app.logger.error(f"Suggestions error: {str(e)}")
        return error_response("Failed to generate suggestions")

@auth_bp.route("/onboard/request-all/<email>", methods=["POST"])
def request_all(email):
    try:
        if not email:
            return error_response("Email not found")

        user = User.query.filter_by(email=email).first()
        if not user:
            return error_response("Error encountered sending connection request")

        data = request.get_json()
        ids = data.get("ids", [])

        if ids:
            for rid in ids:
                connection = Connection(
                    status="pending",
                    requester_id=user.id,
                    receiver_id=rid,
                    requested_at=datetime.datetime.utcnow()
                )
                db.session.add(connection)

        db.session.commit()
        return success_response("Connection request sent successfully")

    except Exception as e:
        db.session.rollback()   # Very important
        return error_response(f"An error occurred: {str(e)}")

@auth_bp.route("/onboard/<email>", methods=["GET", "POST"])
def onboard(email):
    """Handle onboarding - GET renders page, POST saves data"""
    
    # Handle GET request (Rendering the onboarding page)
    if request.method == "GET":
        return render_template("onboard.html")
    
    # Handle POST request (Submitting onboarding data)
    try:
        data = request.get_json()
        
        if not data:
            return error_response("No data provided")
        
        if not email:
            return error_response("Email not found")
        # Find the user by the decoded email
        user = User.query.filter_by(email=email).first()
        if not user:
            return error_response("User not found")
        student_profile = user.student_profile
        
        # Get or create onboarding details
        onboarding_details = OnboardingDetails.query.filter_by(user_id=user.id).first()

        if not onboarding_details:
            onboarding_details = OnboardingDetails(
                user_id=user.id, 
                email=email
            )
            db.session.add(onboarding_details)
        
        # Extract data from the POST request
        name          = data.get("name", "").strip()
        department = data.get("department", "")
        class_level = data.get("class_level", "")
        subjects = data.get("subjects", [])
        learning_style = data.get("learning_style", "")
        study_preferences = data.get("study_preferences", [])
        help_subjects = data.get("help_subjects", [])
        strong_subjects = data.get("strong_subjects", [])
        study_schedule = data.get("study_schedule", {})
        session_length = data.get("session_length", "")

        # Update name if the user edited it on the onboard page
        if name:
            user.name = name
            if student_profile:
                student_profile.full_name = name

        if student_profile:
            student_profile.department = department
            student_profile.class_name = class_level
        # Update user basic info
        user.department = department
        user.class_name = class_level
        
        # Update the onboarding details
        onboarding_details.department = department
        onboarding_details.class_level = class_level
        onboarding_details.subjects = subjects
        onboarding_details.learning_style = learning_style
        onboarding_details.study_preferences = study_preferences
        onboarding_details.help_subjects = help_subjects
        onboarding_details.strong_subjects = strong_subjects
        onboarding_details.study_schedule = study_schedule
        onboarding_details.session_length = session_length
        onboarding_details.last_updated = datetime.datetime.utcnow()

        # Commit changes to the database
        db.session.commit()
        access_token, refresh_token = generate_tokens_for_user(user)
        
        response = make_response(success_response(
            f"Onboarding details saved successfully",
            data={
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "username": user.username,
                    "email": user.email
                },
                "redirect": "/student/profile/homepage"
            }
        ))
        
        response.set_cookie(
            "access_token", 
            access_token, 
            httponly=False,
            secure=False,
            samesite="Lax", 
            max_age=30 * 60
        )
        response.set_cookie(
            "refresh_token", 
            refresh_token, 
            httponly=True,
            secure=False,
            samesite="Lax", 
            max_age=7 * 24 * 60 * 60
        )

        return response
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Onboarding error: {str(e)}")
        return error_response(f"Failed to save onboarding data: {str(e)}")


def generate_onboarding_matches(user_id):
    """
    Generate perfect matches based on onboarding data - FIXED
    
    Args:
        user_id: ID of the user to generate matches for
        
    Returns:
        list: Top 5 matches with scores and reasons
    """
    try:
        # Find the user
        user = User.query.get(user_id)
        if not user:
            current_app.logger.error(f"User {user_id} not found")
            return []
        
        # Get user's onboarding progress
        progress = OnboardingDetails.query.filter_by(user_id=user_id).first()
        if not progress:
            current_app.logger.warning(f"No onboarding data for user {user_id}")
            return []
        
        # Find potential matches (other approved users)
        potential_matches = User.query.filter(
            User.id != user.id,
            User.status == "approved"
        ).all()
        
        matches = []
        
        for candidate in potential_matches:
            # Get candidate's onboarding data
            cand_progress = OnboardingDetails.query.filter_by(user_id=candidate.id).first()
            if not cand_progress:
                continue
            
            score = 0
            reasons = []
            
            # 1. Same department (20 points)
            if cand_progress.department == progress.department:
                score += 20
                reasons.append(f"Same major ({progress.department})")
            
            # 2. Studying same subjects (30 points max)
            common_subjects = set(progress.subjects or []) & set(cand_progress.subjects or [])
            if common_subjects:
                subject_score = min(len(common_subjects) * 10, 30)
                score += subject_score
                reasons.append(f"Studying {', '.join(list(common_subjects)[:2])}")
            
            # 3. Complementary strengths (25 points max)
            # You need help with what they're strong in
            helpful_overlap = set(progress.help_subjects or []) & set(cand_progress.strong_subjects or [])
            if helpful_overlap:
                help_score = min(len(helpful_overlap) * 10, 25)
                score += help_score
                reasons.append(f"Can help you with {list(helpful_overlap)[0]}")
            
            # 4. Available at same times (25 points max)
            user_avail = set()
            cand_avail = set()
            
            # Build availability sets
            for day, times in (progress.study_schedule or {}).items():
                for time in times:
                    user_avail.add(f"{day}_{time}")
                    
            for day, times in (cand_progress.study_schedule or {}).items():
                for time in times:
                    cand_avail.add(f"{day}_{time}")
            
            time_overlap = len(user_avail & cand_avail)
            if time_overlap > 0:
                time_score = min(time_overlap * 5, 25)
                score += time_score
                reasons.append("Available at same times")
            
            # Only show good matches (40+ score)
            if score >= 40:
                matches.append({
                    "user": {
                        "id": candidate.id,
                        "username": candidate.username,
                        "name": candidate.name,
                        "avatar": candidate.avatar or "/static/images/default-avatar.png",
                        "reputation": candidate.reputation,
                        "reputation_level": candidate.reputation_level
                    },
                    "match_score": score,
                    "reasons": reasons[:4]  # Top 4 reasons
                })
        
        # Sort by score and return top 5
        matches.sort(key=lambda x: x["match_score"], reverse=True)
        return matches[:5]
        
    except Exception as e:
        current_app.logger.error(f"Error generating matches: {str(e)}")
        return []


@auth_bp.route("/onboard/suggestions/<token>", methods=["GET"])
def onboard_suggestions(token):
    """
    Get study buddy suggestions based on onboarding data - FIXED
    """
    try:
        # Verify token and get email
        email = verify_token(token)
        
        # Check if verify_token returned an error dict
        if isinstance(email, dict) and "error" in email:
            return error_response(email["error"])
        
        # Find user
        user = User.query.filter_by(email=email).first()
        if not user:
            return error_response("User not found")
        
        # Generate matches
        matches = generate_onboarding_matches(user.id)
        
        # If no good matches, return top users by reputation
        if not matches:
            top_users = User.query.filter(
                User.id != user.id,
                User.status == 'approved'
            ).order_by(User.reputation.desc()).limit(5).all()
            
            matches = []
            for top_user in top_users:
                matches.append({
                    "user": {
                        "id": top_user.id,
                        "username": top_user.username,
                        "name": top_user.name,
                        "avatar": top_user.avatar or "/static/images/default-avatar.png",
                        "reputation": top_user.reputation,
                        "reputation_level": top_user.reputation_level
                    },
                    "match_score": random.randint(50, 70),
                    "reasons": ["Top contributor", "Active member"]
                })
        
        return success_response("Suggestions generated", data={"matches": matches})
        
    except Exception as e:
        current_app.logger.error(f"Suggestions error: {str(e)}")
        return error_response("Failed to generate suggestions")


# ============================================================================
# REGISTER - UNCHANGED (keeping your original logic)
# ============================================================================
@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    """Registration endpoint"""
    if request.method == "GET":
        return render_template("auth/register.html")
    
    current_app.logger.info(f"=== REGISTER REQUEST ===")
    current_app.logger.info(f"Content-Type: {request.content_type}")
    
    try:
        data = get_json_data()
        
        if data is None:
            return error_response("Invalid JSON data received")
        
        full_name = data.get("full_name", "").strip()
        email = data.get("email", "").strip().lower()

        # Google-verified flag: when True, the email was obtained via Google OAuth
        # and is already trusted — no verification email needed.
        google_verified = bool(data.get("google_verified", False))

        # Validation
        if not all([full_name, email]):
            return error_response("All fields are required")
            
        if not is_valid_email(email):
            return error_response("Invalid email format")

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            current_app.logger.error(f"❌ Email {email} already exists!")
            return error_response("Email already registered")
        
        # Create user — mark as verified immediately when coming from Google OAuth
        new_user = User(
            name=full_name,
            email=email,
            role="student",
            pin="PENDING_VERIFICATION",
            status="pending_onboarding" if google_verified else "pending_verification",
            email_verified=google_verified,
            privacy_settings=privacy_settings,
            notification_settings=notification_settings,
            connection_settings=connection_settings
        )
        db.session.add(new_user)
        db.session.flush()

        # Create student profile
        student_profile = StudentProfile(
            user_id=new_user.id,
            full_name=full_name,
            date_of_birth=None,
            pin="PENDING_VERIFICATION",
            status="incomplete",
            department="",
            class_name=""
        )
        db.session.add(student_profile)
        
        # Create welcome notification
        welcome_notification = Notification(
            user_id=new_user.id,
            link=url_for("student.student_auth.features"), 
            title="🎉 Welcome to StudyHub!",
            body=f"""Welcome @{email.split('@')[0]}! 🎓

Discover what makes StudyHub special:

📚 Smart Q&A - Get help from peers and experts
🧵 Study Threads - Join private study groups
🤝 Study Buddy - Find your perfect study partner
🏆 Earn Badges - Showcase your achievements
📊 Track Progress - GitHub-style activity heatmaps

Ready to start? Complete your profile and ask your first question!

💡 Pro tip: Be helpful to earn reputation points and unlock badges!""",
            notification_type="welcome",
            related_type="user",
            related_id=new_user.id
        )
        db.session.add(welcome_notification)
        
        db.session.commit()

        # ── Google-verified path ──────────────────────────────────────────────
        # Email already trusted via Google OAuth: skip verification email and
        # redirect straight to onboarding so the user can complete their profile.
        if google_verified:
            current_app.logger.info(f"✅ Google-verified registration for {email} — skipping email verification")
            # Clear the OAuth session data since it's no longer needed
            session.pop("google_email", None)
            session.pop("google_name", None)
            return success_response(
                "Account created! Let's set up your profile.",
                data={
                    "google_verified": True,
                    "redirect_url": f"/student/complete-registration?email={email}"
                  
                }
            )

        # ── Standard path ─────────────────────────────────────────────────────
        # Send verification email; user must click the link before continuing.
        token = generate_verification_token(email)
        if not token:
            return error_response("Error generating verification token")
            
        verification_url = url_for("student.student_auth.verify_email_api", token=token, _external=True)
        send_verification_email(email, verification_url)

        return success_response("Registration successful! Check your email for verification link.")
        
    except Exception as e:  
        db.session.rollback()
        current_app.logger.error(f"❌ Registration error: {str(e)}")
        return error_response(f"Registration failed: {str(e)}")


# ============================================================================
# LOGIN - UNCHANGED
# ============================================================================
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """Login endpoint"""
    if request.method == "GET":
        return render_template("auth/login.html")
    
    try:
        data = get_json_data()
        
        if data is None:
            return error_response("Invalid JSON data received")
        
        username_or_email = data.get("username_or_email", "").strip().lower()
        password = data.get("password", "")

        if not username_or_email or not password:
            return error_response("Username/Email and password required")

        user = User.query.filter(
            or_(User.username == username_or_email, User.email == username_or_email)
        ).first()

        if not user:
            return error_response("Invalid credentials")

        # Check registration status
        if user.pin == "PENDING_VERIFICATION":
            return error_response("Please complete your registration. Check your email for verification link.")
        
        if not user.email_verified:
            return error_response("Please verify your email first. Check your inbox.")
        
        if not user.username:
            return error_response("Please complete your registration")
        
        # Check password
        if not check_password_hash(user.pin, password):
            return error_response("Invalid credentials")
            
        if user.status != "approved":
            return error_response("Your account is pending approval")

        # Generate tokens
        access_token, refresh_token = generate_tokens_for_user(user)

        response = make_response(success_response(
            f"Welcome back, @{user.username}!",
            data={
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "username": user.username,
                    "email": user.email
                },
                "redirect": "/student/profile/homepage"
            }
        ))

        response.set_cookie(
            "access_token", 
            access_token, 
            httponly=False,
            secure=False,
            samesite="Lax", 
            max_age=30 * 60
        )
        response.set_cookie(
            "refresh_token", 
            refresh_token, 
            httponly=True,
            secure=False,
            samesite="Lax", 
            max_age=7 * 24 * 60 * 60
        )

        return response

    except Exception as e:
        current_app.logger.error(f"❌ Login error: {str(e)}")
        return error_response(f"Login failed: {str(e)}")


# ============================================================================
# OTHER ROUTES (Password Reset, Email Verification, etc.)
# ============================================================================
@auth_bp.route("/validate-user", methods=["POST"])
def validate_user():
    """Validate user and send password reset email"""
    try:
        data = request.get_json()
        user_input = data.get("data")
        
        if not user_input:
            return error_response("Kindly enter email or username")

        result = User.query.filter(
            or_(User.email == user_input, User.username == user_input)
        ).first()
        
        if not result:
            return error_response("User not found, kindly check inputted value")

        email = result.email
        reset_token = generate_verification_token(email)
        verification_url = url_for("student.student_auth.reset_password_api", token=reset_token, _external=True)
        send_password_reset(email, verification_url)
        
        return success_response("A password reset link has been sent to your email.")
    except Exception as e:
        current_app.logger.error(f"Password Reset error: {str(e)}")
        return error_response(f"Password reset failed: {str(e)}")


@auth_bp.route("/verify-reset/<token>", methods=["GET", "POST"])
def reset_password_api(token):
    """Verify password reset token"""
    if request.method == "GET":
        return render_template("auth/verify_reset.html")
    
    email = verify_token(token)
    
    # Check if verify_token returned an error dict
    if isinstance(email, dict) and "error" in email:
        return error_response(email["error"])
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return error_response("User not found")
        
    return success_response(
        "Password Reset Link Verified!", 
        data={"email": email, "redirect_url": f"/student/set-password?email={email}"}
    )


@auth_bp.route("/verify-email/<token>", methods=["GET", "POST"])
def verify_email_api(token):
    """API endpoint for email verification"""
    if request.method == "GET":
        return render_template("auth/verify-email.html")
        
    try:
        email = verify_token(token)
        
        # Check if verify_token returned an error dict
        if isinstance(email, dict) and "error" in email:
            return error_response(email["error"])

        user = User.query.filter_by(email=email).first()
        if not user:
            return error_response("User not found")

        if user.email_verified and user.status == "approved":
            return success_response(
                "Email already verified!",
                data={"email": email, "already_verified": True}
            )

        user.email_verified = True
        db.session.commit()

        return success_response(
            "Email verified successfully!",
            data={"email": email, "redirect_url": f"/student/complete-registration?email={email}"}
        )

    except Exception as e:
        current_app.logger.error(f"Verification error: {str(e)}")
        return error_response("Verification failed")


@auth_bp.route("/check-username", methods=["POST"])
def check_username():
    """Check if username is available"""
    try:
        data = get_json_data()
        if not data:
            return error_response("No data provided")
            
        username = data.get("username", "").strip().lower()
        
        if not username:
            return error_response("Username required")
        
        if not re.match(r'^[a-z0-9]{3,20}$', username):
            return error_response("Invalid username format")
        
        existing = User.query.filter_by(username=username).first()
        
        if existing:
            return error_response("Username taken")
        
        return success_response("Username available", data={"available": True})
        
    except Exception as e:
        current_app.logger.error(f"Check username error: {str(e)}")
        return error_response("Check failed")


@auth_bp.route("/complete-registration", methods=["GET", "POST"])
def complete_registration():
    """Complete registration with username and password"""
    if request.method == "GET":
        return render_template("auth/complete-registration.html")
    
    try:
        data = get_json_data()
        if not data:
            return error_response("No data provided")
        
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        confirm_password = data.get("confirm_password", "")
        username = data.get("username", "").strip().lower()

        # Validation
        if not all([email, password, confirm_password, username]):
            return error_response("All fields are required")
            
        if password != confirm_password:
            return error_response("Passwords do not match")
            
        if len(password) < 6:
            return error_response("Password must be at least 6 characters")
            
        if not re.match(r'^[a-z0-9]{3,20}$', username):
            return error_response("Username must be 3-20 lowercase letters and numbers only")

        user = User.query.filter_by(email=email, email_verified=True).first()
        if not user:
            return error_response("User not found or email not verified")

        existing_username = User.query.filter_by(username=username).first()
        if existing_username:
            return error_response("Username already taken")

        # Update user
        hashed_password = generate_password_hash(password)
        user.pin = hashed_password
        user.username = username
        user.status = "approved"
        
        # Update student profile
        student_profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if student_profile:
            student_profile.pin = hashed_password
            student_profile.username = username
            student_profile.status = "active"

        db.session.commit()

        return success_response(
            f"Registration complete! Welcome, @{username}!",
            data={"username": username}
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Complete registration error: {str(e)}")
        return error_response(f"Registration failed: {str(e)}")


@auth_bp.route("/reset-password", methods=["GET"])
def reset_password():
    """Render password reset request page"""
    return render_template("auth/reset_request.html")


@auth_bp.route("/set-password", methods=["GET", "POST"])
def set_password():
    """Set new password after reset"""
    if request.method == "GET":
        return render_template("auth/set_password.html")
        
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    if not all([email, password, confirm_password]):
        return error_response("All fields are required")

    if password != confirm_password:
        return error_response("Passwords do not match")

    if len(password) < 6:
        return error_response("Password must be at least 6 characters")

    user = User.query.filter_by(email=email, email_verified=True).first()
    if not user:
        return error_response("User not found or email not verified")

    hashed_password = generate_password_hash(password)
    user.pin = hashed_password

    student_profile = StudentProfile.query.filter_by(user_id=user.id).first()
    if student_profile:
        student_profile.pin = hashed_password

    db.session.commit()
    return success_response(
        f"Password reset complete @{user.username}!",
        data={"redirect_url": "/student/login"}
    )


@auth_bp.route("/refresh-token", methods=["POST"])
def refresh_token():
    """Refresh access token using refresh token"""
    try:
        refresh_token = request.cookies.get("refresh_token")
        
        if not refresh_token:
            return error_response("Refresh token not found")
        
        try:
            payload = decode_token(refresh_token)
        except jwt.ExpiredSignatureError:
            return error_response("Refresh token expired. Please login again.")
        except jwt.InvalidTokenError:
            return error_response("Invalid refresh token")
        
        user = User.query.get(payload.get("user_id"))
        
        if not user or user.status != "approved":
            return error_response("Account not active")
        
        # Generate new access token
        secret = os.environ.get("SECRET_KEY")
        
        access_payload = {
            "user_id": user.id,
            "email": user.email,
            "role": user.role,
            "username": user.username,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=50)
        }
        
        new_access_token = jwt.encode(access_payload, secret, algorithm="HS256")
        
        if isinstance(new_access_token, bytes):
            new_access_token = new_access_token.decode("utf-8")
        
        response = make_response(success_response(
            "Token refreshed",
            data={
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "name": user.name
                }
            }
        ))
        
        response.set_cookie(
            "access_token",
            new_access_token,
            httponly=False,
            secure=False,
            samesite="Lax",
            max_age=30 * 60
        )
        
        return response
        
    except Exception as e:
        current_app.logger.error(f"Token refresh error: {str(e)}")
        return error_response("Token refresh failed")


@auth_bp.route("/verify-auth", methods=["GET"])
def verify_auth():
    """Verify if user is authenticated"""
    try:
        access_token = request.cookies.get("access_token")
        
        if not access_token:
            return jsonify({
                "status": "error",
                "authenticated": False,
                "message": "No token found"
            }), 401
        
        try:
            payload = decode_token(access_token)
        except jwt.ExpiredSignatureError:
            return jsonify({
                "status": "error",
                "authenticated": False,
                "message": "Token expired",
                "should_refresh": True
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "status": "error",
                "authenticated": False,
                "message": "Invalid token"
            }), 401
        
        user = User.query.get(payload.get("user_id"))
        
        if not user:
            return jsonify({
                "status": "error",
                "authenticated": False,
                "message": "User not found"
            }), 401
        
        return jsonify({
            "status": "success",
            "authenticated": True,
            "data": {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "name": user.name,
                    "avatar": user.avatar,
                    "role": user.role
                }
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Verify auth error: {str(e)}")
        return jsonify({
            "status": "error",
            "authenticated": False,
            "message": "Verification failed"
        }), 500


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    """Logout user"""
    try:
        if request.method == "GET":
            response = make_response(redirect(url_for("student.student_auth.login")))
        else:
            response = make_response(success_response("Logged out successfully"))
        
        # Clear JWT cookies
        response.set_cookie("access_token", "", max_age=0)
        response.set_cookie("refresh_token", "", max_age=0)
        return response
        
    except Exception as e:
        current_app.logger.error(f"Logout error: {str(e)}")
        return error_response("Logout failed")
        
