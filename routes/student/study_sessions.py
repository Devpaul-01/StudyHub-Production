# ============================================================================
# STUDY SESSION SCHEDULING
# ============================================================================
from flask import Blueprint, request, jsonify, current_app, Response, stream_with_context
from sqlalchemy import or_, and_, func, desc
import datetime
import os

from models import (
    User, Message, Connection, Notification, ThreadMember,
    StudySessionCalendar, LiveStudySession, ConversationAnalytics
)
from extensions import db
from utils import limiter
from routes.student.helpers import (
    token_required, success_response, error_response,
    save_file, ALLOWED_IMAGE_EXT, ALLOWED_DOCUMENT_EXT
)
from utils import can_message

study_sessions_bp = Blueprint("study_sessions", __name__)

"""
ENHANCED STUDY SESSION ENDPOINTS
Add these to your existing study_sessions.py file

These are ADDITIONAL endpoints to add, not replacements
"""

from flask import Blueprint, request, jsonify, current_app
import datetime

from models import LiveStudySession, Assignment, User
from extensions import db
from routes.student.helpers import token_required, success_response, error_response


# ============================================================================
# SESSION GOALS & PROGRESS TRACKING (NEW)
# ============================================================================

@study_sessions_bp.route("/live-session/<int:session_id>/set-goal", methods=["POST"])
@token_required
def set_session_goal(current_user, session_id):
    """
    Set goal for study session BEFORE or DURING session
    
    Body: {
        "session_goal": "Complete 10 calculus problems",
        "target_count": 10,
        "assignment_id": 123  // optional
    }
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        data = request.get_json()
        
        session.session_goal = data.get("session_goal", "").strip()
        session.target_count = data.get("target_count", 0)
        session.assignment_id = data.get("assignment_id")
        
        db.session.commit()
        
        # Notify partner via WebSocket
        partner_id = session.user2_id if session.user1_id == current_user.id else session.user1_id
        from websocket_events import ws_manager
        
        if partner_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'session_goal_set',
                {
                    'session_id': session_id,
                    'session_goal': session.session_goal,
                    'target_count': session.target_count,
                    'set_by': current_user.name
                },
                room=f"user_{partner_id}"
            )
        
        return success_response("Session goal set!")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Set session goal error: {str(e)}")
        return error_response("Failed to set goal")


@study_sessions_bp.route("/live-session/<int:session_id>/update-progress", methods=["POST"])
@token_required
def update_session_progress(current_user, session_id):
    """
    Update progress during session (increment completed count)
    
    Body: {
        "completed_count": 7,  // New total
        "quick_note": "Problem 5 was tricky"  // Optional
    }
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        if session.status != "active":
            return error_response("Session is not active", 400)
        
        data = request.get_json()
        
        session.completed_count = data.get("completed_count", session.completed_count)
        
        # Append to quick notes if provided
        if data.get("quick_note"):
            current_notes = session.quick_notes or ""
            timestamp = datetime.datetime.utcnow().strftime("%H:%M")
            new_note = f"[{timestamp}] {data['quick_note']}\n"
            session.quick_notes = current_notes + new_note
        
        db.session.commit()
        
        # Broadcast progress update
        from websocket_events import ws_manager
        ws_manager.socketio.emit(
            'session_progress_updated',
            {
                'session_id': session_id,
                'completed_count': session.completed_count,
                'target_count': session.target_count,
                'progress_percentage': int((session.completed_count / session.target_count * 100)) if session.target_count else 0,
                'updated_by': current_user.name
            },
            room=f"live_session_{session_id}"
        )
        
        return success_response("Progress updated!")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Update progress error: {str(e)}")
        return error_response("Failed to update progress")


@study_sessions_bp.route("/live-session/<int:session_id>/rate", methods=["POST"])
@token_required
def rate_session(current_user, session_id):
    """
    Simple thumbs up/down rating after session
    
    Body: {
        "rating": "thumbs_up" | "thumbs_down"
    }
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        if session.status != "ended":
            return error_response("Can only rate completed sessions", 400)
        
        data = request.get_json()
        rating = data.get("rating")
        
        if rating not in ["thumbs_up", "thumbs_down"]:
            return error_response("Invalid rating")
        
        # Set rating for current user
        if session.user1_id == current_user.id:
            session.rating_user1 = rating
        else:
            session.rating_user2 = rating
        
        db.session.commit()
        
        return success_response("Thanks for rating!")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Rate session error: {str(e)}")
        return error_response("Failed to rate session")


# ============================================================================
# POMODORO TIMER CONTROL (SIMPLIFIED)
# ============================================================================

@study_sessions_bp.route("/live-session/<int:session_id>/pomodoro/start", methods=["POST"])
@token_required
def start_pomodoro(current_user, session_id):
    """
    Start a Pomodoro cycle (25 min focus)
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        if session.status != "active":
            return error_response("Session is not active", 400)
        
        session.current_pomodoro_state = "focus"
        session.timer_started_at = datetime.datetime.utcnow()
        session.timer_is_running = True
        
        db.session.commit()
        
        # Broadcast to both users
        from websocket_events import ws_manager
        ws_manager.socketio.emit(
            'pomodoro_started',
            {
                'session_id': session_id,
                'started_by': current_user.name,
                'started_at': session.timer_started_at.isoformat(),
                'duration_minutes': 25
            },
            room=f"live_session_{session_id}"
        )
        
        return success_response("Pomodoro started! Focus for 25 minutes 🎯")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Start pomodoro error: {str(e)}")
        return error_response("Failed to start pomodoro")


