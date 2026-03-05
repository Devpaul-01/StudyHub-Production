"""
StudyHub - Thread System (Optimized Endpoints)
Contains the two performance-critical endpoints:
  - GET /threads/recommended
  - GET /threads/help/suggestions

Plus the popular_tags fix (belongs in your posts blueprint).
"""

# ============================================================================
# popular_tags  (paste into your posts blueprint)
# ============================================================================
#
# BEFORE:
#   Post.query.all() → loads EVERY post into Python → iterate tags in Python
#   If you have 10 000 posts this hits the DB hard every request.
#
# AFTER:
#   func.unnest(Post.tags) → single aggregate SQL query
#   Two queries total (user tags + global counts), zero Python-level iteration.
#
# @posts_bp.route("/posts/tags", methods=["GET"])
# @token_required
# def popular_tags(current_user):
#     try:
#         # 1. User's own tag set — tiny filtered query
#         user_tag_rows = (
#             db.session.query(func.unnest(Post.tags).label("tag"))
#             .filter(Post.student_id == current_user.id)
#             .all()
#         )
#         user_tags = {row.tag for row in user_tag_rows}
#
#         # 2. Global tag counts — one aggregate query
#         tag_count_rows = (
#             db.session.query(
#                 func.unnest(Post.tags).label("tag"),
#                 func.count("*").label("count"),
#             )
#             .group_by("tag")
#             .order_by(func.count("*").desc())
#             .all()
#         )
#
#         # Sort: user's own tags first, then by global count
#         sorted_tags = sorted(
#             tag_count_rows,
#             key=lambda x: (x.tag not in user_tags, -x.count),
#         )
#
#         return jsonify({"status": "success", "data": {t.tag: t.count for t in sorted_tags}})
#
#     except Exception as e:
#         current_app.logger.error(f"Get tags error: {str(e)}")
#         return error_response("Failed to load trending tags")

# ============================================================================

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import or_, and_, func, desc, case
import datetime

from models import (
    User, StudentProfile, Thread, ThreadMember, ThreadJoinRequest,
    ThreadMessage, Post, Notification, Connection, Mention, OnboardingDetails
)
from extensions import db
from routes.student.helpers import (
    token_required, success_response, error_response
)

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

threads_bp = Blueprint("student_threads", __name__)


# ============================================================================
# HELPER
# ============================================================================

def detect_mentions_in_thread(text_content, sender_id, thread_id, message_id):
    if not text_content:
        return []
    import re
    from models import Mention, Notification, User

    mention_pattern = r'@([a-zA-Z0-9_]{3,20})'
    matches = re.finditer(mention_pattern, text_content)
    mentioned_users = []
    sender = User.query.get(sender_id)

    for match in matches:
        username = match.group(1).lower()
        mentioned_user = User.query.filter_by(username=username).first()
        if mentioned_user and mentioned_user.id != sender_id:
            is_member = ThreadMember.query.filter_by(
                thread_id=thread_id, student_id=mentioned_user.id
            ).first()
            if is_member:
                existing = Mention.query.filter_by(
                    mentioned_in_type="thread_message",
                    mentioned_in_id=message_id,
                    mentioned_user_id=mentioned_user.id,
                    mentioned_by_user_id=sender_id,
                ).first()
                if not existing:
                    db.session.add(Mention(
                        mentioned_in_type="thread_message",
                        mentioned_in_id=message_id,
                        mentioned_user_id=mentioned_user.id,
                        mentioned_by_user_id=sender_id,
                    ))
                    db.session.add(Notification(
                        user_id=mentioned_user.id,
                        title=f"{sender.name} mentioned you in a thread",
                        body="",
                        notification_type="mention",
                        related_type="thread",
                        related_id=thread_id,
                    ))
                    mentioned_users.append(mentioned_user.id)

    return mentioned_users


