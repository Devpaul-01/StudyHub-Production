"""
StudyHub - User Profile Management
Handles profile viewing, editing, stats, badges, and customization
"""

from flask import Blueprint, request, jsonify, current_app, render_template
from werkzeug.utils import secure_filename
from sqlalchemy import func, desc
import os
import datetime
from sqlalchemy import or_
from flask import session

from models import (
    User, StudentProfile, Post, Comment, Thread, ThreadMember,
    UserBadge, Badge, ReputationHistory, UserActivity, Connection, Notification,
   PostReaction, Bookmark
)
from extensions import db
from routes.student.helpers import (
    token_required, success_response, error_response,
    save_file, ALLOWED_IMAGE_EXT
)

profile_bp = Blueprint("student_profile", __name__)


# ============================================================================
# PROFILE VIEWING
# ============================================================================

    


"""
Fixed Help Suggestions Endpoint
Suggests users who can help based on matching strong subjects with help subjects
"""

from models import OnboardingDetails  # Add this import at the top

@profile_bp.route("/profile/me/data", methods=["GET"])
@token_required
def get_my_profile_data(current_user):
    """Return full profile data for the logged-in user's own profile view."""
    try:
        profile = StudentProfile.query.filter_by(user_id=current_user.id).first()
        onboarding = OnboardingDetails.query.filter_by(user_id=current_user.id).first()

        connections_count = Connection.query.filter(
            or_(
                Connection.requester_id == current_user.id,
                Connection.receiver_id == current_user.id,
            ),
            Connection.status == "accepted",
        ).count()

        return jsonify({
            "status": "success",
            "data": {
                "id": current_user.id,
                "name": current_user.name,
                "username": current_user.username,
                "bio": current_user.bio,
                "avatar": current_user.avatar,
                "department": profile.department if profile else None,
                "class_level": profile.class_name if profile else None,
                "reputation": current_user.reputation,
                "reputation_level": current_user.reputation_level,
                "login_streak": current_user.login_streak,
                "joined_at": current_user.joined_at.isoformat(),
                "last_active": (
                    current_user.last_active.isoformat()
                    if current_user.last_active
                    else None
                ),
                "stats": {
                    "total_posts": current_user.total_posts,
                    "total_helpful": current_user.total_helpful,
                    "total_helps_given": current_user.total_helps_given,
                    "connections_count": connections_count,
                },
                "learning_goals": current_user.learning_goals or [],
                "help_streak": {
                    "current": current_user.help_streak_current,
                    "longest": current_user.help_streak_longest,
                },
                "onboarding": {
                    "subjects": onboarding.subjects if onboarding else [],
                    "strong_subjects": onboarding.strong_subjects if onboarding else [],
                    "help_subjects": onboarding.help_subjects if onboarding else [],
                    "learning_style": onboarding.learning_style if onboarding else None,
                    "study_preferences": onboarding.study_preferences if onboarding else [],
                    "class_level": onboarding.class_level if onboarding else None,
                } if onboarding else None,
            },
        })

    except Exception as e:
        current_app.logger.error(f"Get my profile data error: {str(e)}")
        return error_response("Failed to load profile data")


# ============================================================================
# GET /profile/my-posts  — User's own posts with type filter, limit 30
# ============================================================================

@profile_bp.route("/profile/my-posts", methods=["GET"])
@token_required
def get_my_posts(current_user):
    """
    Returns current user's posts.
    Query params:
      ?type=all | pinned | questions | resources | discussions
    """
    try:
        post_type_filter = request.args.get("type", "all").strip()

        query = Post.query.filter_by(student_id=current_user.id)

        if post_type_filter == "pinned":
            query = query.filter(Post.is_pinned == True)
        elif post_type_filter == "questions":
            query = query.filter(Post.post_type.in_(["question", "problem"]))
        elif post_type_filter == "resources":
            query = query.filter(Post.post_type == "resource")
        elif post_type_filter == "discussions":
            query = query.filter(Post.post_type == "discussion")

        posts = query.order_by(
            Post.is_pinned.desc(),
            Post.posted_at.desc(),
        ).limit(30).all()

        def safe_views(p):
            return getattr(p, "views", getattr(p, "views_count", 0)) or 0

        posts_data = [
            {
                "id": p.id,
                "title": p.title,
                "text_content": (
                    (p.text_content[:150] + "…")
                    if p.text_content and len(p.text_content) > 150
                    else p.text_content
                ),
                "user_reacted":PostReaction.query.filter_by(post_id=p.id,student_id=current_user.id).first() is not None,

                "post_type": p.post_type,
                "department": p.department,
                "tags": p.tags or [],
                "likes_count": getattr(p, "likes_count", 0) or 0,
                "comments_count": p.comments_count or 0,
                "views": safe_views(p),
                "is_pinned": bool(p.is_pinned),
                "is_solved": bool(p.is_solved),
                "posted_at": p.posted_at.isoformat(),
                
                "has_resources": bool(p.resources),
            }
            for p in posts
        ]

        return jsonify({
            "status": "success",
            "data": {
                "posts": posts_data,
                "total": len(posts_data),
                "filter": post_type_filter,
            },
        })

    except Exception as e:
        current_app.logger.error(f"Get my posts error: {str(e)}")
        return error_response("Failed to load posts")