@study_sessions_bp.route("/live-session/<int:session_id>/pomodoro/break", methods=["POST"])
@token_required
def start_break(current_user, session_id):
    """
    Start break (5 min)
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        # Increment cycle count
        session.pomodoro_cycles_completed += 1
        session.current_pomodoro_state = "break"
        session.timer_started_at = datetime.datetime.utcnow()
        
        db.session.commit()
        
        # Broadcast
        from websocket_events import ws_manager
        ws_manager.socketio.emit(
            'pomodoro_break_started',
            {
                'session_id': session_id,
                'cycles_completed': session.pomodoro_cycles_completed,
                'break_duration_minutes': 5
            },
            room=f"live_session_{session_id}"
        )
        
        return success_response("Take a 5 minute break! ☕")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Start break error: {str(e)}")
        return error_response("Failed to start break")


# ============================================================================
# SESSION TEMPLATES (NEW)
# ============================================================================

@study_sessions_bp.route("/study-session/templates", methods=["GET"])
@token_required
def get_session_templates(current_user):
    """
    Get pre-made session templates
    """
    templates = [
        {
            "id": "exam_prep",
            "name": "Exam Prep Session",
            "description": "Review concepts and practice problems for upcoming exam",
            "duration_minutes": 120,
            "default_goal": "Review 3 chapters and solve practice problems",
            "suggested_structure": "Review → Practice → Q&A",
            "icon": "📚"
        },
        {
            "id": "homework_help",
            "name": "Homework Help",
            "description": "Work through assignment together",
            "duration_minutes": 60,
            "default_goal": "Complete homework problems",
            "suggested_structure": "Work together → Review answers",
            "icon": "✍️"
        },
        {
            "id": "concept_review",
            "name": "Concept Review",
            "description": "Deep dive into understanding concepts",
            "duration_minutes": 90,
            "default_goal": "Master key concepts",
            "suggested_structure": "Explain → Examples → Practice",
            "icon": "🎯"
        },
        {
            "id": "quick_study",
            "name": "Quick Study Sprint",
            "description": "Short focused session",
            "duration_minutes": 30,
            "default_goal": "Quick review or solve 5 problems",
            "suggested_structure": "Focus → Quick review",
            "icon": "⚡"
        }
    ]
    
    return jsonify({
        "status": "success",
        "data": {
            "templates": templates
        }
    })


@study_sessions_bp.route("/study-session/schedule-with-template", methods=["POST"])
@token_required
def schedule_session_with_template(current_user):
    """
    Schedule session using a template
    
    Body: {
        "template_id": "exam_prep",
        "partner_id": 123,
        "subject": "Calculus",
        "proposed_times": ["2024-12-20T14:00:00"],
        "assignment_id": 456  // optional
    }
    """
    try:
        data = request.get_json()
        
        template_id = data.get("template_id")
        partner_id = data.get("partner_id")
        
        if not template_id or not partner_id:
            return error_response("Template and partner required")
        
        # Get template defaults (from above templates list)
        template_defaults = {
            "exam_prep": {"duration": 120, "goal": "Review 3 chapters and solve practice problems"},
            "homework_help": {"duration": 60, "goal": "Complete homework problems"},
            "concept_review": {"duration": 90, "goal": "Master key concepts"},
            "quick_study": {"duration": 30, "goal": "Quick review or solve 5 problems"}
        }.get(template_id, {"duration": 60, "goal": "Study session"})
        
        # Create session using template
        from models import StudySessionCalendar
        
        session = StudySessionCalendar(
            requester_id=current_user.id,
            receiver_id=partner_id,
            title=data.get("title", f"{template_id.replace('_', ' ').title()} Session"),
            subject=data.get("subject", ""),
            description=template_defaults["goal"],
            duration_minutes=template_defaults["duration"],
            proposed_times=data.get("proposed_times", []),
            template_used=template_id
        )
        
        db.session.add(session)
        db.session.commit()
        
        # Notify partner
        from websocket_events import ws_manager
        from models import Notification
        
        if partner_id in ws_manager.online_users:
            partner = User.query.get(partner_id)
            ws_manager.socketio.emit(
                'study_session_requested',
                {
                    'session_id': session.id,
                    'from': current_user.name,
                    'title': session.title,
                    'template': template_id
                },
                room=f"user_{partner_id}"
            )
        
        notification = Notification(
            user_id=partner_id,
            title="Study Session Request",
            body=f"{current_user.name} wants to schedule a {template_id.replace('_', ' ')} session",
            notification_type="study_session_request",
            related_type="study_session",
            related_id=session.id
        )
        db.session.add(notification)
        db.session.commit()
        
        return success_response(
            "Session request sent!",
            data={"session_id": session.id}
        ), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Schedule with template error: {str(e)}")
        return error_response("Failed to schedule session")


# ============================================================================
# ASSIGNMENT INTEGRATION
# ============================================================================

@study_sessions_bp.route("/live-session/<int:session_id>/link-assignment", methods=["POST"])
@token_required
def link_assignment_to_session(current_user, session_id):
    """
    Link an assignment to active study session
    Updates time spent on assignment
    
    Body: {
        "assignment_id": 123
    }
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        data = request.get_json()
        assignment_id = data.get("assignment_id")
        
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return error_response("Assignment not found", 404)
        
        if assignment.user_id != current_user.id:
            return error_response("Not your assignment", 403)
        
        # Link assignment
        session.assignment_id = assignment_id
        
        # Add session to assignment's linked sessions
        if not assignment.linked_session_ids:
            assignment.linked_session_ids = []
        if session_id not in assignment.linked_session_ids:
            assignment.linked_session_ids.append(session_id)
        
        db.session.commit()
        
        return success_response("Assignment linked to session")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Link assignment error: {str(e)}")
        return error_response("Failed to link assignment")