# ============================================================================
# OPTIMIZED: GET /threads/recommended
#
# BEFORE — ran inside a loop over ALL open threads:
#   ThreadMember.query.filter_by(thread_id=thread.id).all()  → N queries
#   User.query.get(fid) for each friend in thread            → M queries
#   User.query.get(thread.creator_id)                        → N queries
#   ThreadJoinRequest.query.filter_by(thread_id=...)         → N queries
#   Worst case with 500 threads + 20 friends: 500*4 = 2 000 queries
#
# AFTER — 6 flat queries regardless of thread/friend count:
#   1. User profile + onboarding
#   2. Accepted connections  (friend IDs)
#   3. Thread IDs user is already in (subquery)
#   4. Candidate threads  (limited + ordered at DB level)
#   5. All ThreadMembers for candidate threads  (batch)
#   6. All pending ThreadJoinRequests for current user  (batch)
#   7. All creators  (batch .in_() )
#   8. Friend names for friends appearing in threads  (batch .in_() )
#   Total: 8 queries, O(1) per thread in scoring loop
# ============================================================================
@threads_bp.route("/threads/recommended", methods=["GET"])
@token_required
def get_recommended_threads(current_user):
    """Get personalised thread recommendations."""
    try:
        limit = min(int(request.args.get("limit", 10)), 30)

        profile    = StudentProfile.query.filter_by(user_id=current_user.id).first()
        onboarding = OnboardingDetails.query.filter_by(user_id=current_user.id).first()

        user_dept         = profile.department if profile else None
        user_subjects     = set(onboarding.subjects      or []) if onboarding else set()
        user_help_subjects= set(onboarding.help_subjects or []) if onboarding else set()
        all_user_subjects = user_subjects | user_help_subjects

        # ✅ 1. Friend IDs — one query, only needed columns
        conn_rows = Connection.query.filter(
            or_(
                Connection.requester_id == current_user.id,
                Connection.receiver_id  == current_user.id,
            ),
            Connection.status == "accepted",
        ).with_entities(Connection.requester_id, Connection.receiver_id).all()

        friend_ids = {
            c.receiver_id if c.requester_id == current_user.id else c.requester_id
            for c in conn_rows
        }

        # ✅ 2. Thread IDs user is already in — subquery (no Python list)
        member_subq = (
            db.session.query(ThreadMember.thread_id)
            .filter(ThreadMember.student_id == current_user.id)
            .scalar_subquery()
        )

        # ✅ 3. Candidate threads — filtered + ordered at DB level (no .all() on whole table)
        threads = (
            Thread.query.filter(
                Thread.is_open == True,
                Thread.member_count < Thread.max_members,
                ~Thread.id.in_(member_subq),
            )
            .order_by(Thread.last_activity.desc())
            .limit(200)           # ceiling so Python scoring stays fast
            .all()
        )

        if not threads:
            return jsonify({
                "status": "success",
                "data": {
                    "recommendations": [],
                    "total_found": 0,
                    "showing": 0,
                    "personalization": {
                        "has_onboarding": onboarding is not None,
                        "has_friends":    len(friend_ids) > 0,
                        "department":     user_dept,
                    },
                },
            })

        thread_ids = [t.id for t in threads]

        # ✅ 4. Batch-load ALL thread members for candidate threads
        tm_rows = (
            ThreadMember.query.filter(ThreadMember.thread_id.in_(thread_ids))
            .with_entities(ThreadMember.thread_id, ThreadMember.student_id)
            .all()
        )
        thread_member_map = {}   # {thread_id: set of student_ids}
        for tm in tm_rows:
            thread_member_map.setdefault(tm.thread_id, set()).add(tm.student_id)

        # ✅ 5. Batch-load pending join requests for current user
        pending_rows = (
            ThreadJoinRequest.query.filter(
                ThreadJoinRequest.thread_id.in_(thread_ids),
                ThreadJoinRequest.requester_id == current_user.id,
                ThreadJoinRequest.status == "pending",
            )
            .with_entities(ThreadJoinRequest.thread_id)
            .all()
        )
        pending_set = {r.thread_id for r in pending_rows}

        # ✅ 6. Batch-load creators
        creator_ids = {t.creator_id for t in threads if t.creator_id}
        creator_map = {
            u.id: u for u in User.query.filter(User.id.in_(creator_ids)).all()
        }

        # ✅ 7. Batch-load friend names only for friends who actually appear in threads
        friends_in_any_thread = set()
        for t in threads:
            members = thread_member_map.get(t.id, set())
            friends_in_any_thread.update(friend_ids & members)

        friend_name_map = {}
        if friends_in_any_thread:
            friend_name_map = {
                u.id: u.name
                for u in User.query.filter(User.id.in_(friends_in_any_thread))
                .with_entities(User.id, User.name)
                .all()
            }

        # ✅ Score loop — zero DB hits
        now = datetime.datetime.utcnow()
        recommendations = []

        for thread in threads:
            score   = 0
            reasons = []

            # 1. Department match (35 pts)
            if thread.department == user_dept:
                score += 35
                reasons.append("Your department")

            # 2. Subject/tag overlap (30 pts)
            thread_tags     = set(thread.tags or [])
            subject_overlap = thread_tags & all_user_subjects
            if subject_overlap:
                score += min(len(subject_overlap) * 10, 30)
                reasons.append(f"Matches: {', '.join(list(subject_overlap)[:2])}")

            # 3. Friends in thread (20 pts)
            thread_member_ids = thread_member_map.get(thread.id, set())
            friends_here      = friend_ids & thread_member_ids
            if friends_here:
                score += min(len(friends_here) * 10, 20)
                names = [friend_name_map[fid] for fid in list(friends_here)[:2] if fid in friend_name_map]
                if names:
                    reasons.append(f"{', '.join(names)} already in")

            # 4. Activity level (10 pts)
            hours_since = (now - thread.last_activity).total_seconds() / 3600
            if hours_since < 24:
                score += 10 - (hours_since / 24 * 10)
                if hours_since < 2:
                    reasons.append("Very active now")

            # 5. Space available (5 pts)
            if thread.member_count < thread.max_members * 0.7:
                score += 5
                reasons.append("Good space available")

            if score <= 20:
                continue

            creator = creator_map.get(thread.creator_id)
            recommendations.append({
                "score": score,
                "thread": {
                    "id":                  thread.id,
                    "title":               thread.title,
                    "description":         thread.description,
                    "department":          thread.department,
                    "tags":                thread.tags or [],
                    "member_count":        thread.member_count,
                    "max_members":         thread.max_members,
                    "message_count":       thread.message_count,
                    "requires_approval":   thread.requires_approval,
                    "created_at":          thread.created_at.isoformat(),
                    "last_activity":       thread.last_activity.isoformat(),
                    "creator": {
                        "id":               creator.id,
                        "username":         creator.username,
                        "name":             creator.name,
                        "avatar":           creator.avatar,
                        "reputation_level": creator.reputation_level,
                    } if creator else None,
                    "recommendation_score": round(score, 1),
                    "reasons":              reasons,
                    "has_pending_request":  thread.id in pending_set,
                },
            })

        recommendations.sort(key=lambda x: x["score"], reverse=True)
        top = recommendations[:limit]

        return jsonify({
            "status": "success",
            "data": {
                "recommendations": [r["thread"] for r in top],
                "total_found":     len(recommendations),
                "showing":         len(top),
                "personalization": {
                    "has_onboarding": onboarding is not None,
                    "has_friends":    len(friend_ids) > 0,
                    "department":     user_dept,
                },
            },
        })

    except Exception as e:
        current_app.logger.error(f"Get recommendation error: {e}", exc_info=True)
        return error_response("Failed to load recommendations")