# ============================================================================
# GET /profile/my-stats  — Combined activity + impact stats
# ============================================================================

@profile_bp.route("/profile/my-stats", methods=["GET"])
@token_required
def get_my_stats(current_user):
    """Comprehensive stats for the Stats tab."""
    try:
        # Thread participation
        threads_joined = ThreadMember.query.filter_by(
            student_id=current_user.id
        ).count()
        threads_created = Thread.query.filter_by(
            creator_id=current_user.id
        ).count()

        # Comments
        total_comments = Comment.query.filter_by(
            student_id=current_user.id
        ).count()
        questions_solved = Comment.query.filter_by(
            student_id=current_user.id, is_solution=True
        ).count()
        questions_answered = Comment.query.join(Post).filter(
            Comment.student_id == current_user.id,
            Post.post_type.in_(["question", "problem"]),
        ).count()

        # Resources shared
        resources_shared = Post.query.filter_by(
            student_id=current_user.id, post_type="resource"
        ).count()

        # Connections
        connections_count = Connection.query.filter(
            or_(
                Connection.requester_id == current_user.id,
                Connection.receiver_id == current_user.id,
            ),
            Connection.status == "accepted",
        ).count()

        # Reactions received on all user's posts
        reactions_received = db.session.query(func.count(PostReaction.id)).join(
            Post, PostReaction.post_id == Post.id
        ).filter(
            Post.student_id == current_user.id,
        ).scalar() or 0

        helpful_received = db.session.query(func.count(PostReaction.id)).join(
            Post, PostReaction.post_id == Post.id
        ).filter(
            Post.student_id == current_user.id,
            PostReaction.reaction_type == "helpful",
        ).scalar() or 0

        return jsonify({
            "status": "success",
            "data": {
                "posts": {
                    "total": current_user.total_posts,
                    "resources_shared": resources_shared,
                },
                "engagement": {
                    "total_comments": total_comments,
                    "reactions_received": reactions_received,
                    "helpful_received": helpful_received,
                    "questions_answered": questions_answered,
                    "questions_solved": questions_solved,
                },
                "threads": {
                    "joined": threads_joined,
                    "created": threads_created,
                },
                "help": {
                    "total_helps_given": current_user.total_helps_given,
                    "total_helps_received": current_user.total_helps_received,
                    "streak_current": current_user.help_streak_current,
                    "streak_longest": current_user.help_streak_longest,
                    "total_helpful": current_user.total_helpful,
                },
                "connections": connections_count,
                "reputation": {
                    "points": current_user.reputation,
                    "level": current_user.reputation_level,
                    "login_streak": current_user.login_streak,
                },
            },
        })

    except Exception as e:
        current_app.logger.error(f"My stats error: {str(e)}")
        return error_response("Failed to load stats")


# ============================================================================
# GET /profile/academic-info  — Onboarding / academic details
# ============================================================================

@profile_bp.route("/profile/academic-info", methods=["GET"])
@token_required
def get_academic_info(current_user):
    """Returns the current user's academic / onboarding details."""
    try:
        onboarding = OnboardingDetails.query.filter_by(
            user_id=current_user.id
        ).first()
        profile = StudentProfile.query.filter_by(
            user_id=current_user.id
        ).first()

        if not onboarding:
            return jsonify({
                "status": "success",
                "data": {
                    "department": profile.department if profile else None,
                    "class_level": profile.class_name if profile else None,
                    "subjects": [],
                    "strong_subjects": [],
                    "help_subjects": [],
                    "learning_style": None,
                    "study_preferences": [],
                },
            })

        return jsonify({
            "status": "success",
            "data": {
                "department": onboarding.department,
                "class_level": onboarding.class_level,
                "subjects": onboarding.subjects or [],
                "strong_subjects": onboarding.strong_subjects or [],
                "help_subjects": onboarding.help_subjects or [],
                "learning_style": onboarding.learning_style,
                "study_preferences": onboarding.study_preferences or [],
            },
        })

    except Exception as e:
        current_app.logger.error(f"Get academic info error: {str(e)}")
        return error_response("Failed to load academic info")


# ============================================================================
# PUT /profile/academic-info  — Update academic details
# ============================================================================