@study_sessions_bp.route("/study-session/<int:session_id>/details", methods=["GET"])
@token_required
def get_study_session_details(current_user, session_id):
    """
    Get single study session details
    Returns the same format as the /all endpoint for consistency
    """
    try:
      
        session = StudySessionCalendar.query.get(session_id)
       
        
        if not session:
            return error_response("Session not found", 404)
        
      
        
        # Get partner info
        other_user_id = session.receiver_id if session.requester_id == current_user.id else session.requester_id
        other_user = User.query.get(other_user_id)
        
        # Calculate time until session (if confirmed)
        time_until = None
        minutes_until = None
        if session.confirmed_time:
            now = datetime.datetime.utcnow()
            time_until = session.confirmed_time - now
            minutes_until = int(time_until.total_seconds() / 60)
        
        session_data = {
            "id": session.id,
            "title": session.title,
            "subject": session.subject,
            "description": session.description,
            "status": session.status,
            "duration_minutes": session.duration_minutes,
            "proposed_times": session.proposed_times,
            "confirmed_time": session.confirmed_time.isoformat() if session.confirmed_time else None,
            "requester_notes": session.requester_notes,
            "receiver_notes": session.receiver_notes,
            "requester_resources": session.requester_resources,
            "receiver_resources": session.receiver_resources,
            "created_at": session.created_at.isoformat(),
            "confirmed_at": session.confirmed_at.isoformat() if session.confirmed_at else None,
            "minutes_until": minutes_until,
            "is_upcoming": minutes_until > 0 if minutes_until else False,
            "is_soon": minutes_until <= 60 if minutes_until else False,
            "am_requester": session.requester_id == current_user.id,
            "partner": {
                "id": other_user.id,
                "username": other_user.username,
                "name": other_user.name,
                "avatar": other_user.avatar
            } if other_user else None,
            "can_confirm": session.receiver_id == current_user.id and session.status in ["pending", "rescheduled"],
            "can_reschedule": session.status in ["pending", "confirmed"],
            "can_cancel": session.status in ["pending", "confirmed", "rescheduled"]
        }
        
        return jsonify({
            "status": "success",
            "data": session_data
        })
        
    except Exception as e:
        current_app.logger.error(f"Get study session details error: {str(e)}")
        return error_response("Failed to load session details")


@study_sessions_bp.route("/study-session/<int:session_id>/reschedule", methods=["POST"])
@token_required
def edit_study_session(current_user, session_id):
    try:
        session = StudySessionCalendar.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.requester_id != current_user.id:
            return error_response("Only requester can edit session", 403)
        
        if session.status not in ["pending", "confirmed", "rescheduled"]:
            return error_response("Cannot edit this session", 400)
        
        data = request.get_json()
        times_changed = False
        
        # Update title
        if "title" in data:
            session.title = data.get("title", "Study Session").strip()
        
        # Update subject
        if "subject" in data:
            session.subject = data.get("subject", "").strip()
        
        # Update resources - FIXED
        if 'receiver_resources' in data:
            session.receiver_resources = data.get('receiver_resources', [])
        
        if 'requester_resources' in data:
            session.requester_resources = data.get('requester_resources', [])
        
        # Update description
        if "description" in data:
            session.description = data.get("description", "").strip()
        
        # Update duration
        if "duration_minutes" in data:
            session.duration_minutes = data.get("duration_minutes", 30)
        
        # Update notes
        if "requester_notes" in data:
            session.requester_notes = data.get("requester_notes", "")
        
        # Update proposed times if provided
        if "proposed_times" in data:
            proposed_times = data.get("proposed_times", [])
            
            if not proposed_times:
                return error_response("At least one proposed time required")
            
            validated_times = []
            for time_str in proposed_times:
                try:
                    dt = datetime.datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    validated_times.append(dt)
                except ValueError:
                    pass
            
            if not validated_times:
                return error_response("Invalid time format")
            
            old_times = set(session.proposed_times or [])
            new_times = set([t.isoformat() for t in validated_times])
            
            if old_times != new_times:
                times_changed = True
                session.proposed_times = [t.isoformat() for t in validated_times]
                
                if session.status == "confirmed":
                    session.status = "rescheduled"
                    session.confirmed_time = None
        
        db.session.commit()
        
        # Notify receiver via WebSocket
        from websocket_events import ws_manager
        
        if session.receiver_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'study_session_updated',
                {
                    'session_id': session.id,
                    'title': session.title,
                    'subject': session.subject,
                    'proposed_times': session.proposed_times,
                    'times_changed': times_changed,
                    'status': session.status,
                    'updated_by': current_user.name
                },
                room=f"user_{session.receiver_id}"
            )
        
        return success_response(
            "Study session updated" if not times_changed else "Study session updated - needs re-confirmation",
            data={
                "session_id": session.id,
                "times_changed": times_changed,
                "status": session.status
            }
        )
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Edit study session error: {str(e)}")
        return error_response("Failed to edit session")


        