# ============================================================================
# OPTIMIZED: GET /threads/help/suggestions
#
# BEFORE:
#   For each candidate user (could be hundreds):
#     Connection.query.filter(or_(and_(...), and_(...)), status='pending')
#   → 1 DB round-trip per candidate = potentially hundreds of queries
#
# AFTER:
#   Pre-load ALL pending connections for current user in ONE query before
#   the loop → O(1) set lookup per candidate.
#   Total extra queries: 1 (flat).
# ============================================================================
@threads_bp.route("/threads/help/suggestions", methods=["GET"])
@token_required
def get_help_suggestions(current_user):
    """Find users the current user can help based on onboarding details."""
    try:
        limit = min(int(request.args.get("limit", 10)), 50)

        user = User.query.get(current_user.id)
        if not user:
            return error_response("User not found")

        user_onboarding = OnboardingDetails.query.filter_by(user_id=user.id).first()
        if not user_onboarding:
            return error_response(
                "Complete your onboarding to get help suggestions",
                data={"redirect": "/student/onboard"},
            )

        user_strong_subjects = set(user_onboarding.strong_subjects or [])
        if not user_strong_subjects:
            return success_response("No strong subjects set", data={"suggestions": []})

        user_profile = user.student_profile
        user_dept    = user_profile.department if user_profile else None
        user_schedule= user_onboarding.study_schedule or {}

        # ✅ Accepted connections — used to exclude already-connected users
        accepted_conn_rows = Connection.query.filter(
            or_(
                Connection.requester_id == current_user.id,
                Connection.receiver_id  == current_user.id,
            ),
            Connection.status == "accepted",
        ).with_entities(Connection.requester_id, Connection.receiver_id).all()

        existing_connections = {
            c.receiver_id if c.requester_id == current_user.id else c.requester_id
            for c in accepted_conn_rows
        }

        # ✅ Pre-load ALL pending connections for current user in ONE query
        #    (replaces the per-candidate Connection.query inside the loop)
        pending_conn_rows = Connection.query.filter(
            or_(
                Connection.requester_id == current_user.id,
                Connection.receiver_id  == current_user.id,
            ),
            Connection.status == "pending",
        ).with_entities(Connection.requester_id, Connection.receiver_id).all()

        pending_connection_set = {
            c.receiver_id if c.requester_id == current_user.id else c.requester_id
            for c in pending_conn_rows
        }

        # ✅ Single JOIN query — gets all candidate data in one shot
        potential_users = (
            db.session.query(User, OnboardingDetails, StudentProfile)
            .join(OnboardingDetails, OnboardingDetails.user_id == User.id)
            .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
            .filter(
                User.id != current_user.id,
                User.status == "approved",
                ~User.id.in_(existing_connections) if existing_connections else True,
            )
            .all()
        )

        # ✅ Score loop — zero DB hits
        suggestions = []
        for candidate_user, candidate_onboarding, candidate_profile in potential_users:
            if not candidate_onboarding:
                continue

            candidate_help_subjects = set(candidate_onboarding.help_subjects or [])
            if not candidate_help_subjects:
                continue

            matching_subjects = user_strong_subjects & candidate_help_subjects
            if not matching_subjects:
                continue

            score        = 0
            match_reasons= []

            # 1. Subject overlap (40 pts max)
            score += min(len(matching_subjects) * 10, 40)
            match_reasons.append(f"Can help with: {', '.join(list(matching_subjects)[:3])}")

            # 2. Same department (30 pts)
            if candidate_profile and candidate_profile.department == user_dept:
                score += 30
                match_reasons.append(f"Same department: {user_dept}")

            # 3. Compatible study schedule (20 pts)
            candidate_schedule = candidate_onboarding.study_schedule or {}
            schedule_overlap   = 0
            for day, times in user_schedule.items():
                candidate_times = candidate_schedule.get(day, [])
                if candidate_times and times:
                    schedule_overlap += len(set(times) & set(candidate_times))

            if schedule_overlap > 0:
                score += min(schedule_overlap * 5, 20)
                match_reasons.append("Compatible study times")

            # 4. Same class level (10 pts)
            if candidate_profile and user_profile:
                if candidate_profile.class_name == user_profile.class_name:
                    score += 10
                    match_reasons.append(f"Same level: {user_profile.class_name}")

            # ✅ O(1) pending check — set lookup instead of DB query
            has_pending = candidate_user.id in pending_connection_set

            suggestions.append({
                "score": score,
                "user": {
                    "id":               candidate_user.id,
                    "username":         candidate_user.username,
                    "name":             candidate_user.name,
                    "avatar":           candidate_user.avatar,
                    "reputation":       candidate_user.reputation,
                    "reputation_level": candidate_user.reputation_level,
                    "bio":              candidate_user.bio,
                    "department":       candidate_profile.department if candidate_profile else None,
                    "class_level":      candidate_profile.class_name  if candidate_profile else None,
                },
                "match_details": {
                    "can_help_with":      list(matching_subjects),
                    "total_subjects":     len(matching_subjects),
                    "match_score":        round(score, 1),
                    "reasons":            match_reasons,
                    "same_department":    bool(candidate_profile and candidate_profile.department == user_dept),
                    "has_pending_request":has_pending,
                },
                "their_needs": {
                    "help_subjects":     candidate_onboarding.help_subjects or [],
                    "study_preferences": candidate_onboarding.study_preferences or [],
                    "session_length":    candidate_onboarding.session_length,
                },
            })

        suggestions.sort(key=lambda x: x["score"], reverse=True)
        top_suggestions = suggestions[:limit]

        return jsonify({
            "status": "success",
            "data": {
                "suggestions":   top_suggestions,
                "your_strengths":list(user_strong_subjects),
                "total_found":   len(suggestions),
                "showing":       len(top_suggestions),
            },
        })

    except Exception as e:
        current_app.logger.error(f"Get help suggestions error: {str(e)}")
        return error_response("Failed to load help suggestions")