@profile_bp.route("/profile/academic-info", methods=["PUT"])
@token_required
def update_academic_info(current_user):
    """Update academic / onboarding details."""
    try:
        data = request.get_json(silent=True)
        if not data:
            return error_response("No data provided")

        onboarding = OnboardingDetails.query.filter_by(
            user_id=current_user.id
        ).first()

        if not onboarding:
            return error_response("Academic profile not found")

        changes = []

        if "subjects" in data and isinstance(data["subjects"], list):
            onboarding.subjects = data["subjects"][:15]
            changes.append("subjects")

        if "strong_subjects" in data and isinstance(data["strong_subjects"], list):
            onboarding.strong_subjects = data["strong_subjects"][:10]
            changes.append("strong_subjects")

        if "help_subjects" in data and isinstance(data["help_subjects"], list):
            onboarding.help_subjects = data["help_subjects"][:10]
            changes.append("help_subjects")

        if "learning_style" in data and data["learning_style"]:
            onboarding.learning_style = str(data["learning_style"])[:300]
            changes.append("learning_style")

        if "study_preferences" in data and isinstance(data["study_preferences"], list):
            onboarding.study_preferences = data["study_preferences"][:10]
            changes.append("study_preferences")

        onboarding.last_updated = datetime.datetime.utcnow()
        db.session.commit()

        return success_response(
            "Academic info updated",
            data={"changes": changes},
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Update academic info error: {str(e)}")
        return error_response("Failed to update academic info")
# ============================================================================

@profile_bp.route("/profile/avatar/upload", methods=["POST"])
@token_required
def upload_avatar(current_user):
    """
    Upload profile picture to Cloudinary.
    Accepts: multipart/form-data with 'avatar' file.
    """
    try:
        # Import Cloudinary helpers (same pattern as posts.py)
        try:
            from storage import cloudinary_storage, filename_service
            CLOUD_AVAILABLE = True
        except ImportError:
            CLOUD_AVAILABLE = False

        if "avatar" not in request.files:
            return error_response("No file provided")

        file = request.files["avatar"]

        if not file or not file.filename:
            return error_response("Invalid file")

        filename = secure_filename(file.filename)

        allowed = {"jpg", "jpeg", "png", "gif", "webp"}
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in allowed:
            return error_response(
                f"Invalid file type. Allowed: {', '.join(allowed)}"
            )

        if CLOUD_AVAILABLE:
            folder = f"avatars/{current_user.id}"
            generated_filename = f"avatar_{current_user.id}"

            result = cloudinary_storage.upload_file(
                file,
                folder,
                generated_filename,
                resource_type="image",
            )

            if not result.get("success"):
                return error_response(
                    f"Upload failed: {result.get('error', 'Unknown error')}"
                )

            avatar_url = result["url"]
        else:
            # Fallback: local save (existing helper)
            avatar_url = save_file(file, "avatars", ALLOWED_IMAGE_EXT)
            avatar_url = f"/static/upload/avatars/{avatar_url}"

        current_user.avatar = avatar_url
        db.session.commit()

        return success_response(
            "Avatar updated successfully",
            data={"avatar_url": avatar_url},
        )

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Avatar upload error: {str(e)}")
        return error_response("Failed to upload avatar")


# ============================================================================
# DELETE /profile/avatar  — Remove avatar (set to None)
# ============================================================================

@profile_bp.route("/profile/avatar", methods=["DELETE"])
@token_required
def remove_avatar(current_user):
    """Remove profile picture (reset to default)."""
    try:
        current_user.avatar = None
        db.session.commit()
        return success_response("Avatar removed")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Remove avatar error: {str(e)}")
        return error_response("Failed to remove avatar");

@profile_bp.route("/profile/help/suggestions", methods=["GET"])  # Fixed typo: sugguestions -> suggestions
@token_required
def help_suggestions(current_user):
    """
    Get suggestions for users who can help with subjects you need help with
    
    Matches your help_subjects with other users' strong_subjects
    Returns up to 10 users ranked by overlap
    """
    try:
        # Get current user
        user = User.query.get(current_user.id)
        if not user:
            return error_response("User not found")
        
        # Get onboarding details
        onboarding_details = OnboardingDetails.query.filter_by(user_id=user.id).first()
        
        if not onboarding_details:
            return error_response("Onboarding details not found")
        
        # Get subjects you need help with
        help_subjects = onboarding_details.help_subjects or []
        
        if not help_subjects:
            return jsonify({
                "status": "success",
                "message": "You haven't specified any subjects you need help with yet",
                "data": {
                    "suggestions": [],
                    "total": 0
                }
            })
        
        # Query all users with onboarding details (excluding current user)
        all_users = User.query.filter(
            User.id != user.id,  # Exclude self
            User.onboarding_details.has()  # Only users with onboarding details
        ).all()
        
        suggestions = []
        
        for potential_helper in all_users:
            details = potential_helper.onboarding_details
            
            if not details or not details.strong_subjects:
                continue
            
            # Calculate overlap between what you need and what they're strong at
            overlap = set(help_subjects) & set(details.strong_subjects)
            
            if len(overlap) > 0:
                # Get their student profile for department info
                profile = StudentProfile.query.filter_by(user_id=potential_helper.id).first()
                
                # Calculate match score (percentage of your help subjects they can help with)
                match_score = (len(overlap) / len(help_subjects)) * 100
                
                suggestions.append({
                    "user": {
                        "id": potential_helper.id,
                        "name": potential_helper.name,
                        "username": potential_helper.username,
                        "avatar": potential_helper.avatar,
                        "reputation": potential_helper.reputation,
                        "reputation_level": potential_helper.reputation_level
                    },
                    "profile": {
                        "department": profile.department if profile else None,
                        "class_level": profile.class_name if profile else None
                    },
                    "match_details": {
                        "can_help_with": list(overlap),  # Subjects they're strong at that you need
                        "overlap_count": len(overlap),
                        "match_score": round(match_score, 1)
                    }
                })
        
        # Sort by match score (highest first), then by reputation
        suggestions.sort(
            key=lambda x: (x["match_details"]["match_score"], x["user"]["reputation"]),
            reverse=True
        )
        
        # Limit to top 10
        suggestions = suggestions[:10]
        
        return jsonify({
            "status": "success",
            "data": {
                "your_help_subjects": help_subjects,
                "suggestions": suggestions,
                "total": len(suggestions)
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Help suggestions error: {str(e)}")
        return error_response("Error encountered while loading help suggestions")


# ============================================================================
# BONUS: Reverse endpoint - Find who YOU can help
# ============================================================================

@profile_bp.route("/profile/can-help/suggestions", methods=["GET"])
@token_required
def can_help_suggestions(current_user):
    """
    Get suggestions for users YOU can help (based on your strong subjects)
    
    Matches your strong_subjects with other users' help_subjects
    """
    try:
        user = User.query.get(current_user.id)
        if not user:
            return error_response("User not found")
        
        onboarding_details = OnboardingDetails.query.filter_by(user_id=user.id).first()
        
        if not onboarding_details:
            return error_response("Onboarding details not found")
        
        # Get subjects you're strong at
        strong_subjects = onboarding_details.strong_subjects or []
        
        if not strong_subjects:
            return jsonify({
                "status": "success",
                "message": "You haven't specified any strong subjects yet",
                "data": {
                    "suggestions": [],
                    "total": 0
                }
            })
        
        # Query users who need help
        all_users = User.query.filter(
            User.id != user.id,
            User.onboarding_details.has()
        ).all()
        
        suggestions = []
        
        for person_needing_help in all_users:
            details = person_needing_help.onboarding_details
            
            if not details or not details.help_subjects:
                continue
            
            # Calculate overlap
            overlap = set(strong_subjects) & set(details.help_subjects)
            
            if len(overlap) > 0:
                profile = StudentProfile.query.filter_by(user_id=person_needing_help.id).first()
                
                match_score = (len(overlap) / len(details.help_subjects)) * 100
                
                suggestions.append({
                    "user": {
                        "id": person_needing_help.id,
                        "name": person_needing_help.name,
                        "username": person_needing_help.username,
                        "avatar": person_needing_help.avatar,
                        "reputation": person_needing_help.reputation,
                        "reputation_level": person_needing_help.reputation_level
                    },
                    "profile": {
                        "department": profile.department if profile else None,
                        "class_level": profile.class_name if profile else None
                    },
                    "match_details": {
                        "needs_help_with": list(overlap),
                        "overlap_count": len(overlap),
                        "match_score": round(match_score, 1)
                    }
                })
        
        # Sort by match score, then reputation
        suggestions.sort(
            key=lambda x: (x["match_details"]["match_score"], x["user"]["reputation"]),
            reverse=True
        )
        
        suggestions = suggestions[:10]
        
        return jsonify({
            "status": "success",
            "data": {
                "your_strong_subjects": strong_subjects,
                "suggestions": suggestions,
                "total": len(suggestions)
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Can help suggestions error: {str(e)}")
        return error_response("Error encountered while loading suggestions")
        




@profile_bp.route("/profile/me", methods=["GET", "POST"])
@token_required
def get_own_profile(current_user):
    """
    Get current user's full profile including stats, badges, and activity.
    """
    if request.method == "GET":
        return render_template("profile/profile.html")
    try:
        # Fetch the profile
        profile = StudentProfile.query.filter_by(user_id=current_user.id).first()
        if not profile:
            return error_response("Profile not found", 404)

        # Activity stats
        total_posts = Post.query.filter_by(student_id=current_user.id).count()
        total_comments = Comment.query.filter_by(student_id=current_user.id).count()
        total_threads = ThreadMember.query.filter_by(student_id=current_user.id).count()

        # Engagement stats
        posts_liked = db.session.query(func.count(PostLike.id)).join(
            Post, PostLike.post_id == Post.id
        ).filter(Post.student_id == current_user.id).scalar() or 0

        helpful_count = db.session.query(func.count(PostReaction.id)).join(
            Post, PostReaction.post_id == Post.id
        ).filter(
            Post.student_id == current_user.id,
            PostReaction.reaction_type == "helpful"
        ).scalar() or 0

        # Badges
        user_badges = UserBadge.query.filter_by(user_id=current_user.id).join(Badge).order_by(
            UserBadge.is_featured.desc(),
            Badge.rarity.desc()
        ).limit(6).all()

        badges_data = [{
            "id": ub.badge.id,
            "name": ub.badge.name,
            "description": ub.badge.description,
            "icon": ub.badge.icon,
            "rarity": ub.badge.rarity,
            "earned_at": ub.earned_at.isoformat(),
            "is_featured": ub.is_featured
        } for ub in user_badges]

        # Recent posts
        recent_posts = Post.query.filter_by(student_id=current_user.id).order_by(
            Post.posted_at.desc()
        ).limit(5).all()
        
        
        posts_data = [{
            "id": p.id,
            "title": p.title,
            "post_type": p.post_type,
            "likes_count": p.likes_count,
            "comments_count": p.comments_count,
            "posted_at": p.posted_at.isoformat(),
            "is_pinned": p.is_pinned,
            "is_solved": p.is_solved
        } for p in recent_posts]

        # Active threads
        active_threads = db.session.query(Thread).join(
            ThreadMember, Thread.id == ThreadMember.thread_id
        ).filter(ThreadMember.student_id == current_user.id).order_by(
            Thread.last_activity.desc()
        ).limit(5).all()

        threads_data = [{
            "id": t.id,
            "title": t.title,
            "member_count": t.member_count,
            "is_creator": t.creator_id == current_user.id,
            "last_activity": t.last_activity.isoformat()
        } for t in active_threads]

        # Activity heatmap (last 30 days)
        thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)
        activity_data = UserActivity.query.filter(
            UserActivity.user_id == current_user.id,
            UserActivity.activity_date >= thirty_days_ago
        ).order_by(UserActivity.activity_date.asc()).all()

        heatmap = [{
            "date": act.activity_date.isoformat(),
            "score": act.activity_score,
            "posts": act.posts_created,
            "comments": act.comments_created
        } for act in activity_data]

        # Skills & learning goals
        skills = current_user.skills if current_user.skills else []
        learning_goals = current_user.learning_goals if current_user.learning_goals else []

        # Privacy settings
        privacy_settings = current_user.privacy_settings if current_user.privacy_settings else {}
        profile_private = privacy_settings.get("set_profile_private", False)
        show_active_status = privacy_settings.get("show_active_status", True)
        dark_mode = privacy_settings.get("set_dark_mode", False)
        send_weekly_notifications = privacy_settings.get("send_weekly_notifications", False)
        

        return jsonify({
            "status": "success",
            "data": {
                "user": {
                    "id": current_user.id,
                    "username": current_user.username,
                    "name": current_user.name,
                    "bio": current_user.bio,
                    "avatar": current_user.avatar,
                    "department": profile.department,
                    "class_level": profile.class_name,
                    "reputation": current_user.reputation,
                    "reputation_level": current_user.reputation_level,
                    "login_streak": current_user.login_streak,
                    "joined_at": current_user.joined_at.isoformat(),
                    "last_active": current_user.last_active.isoformat() if show_active_status else None,
                    "profile_private": profile_private,
                    "show_active_status": show_active_status,
                    "send_weekly_notification": send_weekly_notification,
                    "set_dark_mode": dark_mode
                },
                "stats": {
                    "total_posts": total_posts,
                    "total_comments": total_comments,
                    "total_threads": total_threads,
                    "posts_liked": posts_liked,
                    "helpful_count": helpful_count,
                    "total_helpful": current_user.total_helpful
                }, 
                "badges": badges_data,
                "active_threads": threads_data,
                "activity_heatmap": heatmap,
                "skills": skills,
                "learning_goals": learning_goals,
                "is_own_profile": True,
                "can_message": False  # messaging self not needed
            }
        })

    except Exception as e:
        current_app.logger.error(f"Get own profile error: {str(e)}")
        return error_response("Failed to load profile")

@profile_bp.route("/profile/visibility-settings", methods=["POST"])
@token_required
def visibility_settings(current_user):
    try:
        user = User.query.get(current_user.id)
        if not user:
            return error_response("User not found")
        privacy_settings = user.privacy_settings
        data = request.get_json()
        if data:
            profile_private = data.get("set_profile_private", False)
            show_active_status = data.get("show_active_status", True)
            dark_mode = data.get("set_dark_mode", False)
            send_weekly_notification = data.get("send_weekly_notification", True)
        privacy_settings["set_profile_private"] = profile_private
        privacy_settings["show_active_status"] = show_active_status
        privacy_settings["set_dark_mode"] = dark_mode
        privacy_settings["send_weekly_notification"] = send_weekly_notification
        user.privacy_settings = privacy_settings
        db.session.commit()
        return success_response("Visibility settings saved successfully")
    except Exception as e:
        current_app.logger.error(f"Privacy setttings error: {str(e)}")
        return error_response("Failed to set profile visibility settings")
        
   
@profile_bp.route("/profile/visibility-settings", methods=["GET"])
@token_required
def get_visibility_settings(current_user):
    try:
        user = User.query.get(current_user.id)
        if not user:
            return error_response("User not found")
        privacy_settings = user.privacy_settings
        profile_private = privacy_settings.get("set_profile_private", False)
        show_active_status = privacy_settings.get("show_active_status", True)
        dark_mode = privacy_settings.get("set_dark_mode", False)
        weekly_notifications = privacy_settings.get("send_weekly_notification")
        return jsonify({"status": "success", "data": {"set_profile_private": profile_private, "show_active_status": show_active_status, "set_dark_mode": dark_mode, "send_weekly_summary": weekly_summary}})
    except Exception as e:
        current_app.logger.error(f"Profile visibility error: {str(e)}")
        return error_response("Failed to load profile visibility settings")
        
        

@profile_bp.route("/profile/<username>", methods=["GET"])
@token_required
def view_profile(current_user, username):
    """
    View any user's profile - complete stats and activity
    
    Frontend gets:
    - Basic info (name, bio, department, avatar)
    - Stats (posts, threads, reputation, streak)
    - Badges earned
    - Recent activity
    - Active threads
    - Connection status with viewer
    """
    try:
        # Find user by username
        user = User.query.filter_by(username=username).first()
        if not user:
            return error_response("User not found")
        
        profile = StudentProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return error_response("Profile not found")
        
        # Check connection status with current viewer
        connection_status = "none"  # none, pending_sent, pending_received, connected
        #Checking if the user is current user then i redirect to its profile page directly
        if current_user.id != user.id:
            connection = Connection.query.filter(
            or_(
            and_(Connection.requester_id == current_user.id, Connection.receiver_id == user.id),
            and_(Connection.requester_id == user.id, Connection.receiver_id == current_user.id))
            ).first()
            if connection:
                if connection.status == "accepted":
                    connection_status = "connected"
                elif connection.status == "blocked":
                    connection_status = "accepted"
                elif connection.status == "pending" and connection.requester_id == current_user.id:
                    connection_status = "pending sent"
                elif connection.status == "pending"  and connection.receiver_id == current_user.id:
                    connection.status = "peding_received"
        # Activity stats
        total_posts = Post.query.filter_by(student_id=user.id).count()
        total_comments = Comment.query.filter_by(student_id=user.id).count()
        total_threads = ThreadMember.query.filter_by(student_id=user.id).count()
        posts_liked = db.session.query(func.count(PostLike.id)).join(
            Post, PostLike.post_id == Post.id
        ).filter(Post.student_id == user.id).scalar() or 0
        
        helpful_count = db.session.query(func.count(PostReaction.id)).join(
            Post, PostReaction.post_id == Post.id
        ).filter(
            Post.student_id == user.id,
            PostReaction.reaction_type == "helpful"
        ).scalar() or 0
        
        # Badges (show featured first, then by rarity)
        user_badges = UserBadge.query.filter_by(user_id=user.id).join(Badge).order_by(
            UserBadge.is_featured.desc(),
            Badge.rarity.desc()
        ).limit(6).all()
        
        badges_data = [{
            "id": ub.badge.id,
            "name": ub.badge.name,
            "description": ub.badge.description,
            "icon": ub.badge.icon,
            "rarity": ub.badge.rarity,
            "earned_at": ub.earned_at.isoformat(),
            "is_featured": ub.is_featured
        } for ub in user_badges]
        
        pinned_posts = Post.query.filter_by(student_id=user.id, is_pinned=True).all()
       
        
        # Recent posts (last 5)
        recent_posts = Post.query.filter_by(student_id=user.id).order_by(
            Post.is_pinned.desc(),
            Post.posted_at.desc()
        ).limit(5).all()
        
        posts_data = [{
            "id": p.id,
            "title": p.title,
            "post_type": p.post_type,
            "likes_count": p.likes_count,
            "comments_count": p.comments_count,
            "posted_at": p.posted_at.isoformat(),
            "is_solved": p.is_solved
        } for p in recent_posts]
        
        total_created_threads = Thread.query.filter_by(creator_id = user.id).count()
        
        # Active threads
        active_threads = db.session.query(Thread).join(
            ThreadMember, Thread.id == ThreadMember.thread_id
        ).filter(ThreadMember.student_id == user.id).order_by(
            Thread.last_activity.desc()
        ).limit(5).all()
        
        
        threads_data = [{
            "id": t.id,
            "title": t.title,
            "member_count": t.member_count,
            "is_creator": t.creator_id == user.id,
            "last_activity": t.last_activity.isoformat()
        } for t in active_threads]
        
        # Activity heatmap (last 30 days)
        thirty_days_ago = datetime.date.today() - datetime.timedelta(days=30)
        activity_data = UserActivity.query.filter(
            UserActivity.user_id == user.id,
            UserActivity.activity_date >= thirty_days_ago
        ).order_by(UserActivity.activity_date.asc()).all()
        
        heatmap = [{
            "date": act.activity_date.isoformat(),
            "score": act.activity_score,
            "posts": act.posts_created,
            "comments": act.comments_created
        } for act in activity_data]
        
        # Skills & learning goals
        skills = user.skills if user.skills else []
        learning_goals = user.learning_goals if user.learning_goals else []
        
        # Privacy check - respect user's privacy settings
        privacy_settings = user.privacy_settings if user.privacy_settings else {}
        profile_private = privacy_settings.get("profile_private", False)
        show_active_status = privacy_settings.get("show_active_status", True)
        dark_mode = privacy_settings.get("set_dark_mode", False)
        send_weekly_notifications = privacy_settings.get("send_weekly_notification")
        
        # If profile is private and not connected, hide details
        if profile_private:
            return jsonify({
                "status": "success",
                "message": "This profile is private — only a few details are visible to you.",
                "data": {
                     "type": "private",    
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "name": user.name,
                        "avatar": user.avatar,
                        "department": profile.department,
                        "pinned_posts": pinned_posts, 
                        "class_level": profile.class_name
                    },
                    "privacy": {
                        "is_private": True,
                        "message": "This profile is private. Connect to view details."
                    },
                    "connection_status": connection_status,
                    "last_active": user.last_active.isoformat() if show_active_status else None,
                    "is_own_profile": False
                }
            })
        # Full profile data
        return jsonify({
            "status": "success",
            "data": {
            "type": "public",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "name": user.name,
                    "bio": user.bio,
                    "avatar": user.avatar,
                    "department": profile.department,
                    "class_level": profile.class_name,
                    "reputation": user.reputation,
                    "reputation_level": user.reputation_level,
                    "login_streak": user.login_streak ,
                    "joined_at": user.joined_at.isoformat(),
                    "last_active": user.last_active.isoformat(),
                    "active_status": show_active_status,     
                },
                "stats": {
                    "total_posts": total_posts,
                    "total_comments": total_comments,
                    "total_threads": total_threads,
                    "total_created_threads": total_created_threads,
                    "posts_liked": posts_liked,
                    "helpful_count": helpful_count,
                    "total_helpful": user.total_helpful
                },
                "badges": badges_data,
                "recent_posts": posts_data,
                "active_threads": threads_data,
                "activity_heatmap": heatmap,
                "skills": skills,
                "learning_goals": learning_goals,
                "connection_status": connection_status,
                "is_own_profile": False
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"View profile error: {str(e)}")
        return error_response("Failed to load profile")
        

# ============================================================================
# PROFILE EDITING
# ============================================================================

@profile_bp.route("/profile/update", methods=["PATCH"])
@token_required
def update_profile(current_user):
    """
    Update profile info: name, bio, department, class
    
    Accepts JSON or form data:
    - name: Full name
    - bio: Short bio (max 500 chars)
    - department: Department (must be valid)
    - class_level: Class level
    """
    try:
        data = request.get_json(silent=True) or request.form.to_dict()
        profile = StudentProfile.query.filter_by(user_id=current_user.id).first()
        
        if not profile:
            return error_response("Profile not found", 404)
        
        changes = []
        
        # Update name
        if "name" in data and data["name"].strip():
            new_name = data["name"].strip()
            if len(new_name) < 3:
                return error_response("Name must be at least 3 characters")
            if new_name != current_user.name:
                current_user.name = new_name
                profile.full_name = new_name
                changes.append("name")
        
        # Update bio
        if "bio" in data:
            new_bio = data["bio"].strip()
            if len(new_bio) > 500:
                return error_response("Bio must be less than 500 characters")
            if new_bio != current_user.bio:
                current_user.bio = new_bio
                changes.append("bio")
        
        # Update department (validate against allowed list)
        if "department" in data and data["department"].strip():
            new_dept = data["department"].strip()
            # You can add validation here against DEPARTMENTS list
            if new_dept != profile.department:
                profile.department = new_dept
                changes.append("department")
        
        # Update class level
        if "class_level" in data and data["class_level"].strip():
            new_class = data["class_level"].strip()
            # Validate against CLASS_LEVELS
            if new_class != profile.class_name:
                profile.class_name = new_class
                changes.append("class_level")
        
        if changes:
            db.session.commit()
            return success_response(
                "Profile updated successfully",
                data={
                    "changes": changes,
                    "user": {
                        "name": current_user.name,
                        "bio": current_user.bio,
                        "department": profile.department,
                        "class_level": profile.class_name
                    }
                }
            )
        else:
            return success_response("No changes made")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Profile update error: {str(e)}")
        return error_response("Failed to update profile")







# ============================================================================
# SKILLS & LEARNING GOALS
# ============================================================================

@profile_bp.route("/profile/skills", methods=["POST"])
@token_required
def add_skill(current_user):
    """
    Add a skill to profile
    
    Body: {"skill": "Python"}
    """
    try:
        data = request.get_json()
        skill = data.get("skill", "").strip()
        
        if not skill:
            return error_response("Skill name required")
        
        if len(skill) > 50:
            return error_response("Skill name too long (max 50 chars)")
        
        # Get current skills
        skills = current_user.skills if current_user.skills else []
        
        # Check if already exists (case-insensitive)
        if any(s.lower() == skill.lower() for s in skills):
            return error_response("Skill already added")
        
        # Limit to 10 skills
        if len(skills) >= 10:
            return error_response("Maximum 10 skills allowed")
        
        skills.append(skill)
        current_user.skills = skills
        
        db.session.commit()
        
        return success_response(
            "Skill added",
            data={"skills": skills}
        ), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Add skill error: {str(e)}")
        return error_response("Failed to add skill")


@profile_bp.route("/profile/skills/<skill_name>", methods=["DELETE"])
@token_required
def remove_skill(current_user, skill_name):
    """
    Remove a skill from profile
    """
    try:
        skills = current_user.skills if current_user.skills else []
        
        # Remove skill (case-insensitive)
        skills = [s for s in skills if s.lower() != skill_name.lower()]
        
        current_user.skills = skills
        db.session.commit()
        
        return success_response(
            "Skill removed",
            data={"skills": skills}
        )
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Remove skill error: {str(e)}")
        return error_response("Failed to remove skill")


@profile_bp.route("/profile/learning-goals", methods=["POST"])
@token_required
def add_learning_goal(current_user):
    """
    Add learning goal to profile
    
    Body: {"goal": "Learn Machine Learning"}
    """
    try:
        data = request.get_json()
        goal = data.get("goal", "").strip()
        
        if not goal:
            return error_response("Goal required")
        
        if len(goal) > 100:
            return error_response("Goal too long (max 100 chars)")
        
        goals = current_user.learning_goals if current_user.learning_goals else []
        
        if goal in goals:
            return error_response("Goal already added")
        
        if len(goals) >= 5:
            return error_response("Maximum 5 learning goals allowed")
        
        goals.append(goal)
        current_user.learning_goals = goals
        
        db.session.commit()
        
        return success_response(
            "Learning goal added",
            data={"learning_goals": goals}
        ), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Add goal error: {str(e)}")
        return error_response("Failed to add goal")


@profile_bp.route("/profile/learning-goals/<int:index>", methods=["DELETE"])
@token_required
def remove_learning_goal(current_user, index):
    """
    Remove learning goal by index
    """
    try:
        goals = current_user.learning_goals if current_user.learning_goals else []
        
        if index < 0 or index >= len(goals):
            return error_response("Invalid goal index")
        
        goals.pop(index)
        current_user.learning_goals = goals
        
        db.session.commit()
        
        return success_response(
            "Learning goal removed",
            data={"learning_goals": goals}
        )
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Remove goal error: {str(e)}")
        return error_response("Failed to remove goal")


# ============================================================================
# FEATURED POST
# ============================================================================

@profile_bp.route("/profile/pin-post/<int:post_id>", methods=["POST"])
@token_required
def pin_post(current_user, post_id):
    """
    Pin a post to profile as featured content
    """
    try:
        # Verify post belongs to user
        post = Post.query.filter_by(id=post_id, student_id=current_user.id).first()
        total_pinned = Post.query.filter_by(student_id = current_user.id, is_pinned = True).count()
        
        if not post:
            return error_response("Post not found or not yours")
        if post.is_pinned:
            return success_response("Post has already been pinned")
        if total_pinned >= 5:
            return error_response("You cant pin more than 5 posts kindly a post")
        
            
        post.is_pinned = True
        
        db.session.commit()
        
        return success_response("Post pinned successfully")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Pin post error: {str(e)}")
        return error_response("Failed to pin post")

@profile_bp.route("/profile/unpin-post/<int:post_id>", methods=["POST"])
@token_required
def unpin_post(current_user, post_id):
    """
    Pin a post to profile as featured content
    """
    try:
        # Verify post belongs to user
        post = Post.query.filter_by(id=post_id, student_id=current_user.id).first()
        
        if not post:
            return error_response("Post not found or not yours")
        post.is_pinned = False
        db.session.commit()
        
        
        return success_response("Post unpinned successfully")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Unpin post error: {str(e)}")
        return error_response("Failed to un:pin post")



@profile_bp.route("/profile/study-schedule", methods=["GET"])
@token_required
def get_study_schedule(current_user):
    """
    Get user's study schedule (when they're usually online)
    
    Returns: {
        "monday": ["morning", "evening"],
        "tuesday": ["afternoon"],
        ...
    }
    """
    schedule = current_user.study_schedule if current_user.study_schedule else {}
    
    # Default empty schedule
    default_schedule = {
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": []
    }
    
    return jsonify({
        "status": "success",
        "data": {
            "study_schedule": {**default_schedule, **schedule}
        }
    })


@profile_bp.route("/profile/study-schedule", methods=["POST"])
@token_required
def update_study_schedule(current_user):
    """
    Update study schedule
    
    Body: {
        "monday": ["morning", "evening"],
        "wednesday": ["afternoon"],
        "friday": ["evening", "night"]
    }
    
    Time slots: morning (6am-12pm), afternoon (12pm-6pm), evening (6pm-10pm), night (10pm-2am)
    """
    try:
        data = request.get_json()
        
        if not isinstance(data, dict):
            return error_response("Schedule must be an object")
        
        valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        valid_times = ["morning", "afternoon", "evening", "night"]
        
        schedule = {}
        
        for day, times in data.items():
            day_lower = day.lower()
            
            if day_lower not in valid_days:
                return error_response(f"Invalid day: {day}")
            
            if not isinstance(times, list):
                return error_response(f"Times for {day} must be a list")
            
            # Validate time slots
            for time in times:
                if time not in valid_times:
                    return error_response(f"Invalid time slot: {time}")
            
            schedule[day_lower] = times
        
        current_user.study_schedule = schedule
        db.session.commit()
        
        return success_response(
            "Study schedule updated",
            data={"study_schedule": schedule}
        )
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Update study schedule error: {str(e)}")
        return error_response("Failed to update study schedule")

@profile_bp.route("/skills/popular", methods=["GET"])
def get_popular_skills():
    """
    Get list of popular skills across all users
    Used for autocomplete/suggestions in frontend
    
    No auth required - public endpoint
    """
    try:
        # Aggregate all skills from all users
        users = User.query.filter(User.skills.isnot(None)).all()
        
        skill_counts = {}
        for user in users:
            if user.skills:
                for skill in user.skills:
                    skill_lower = skill.lower()
                    if skill_lower in skill_counts:
                        skill_counts[skill_lower]["count"] += 1
                    else:
                        skill_counts[skill_lower] = {
                            "name": skill,
                            "count": 1
                        }
        
        # Sort by popularity
        popular_skills = sorted(
            skill_counts.values(),
            key=lambda x: x["count"],
            reverse=True
        )[:50]  # Top 50 skills
        
        return jsonify({
            "status": "success",
            "data": {
                "skills": [s["name"] for s in popular_skills],
                "detailed": popular_skills
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Get popular skills error: {str(e)}")
        return error_response("Failed to load skills")

@profile_bp.route("/profile/homepage", methods=["GET"])
def homepage():
    return render_template('post/feed2.html')
    

       