@study_sessions_bp.route("/study-session/<int:session_id>/cancel", methods=["POST"])
@token_required
def cancel_study_session(current_user, session_id):
    """
    Cancel a scheduled study session (requester only)
    
    Body: {
        "reason": "Can't make it anymore" (optional)
    }
    """
    try:
        session = StudySessionCalendar.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        # Only requester can cancel
        if session.requester_id != current_user.id:
            return error_response("Only requester can cancel", 403)
        
        # Check if session can be cancelled
        if session.status not in ["pending", "confirmed", "rescheduled"]:
            return error_response("Cannot cancel this session", 400)
        
        data = request.get_json() or {}
        cancel_reason = data.get("reason", "").strip()
        
        # Update session status
        session.status = "cancelled"
        session.cancelled_at = datetime.datetime.utcnow()
        session.cancelled_by = current_user.id
        session.cancel_reason = cancel_reason
        
        db.session.commit()
        
        # Notify receiver via WebSocket
        from websocket_events import ws_manager
        
        if session.receiver_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'study_session_cancelled',
                {
                    'session_id': session.id,
                    'cancelled_by': current_user.name,
                    'reason': cancel_reason,
                    'title': session.title
                },
                room=f"user_{session.receiver_id}"
            )
        
        return success_response("Study session cancelled")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Cancel study session error: {str(e)}")
        return error_response("Failed to cancel session")
        


@study_sessions_bp.route("/study-session/<int:session_id>/decline", methods=["POST"])
@token_required
def decline_study_session(current_user, session_id):
    """
    Decline a pending/rescheduled study session OR withdraw from confirmed session (receiver only)
    
    Body: {
        "reason": "Busy that week" (optional)
    }
    """
    try:
        session = StudySessionCalendar.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        # Only receiver can decline/withdraw
        if session.receiver_id != current_user.id:
            return error_response("Only receiver can decline or withdraw", 403)
        
        # Can decline pending/rescheduled OR withdraw from confirmed
        if session.status not in ["pending", "rescheduled", "confirmed"]:
            return error_response("Cannot decline or withdraw from this session", 400)
        
        data = request.get_json() or {}
        decline_reason = data.get("reason", "").strip()
        
        # Determine if it's a decline or withdrawal
        is_withdrawal = session.status == "confirmed"
        
        # Update session status
        session.status = "declined"
        session.cancelled_at = datetime.datetime.utcnow()
        session.cancelled_by = current_user.id
        session.decline_reason = decline_reason
        
        db.session.commit()
        
        # Notify requester via WebSocket
        from websocket_events import ws_manager
        
        if session.requester_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'study_session_declined',
                {
                    'session_id': session.id,
                    'declined_by': current_user.name,
                    'is_withdrawal': is_withdrawal,
                    'reason': decline_reason,
                    'title': session.title
                },
                room=f"user_{session.requester_id}"
            )
        
        action_text = "withdrew from" if is_withdrawal else "declined"
        return success_response(f"Study session {action_text}")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Decline study session error: {str(e)}")
        return error_response("Failed to decline session")

@study_sessions_bp.route("/study-session/request", methods=["POST"])
@token_required
def request_study_session(current_user):
    """
    Request a study session with scheduling
    
    Body: {
        "receiver_id": 123,
        "title": "Calculus study session",
        "subject": "Calculus",
        "description": "Go over derivatives",
        "proposed_times": ["2025-01-20T15:00:00Z", "2025-01-20T18:00:00Z"],
        "duration_minutes": 60,
        "resources": [],
        "notes": ""
    }
    """
    try:
        data = request.get_json()
        receiver_id = data.get("receiver_id")
        title = data.get("title", "Study Session").strip()
        subject = data.get("subject", "").strip()
        description = data.get("description", "").strip()
        proposed_times = data.get("proposed_times", [])
        duration_minutes = data.get("duration_minutes", 30)
        resources = data.get('resources', [])
        notes = data.get('notes', '')
        
        if not receiver_id:
            return error_response("receiver_id required")
        
        if not can_message(current_user.id, receiver_id):
            return error_response("Must be connected to request session", 403)
        
        if not proposed_times:
            return error_response("At least one proposed time required")
        
        # Validate proposed times
        validated_times = []
        for time_str in proposed_times:
            try:
                dt = datetime.datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                validated_times.append(dt)
            except ValueError:
                pass
        
        if not validated_times:
            return error_response("Invalid time format")
        
        # Create session request
        session_request = StudySessionCalendar(
            requester_id=current_user.id,
            receiver_id=receiver_id,
            title=title,
            subject=subject,
            description=description,
            proposed_times=[t.isoformat() for t in validated_times],
            duration_minutes=duration_minutes,
            requester_resources=resources,
            requester_notes=notes
        )
        
        db.session.add(session_request)
        db.session.flush()
        
        # Create a message notification
        message = Message(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            subject="Study Session Request",
            body=f"📅 {current_user.name} invited you to a study session: {title}",
            related_session_id=session_request.id,
            sent_at=datetime.datetime.utcnow()
        )
        db.session.add(message)
        
        session_request.message_id = message.id
        
        db.session.commit()
        
        # Notify via WebSocket
        from websocket_events import ws_manager
        
        if receiver_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'study_session_request',
                {
                    'session_id': session_request.id,
                    'title': title,
                    'subject': subject,
                    'proposed_times': [t.isoformat() for t in validated_times],
                    'duration_minutes': duration_minutes,
                    'requester': {
                        'id': current_user.id,
                        'name': current_user.name,
                        'avatar': current_user.avatar
                    }
                },
                room=f"user_{receiver_id}"
            )
        
        return success_response(
            "Study session requested",
            data={
                "session_id": session_request.id,
                "message_id": message.id
            }
        ), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Request study session error: {str(e)}")
        return error_response("Failed to request session")


@study_sessions_bp.route("/study-session/<int:session_id>/confirm", methods=["POST"])
@token_required
def confirm_study_session(current_user, session_id):
    """
    Confirm study session with chosen time
    
    Body: {
        "confirmed_time": "2025-01-20T15:00:00Z",
        "receiver_notes": ""
    }
    """
    try:
        session = StudySessionCalendar.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.receiver_id != current_user.id:
            return error_response("Only receiver can confirm", 403)
        
        if session.status != "pending":
            return error_response("Session is not pending", 400)
        
        data = request.get_json()
        confirmed_time_str = data.get("confirmed_time")
        
        if not confirmed_time_str:
            return error_response("confirmed_time required")
        
        try:
            confirmed_time = datetime.datetime.fromisoformat(confirmed_time_str.replace('Z', '+00:00'))
        except ValueError:
            return error_response("Invalid time format")
        
        # Update session
        session.confirmed_time = confirmed_time
        session.status = "confirmed"
        session.confirmed_at = datetime.datetime.utcnow()
        session.receiver_notes = data.get("receiver_notes", "")
        
        db.session.commit()
        
        # Notify requester
        from websocket_events import ws_manager
        
        if session.requester_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'study_session_confirmed',
                {
                    'session_id': session.id,
                    'confirmed_time': confirmed_time.isoformat(),
                    'receiver_name': current_user.name
                },
                room=f"user_{session.requester_id}"
            )
        
        return success_response("Study session confirmed")
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Confirm session error: {str(e)}")
        return error_response("Failed to confirm session")



@study_sessions_bp.route("/study-session/upcoming", methods=["GET"])
@token_required
def get_upcoming_study_sessions(current_user):
    """Get all upcoming confirmed study sessions"""
    try:
        now = datetime.datetime.utcnow()
        
        sessions = StudySessionCalendar.query.filter(
            or_(
                StudySessionCalendar.requester_id == current_user.id,
                StudySessionCalendar.receiver_id == current_user.id
            ),
            StudySessionCalendar.status == "confirmed",
            StudySessionCalendar.confirmed_time >= now
        ).order_by(StudySessionCalendar.confirmed_time.asc()).all()
        
        sessions_data = []
        for session in sessions:
            other_user_id = session.receiver_id if session.requester_id == current_user.id else session.requester_id
            other_user = User.query.get(other_user_id)
            
            time_until = session.confirmed_time - now
            minutes_until = int(time_until.total_seconds() / 60)
            
            sessions_data.append({
                "id": session.id,
                "title": session.title,
                "subject": session.subject,
                "confirmed_time": session.confirmed_time.isoformat(),
                "duration_minutes": session.duration_minutes,
                "requester_notes": session.requester_notes,
                "requester_resources": session.requester_resources,
                "receiver_notes": session.receiver_notes,
                'cancel_reason': session.cancel_reason,
                'decline_reason': session.decline_reason,
                "receiver_resources": session.receiver_resources,
                "minutes_until": minutes_until,
                "is_soon": minutes_until <= 60,
                "partner": {
                    "id": other_user.id,
                    "username": other_user.username,
                    "name": other_user.name,
                    "avatar": other_user.avatar
                } if other_user else None,
                "am_requester": session.requester_id == current_user.id
            })
        
        return jsonify({
            "status": "success",
            "data": {
                "upcoming_sessions": sessions_data,
                "total": len(sessions_data)
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Get upcoming sessions error: {str(e)}")
        return error_response("Failed to load upcoming sessions")



@study_sessions_bp.route("/study-session/all", methods=["GET"])
@token_required
def get_all_study_sessions(current_user):
    """
    Get all study sessions (pending, confirmed, completed, cancelled)
    
    Query params:
    - partner_id: Filter by specific partner/user (optional)
    - status: Filter by status (pending|confirmed|rescheduled|completed|cancelled)
    """
    try:
        partner_id = request.args.get("partner_id", type=int)
        status_filter = request.args.get("status")
        
        # Base query - sessions involving current user
        query = StudySessionCalendar.query.filter(
            or_(
                StudySessionCalendar.requester_id == current_user.id,
                StudySessionCalendar.receiver_id == current_user.id
            )
        )
        
        # Filter by specific partner if provided
        if partner_id:
            # Verify they're connected (optional security check)
            if not can_message(current_user.id, partner_id):
                return error_response("Must be connected to view sessions with this user", 403)
            
            # Filter sessions between current_user and partner_id
            query = query.filter(
                or_(
                    and_(
                        StudySessionCalendar.requester_id == current_user.id,
                        StudySessionCalendar.receiver_id == partner_id
                    ),
                    and_(
                        StudySessionCalendar.requester_id == partner_id,
                        StudySessionCalendar.receiver_id == current_user.id
                    )
                )
            )
        
        # Filter by status if provided
        if status_filter:
            if status_filter == 'all':
                pass
            else:
                query = query.filter(StudySessionCalendar.status == status_filter)
        
        # Get all sessions ordered by created date (newest first)
        sessions = query.order_by(StudySessionCalendar.created_at.desc()).all()
        
        sessions_data = []
        for session in sessions:
            # Get partner info
            other_user_id = session.receiver_id if session.requester_id == current_user.id else session.requester_id
            other_user = User.query.get(other_user_id)
            am_requester = False
            am_requester = session.requester_id == current_user.id
            
            # Calculate time until session (if confirmed)
            time_until = None
            minutes_until = None
            if session.confirmed_time:
                now = datetime.datetime.utcnow()
                time_until = session.confirmed_time - now
                minutes_until = int(time_until.total_seconds() / 60)
            
            sessions_data.append({
                "id": session.id,
                "title": session.title,
                "subject": session.subject,
                "description": session.description,
                "status": session.status,
                "duration_minutes": session.duration_minutes,
                "proposed_times": session.proposed_times,
                "confirmed_time": session.confirmed_time.isoformat() if session.confirmed_time else None,
                "requester_notes": session.requester_notes,
                "receiver_notes": session.receiver_notes,
                "requester_resources": session.requester_resources,
                "receiver_resources": session.receiver_resources,
                "created_at": session.created_at.isoformat(),
                "confirmed_at": session.confirmed_at.isoformat() if session.confirmed_at else None,
                "minutes_until": minutes_until,
                "is_upcoming": minutes_until > 0 if minutes_until else False,
                "is_soon": minutes_until <= 60 if minutes_until else False,
                "am_requester": session.requester_id == current_user.id,
                "partner": {
                    "id": other_user.id,
                    "username": other_user.username,
                    "name": other_user.name,
                    "avatar": other_user.avatar
                } if other_user else None,
                "can_confirm": session.receiver_id == current_user.id and session.status in ["pending", "rescheduled"],
                "can_reschedule": session.status in ["pending", "rescheduled", "confirmed"] and am_requester,
                'can_decline': not am_requester and session.status in ["pending", "rescheduled"],
                "can_cancel": session.status in ["pending", "confirmed", "rescheduled"] and am_requester
            })
        
        # Get partner info if filtering by partner_id
        partner = None
        if partner_id:
            partner = User.query.get(partner_id)
        
        return jsonify({
            "status": "success",
            "data": {
                "sessions": sessions_data,
                "total": len(sessions_data),
                "filter": {
                    "partner_id": partner_id,
                    "status": status_filter
                },
                "partner_info": {
                    "id": partner.id,
                    "username": partner.username,
                    "name": partner.name,
                    "avatar": partner.avatar
                } if partner_id and partner else None
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Get all study sessions error: {str(e)}")
        return error_response("Failed to load study sessions")
# ============================================================================
# LIVE STUDY SESSIONS
# ============================================================================


@study_sessions_bp.route("/live-session/start", methods=["POST"])
@limiter.limit("20 per day")
@token_required
def start_live_study_session(current_user):
    """
    Start a live study session with partner
    
    Body: {
        "partner_id": 123,
        "title": "Calculus study",
        "subject": "Calculus"
    }
    """
    try:
        data = request.get_json()
        partner_id = data.get("partner_id")
        title = data.get("title", "Study Session").strip()
        subject = data.get("subject", "").strip()
        
        if not partner_id:
            return error_response("partner_id required")
        
        if not can_message(current_user.id, partner_id):
            return error_response("Must be connected to start session", 403)
        
        # Check if there's already an active session
        existing = LiveStudySession.query.filter(
            or_(
                and_(LiveStudySession.user1_id == current_user.id, LiveStudySession.user2_id == partner_id),
                and_(LiveStudySession.user1_id == partner_id, LiveStudySession.user2_id == current_user.id)
            ),
            LiveStudySession.status == "active"
        ).first()
        
        if existing:
            return error_response("Active session already exists", 409)
        
        # Create session key
        sorted_ids = sorted([current_user.id, partner_id])
        session_key = f"live_{sorted_ids[0]}_{sorted_ids[1]}_{datetime.datetime.utcnow().timestamp()}"
        
        # Create session
        session = LiveStudySession(
            user1_id=sorted_ids[0],
            user2_id=sorted_ids[1],
            session_key=session_key,
            title=title,
            subject=subject,
            notepad_content="# Study Notes\n\n",
            user1_timer_state={"is_running": False, "elapsed": 0},
            user2_timer_state={"is_running": False, "elapsed": 0}
        )
        
        db.session.add(session)
        db.session.commit()
        
        # Notify partner via WebSocket
        from websocket_events import ws_manager
        
        if partner_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'live_session_started',
                {
                    'session_id': session.id,
                    'session_key': session_key,
                    'title': title,
                    'subject': subject,
                    'starter': {
                        'id': current_user.id,
                        'name': current_user.name,
                        'avatar': current_user.avatar
                    }
                },
                room=f"user_{partner_id}"
            )
        
        return success_response(
            "Live session started",
            data={
                "session_id": session.id,
                "session_key": session_key
            }
        ), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Start live session error: {str(e)}")
        return error_response("Failed to start session")


@study_sessions_bp.route("/live-session/<int:session_id>", methods=["GET"])
@token_required
def get_live_study_session(current_user, session_id):
    """Get live session details"""
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        # Get partner info
        partner_id = session.user2_id if session.user1_id == current_user.id else session.user1_id
        partner = User.query.get(partner_id)
        
        # Calculate session duration
        duration_seconds = session.total_duration_seconds
        if session.status == "active":
            duration_seconds += int((datetime.datetime.utcnow() - session.started_at).total_seconds())
        
        return jsonify({
            "status": "success",
            "data": {
                "session_id": session.id,
                "session_key": session.session_key,
                "title": session.title,
                "subject": session.subject,
                "status": session.status,
                "notepad_content": session.notepad_content,
                "topics_covered": session.topics_covered or [],
                "problems_solved": session.problems_solved,
                "duration_seconds": duration_seconds,
                "started_at": session.started_at.isoformat(),
                "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                "partner": {
                    "id": partner.id,
                    "username": partner.username,
                    "name": partner.name,
                    "avatar": partner.avatar
                } if partner else None,
                "your_timer": session.user1_timer_state if session.user1_id == current_user.id else session.user2_timer_state,
                "partner_timer": session.user2_timer_state if session.user1_id == current_user.id else session.user1_timer_state
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Get live session error: {str(e)}")
        return error_response("Failed to load session")


@study_sessions_bp.route("/live-session/<int:session_id>/end", methods=["POST"])
@token_required
def end_live_study_session(current_user, session_id):
    """
    End live study session and generate summary
    
    Body: {
        "topics_covered": ["Derivatives", "Chain Rule"],
        "problems_solved": 5
    }
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        if session.status != "active":
            return error_response("Session is not active", 400)
        
        data = request.get_json() or {}
        topics_covered = data.get("topics_covered", [])
        problems_solved = data.get("problems_solved", 0)
        
        # Update session
        session.status = "ended"
        session.ended_at = datetime.datetime.utcnow()
        session.topics_covered = topics_covered
        session.problems_solved = problems_solved
        
        # Calculate total duration
        total_seconds = int((session.ended_at - session.started_at).total_seconds())
        session.total_duration_seconds = total_seconds
        
        # Generate session log
        session.session_log = {
            "started_at": session.started_at.isoformat(),
            "ended_at": session.ended_at.isoformat(),
            "duration_minutes": round(total_seconds / 60, 1),
            "topics_covered": topics_covered,
            "problems_solved": problems_solved,
            "notepad_final": session.notepad_content,
            "ended_by": current_user.id
        }
        
        db.session.commit()
        
        # Update conversation analytics
        partner_id = session.user2_id if session.user1_id == current_user.id else session.user1_id
        
        sorted_ids = sorted([current_user.id, partner_id])
        conv_key = f"{sorted_ids[0]}-{sorted_ids[1]}"
        
        analytics = ConversationAnalytics.query.filter_by(conversation_key=conv_key).first()
        if analytics:
            analytics.total_study_sessions += 1
            analytics.total_study_time_hours += round(total_seconds / 3600, 2)
            db.session.commit()
        
        # Notify partner
        from websocket_events import ws_manager
        
        if partner_id in ws_manager.online_users:
            ws_manager.socketio.emit(
                'live_session_ended',
                {
                    'session_id': session.id,
                    'session_log': session.session_log,
                    'ended_by': current_user.name
                },
                room=f"user_{partner_id}"
            )
        
        return success_response(
            "Session ended",
            data={
                "session_log": session.session_log
            }
        )
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"End live session error: {str(e)}")
        return error_response("Failed to end session")


@study_sessions_bp.route("/live-session/<int:session_id>/cancel", methods=["POST"])
@token_required
def cancel_live_study_session(current_user, session_id):
    """
    Cancel active live study session
    
    Body: {
        "reason": "Had to leave early"
    }
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        if session.status != "active":
            return error_response("Session is not active", 400)
        
        data = request.get_json() or {}
        reason = data.get("reason", "Session cancelled")
        
        # Update session status
        session.status = "cancelled"
        session.ended_at = datetime.datetime.utcnow()
        
        # Calculate total duration
        total_seconds = int((session.ended_at - session.started_at).total_seconds())
        
        # Generate session log
        session.session_log = {
            "started_at": session.started_at.isoformat(),
            "ended_at": session.ended_at.isoformat(),
            "duration_minutes": round(total_seconds / 60, 1),
            "topics_covered": session.topics_covered or [],
            "problems_solved": session.problems_solved,
            "cancelled_by": current_user.id,
            "cancel_reason": reason,
            "notepad_final": session.notepad_content,
            "resources_count": len(session.resources or [])
        }
        
        db.session.commit()
        
        # Notify all participants via WebSocket
        from websocket_events import ws_manager
        
        ws_manager.socketio.emit(
            'session_cancelled',
            {
                'session_id': session_id,
                'cancelled_by': current_user.name,
                'reason': reason,
                'session_log': session.session_log
            },
            room=f"live_session_{session_id}"
        )
        
        return success_response(
            "Session cancelled",
            data={
                "session_log": session.session_log
            }
        )
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Cancel session error: {str(e)}")
        return error_response("Failed to cancel session")


@study_sessions_bp.route("/live-session/<int:session_id>/history", methods=["GET"])
@token_required
def get_live_session_history(current_user, session_id):
    """Get completed live session history with partner"""
    try:
        partner_id = session_id  # Using session_id param as partner_id for this endpoint
        
        if not can_message(current_user.id, partner_id):
            return error_response("Must be connected to view history", 403)
        
        sessions = LiveStudySession.query.filter(
            or_(
                and_(LiveStudySession.user1_id == current_user.id, LiveStudySession.user2_id == partner_id),
                and_(LiveStudySession.user1_id == partner_id, LiveStudySession.user2_id == current_user.id)
            ),
            LiveStudySession.status == "ended"
        ).order_by(LiveStudySession.ended_at.desc()).limit(20).all()
        
        history_data = []
        for session in sessions:
            history_data.append({
                "id": session.id,
                "title": session.title,
                "subject": session.subject,
                "started_at": session.started_at.isoformat(),
                "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                "duration_minutes": round(session.total_duration_seconds / 60, 1),
                "topics_covered": session.topics_covered or [],
                "problems_solved": session.problems_solved,
                "session_log": session.session_log
            })
        
        partner = User.query.get(partner_id)
        
        return jsonify({
            "status": "success",
            "data": {
                "partner": {
                    "id": partner.id,
                    "username": partner.username,
                    "name": partner.name,
                    "avatar": partner.avatar
                } if partner else None,
                "sessions": history_data,
                "total_sessions": len(history_data),
                "total_hours": round(sum(s["duration_minutes"] for s in history_data) / 60, 1)
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Get session history error: {str(e)}")
        return error_response("Failed to load session history")


# ============================================================================
# LIVE SESSION AI ASSISTANT
# ============================================================================

@study_sessions_bp.route("/live-session/<int:session_id>/ai/ask", methods=["POST"])
@token_required
def ai_ask_in_session(current_user, session_id):
    """
    Ask AI a question within study session
    
    Body: {
        "question": "Can you explain derivatives?"
    }
    
    Returns: Streaming response
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        data = request.get_json()
        question = data.get("question", "").strip()
        
        if not question:
            return error_response("Question required")
        
        # Build context for AI
        ai_messages = session.ai_messages or []
        
        # Add user question
        user_message = {
            "role": "user",
            "content": question,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "asked_by": current_user.id
        }
        ai_messages.append(user_message)
        
        # Build AI prompt with session context
        system_prompt = f"""You are an AI study assistant helping students learn {session.subject or 'various topics'}.
Current study session: "{session.title}"
Notepad content (for context):
{session.notepad_content[:1000]}

Provide clear, educational explanations. Use examples when helpful."""
        
        # Prepare messages for AI
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history (last 10 exchanges)
        for msg in ai_messages[-20:]:  # Last 10 exchanges = 20 messages
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Stream AI response
        def generate():
            full_response = ""
            
            try:
                import requests
                import json
                
                api_key = os.getenv("OPENROUTER_API_KEY_1")
                
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://learnora-study.com",
                    "X-Title": "Learnora Study Assistant"
                }
                
                payload = {
                    "model": "google/gemini-2.0-flash-exp:free",
                    "messages": messages,
                    "stream": True
                }
                
                response = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    stream=True,
                    timeout=30
                )
                
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        
                        if line.startswith('data: '):
                            line = line[6:]
                        
                        if line == '[DONE]':
                            break
                        
                        try:
                            chunk = json.loads(line)
                            content = chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                            
                            if content:
                                full_response += content
                                yield f"data: {json.dumps({'content': content})}\n\n"
                        
                        except json.JSONDecodeError:
                            continue
                
                # Save AI response to session
                assistant_message = {
                    "role": "assistant",
                    "content": full_response,
                    "timestamp": datetime.datetime.utcnow().isoformat()
                }
                ai_messages.append(assistant_message)
                
                session.ai_messages = ai_messages
                db.session.commit()
                
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                
                # Notify partner via WebSocket that AI was used
                from websocket_events import ws_manager
                partner_id = session.user2_id if session.user1_id == current_user.id else session.user1_id
                
                if partner_id in ws_manager.online_users:
                    ws_manager.socketio.emit(
                        'ai_used_in_session',
                        {
                            'session_id': session_id,
                            'question': question[:100],
                            'asked_by': current_user.name
                        },
                        room=f"user_{partner_id}"
                    )
                
            except Exception as e:
                current_app.logger.error(f"AI stream error: {str(e)}")
                yield f"data: {json.dumps({'error': 'AI request failed'})}\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
        )
        
    except Exception as e:
        current_app.logger.error(f"AI ask error: {str(e)}")
        return error_response("Failed to process AI request")


@study_sessions_bp.route("/live-session/<int:session_id>/ai/history", methods=["GET"])
@token_required
def get_ai_history(current_user, session_id):
    """Get AI conversation history for this session"""
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        return jsonify({
            "status": "success",
            "data": {
                "messages": session.ai_messages or [],
                "total": len(session.ai_messages or [])
            }
        })
        
    except Exception as e:
        return error_response("Failed to load AI history")


# ============================================================================
# SESSION RESOURCES MANAGEMENT
# ============================================================================

@study_sessions_bp.route("/live-session/<int:session_id>/resource/add", methods=["POST"])
@token_required
def add_session_resource(current_user, session_id):
    """
    Add resource to study session
    
    Body: {
        "name": "calc.pdf",
        "url": "https://...",
        "type": "pdf",
        "size_bytes": 2048576
    }
    """
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        # Check authorization
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        data = request.get_json()
        
        # Generate UUID for resource
        import uuid
        resource_id = str(uuid.uuid4())
        
        resource = {
            "id": resource_id,
            "name": data.get("name"),
            "url": data.get("url"),
            "type": data.get("type"),
            "size_bytes": data.get("size_bytes"),
            "uploaded_by": current_user.id,
            "uploaded_at": datetime.datetime.utcnow().isoformat()
        }
        
        # Add to resources array
        resources = session.resources or []
        resources.append(resource)
        session.resources = resources
        
        db.session.commit()
        
        # Notify via WebSocket
        from websocket_events import ws_manager
        ws_manager.socketio.emit(
            'resource_added',
            resource,
            room=f"live_session_{session_id}"
        )
        
        return success_response("Resource added", data={"resource_id": resource_id})
        
    except Exception as e:
        db.session.rollback()
        return error_response("Failed to add resource")


@study_sessions_bp.route("/live-session/<int:session_id>/resource/<resource_id>", methods=["DELETE"])
@token_required
def remove_session_resource(current_user, session_id, resource_id):
    """Remove resource from study session"""
    try:
        session = LiveStudySession.query.get(session_id)
        
        if not session:
            return error_response("Session not found", 404)
        
        if session.user1_id != current_user.id and session.user2_id != current_user.id:
            return error_response("Not authorized", 403)
        
        # Find and remove resource
        resources = session.resources or []
        updated_resources = [r for r in resources if r["id"] != resource_id]
        
        if len(updated_resources) == len(resources):
            return error_response("Resource not found", 404)
        
        session.resources = updated_resources
        db.session.commit()
        
        # Notify via WebSocket
        from websocket_events import ws_manager
        ws_manager.socketio.emit(
            'resource_removed',
            {"resource_id": resource_id},
            room=f"live_session_{session_id}"
        )
        
        return success_response("Resource removed")
        
    except Exception as e:
        db.session.rollback()
        return error_response("Failed to remove session resource")