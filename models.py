"""
StudyHub - Complete Merged Database Models
Combines both model files with no duplicates
"""

import datetime
from flask_login import UserMixin
from sqlalchemy.ext.mutable import MutableDict, MutableList
from extensions import db

# ============================================================================
# CORE USER MODELS
# ===========================================================================
class ActivityFeed(db.Model):
    """
    Activity feed for homework-related activities
    Stores recent activities from connections (expires after 24 hours)
    """
    __tablename__ = 'activity_feed'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # User who performed the activity
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Type of activity
    activity_type = db.Column(db.String(50), nullable=False)
    # Types: 'homework_created', 'homework_shared', 'homework_completed',
    #        'offered_help', 'submitted_solution', 'gave_feedback',
    #        'became_champion', 'streak_milestone'
    
    # Activity data (JSON - flexible storage for different activity types)
    activity_data = db.Column(db.JSON, nullable=True)
    # Example structure:
    # {
    #   'type': 'homework_shared',
    #   'user_id': 1,
    #   'user_name': 'Alice',
    #   'user_avatar': '/static/images/user1.png',
    #   'assignment_id': 123,
    #   'title': 'Math Problem Set',
    #   'subject': 'Math',
    #   'difficulty': 'hard'
    # }
    
    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    # Activities expire after 24 hours by default
    
    # Relationships
    user = db.relationship('User', backref='activities')
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_activity_user_id', 'user_id'),
        db.Index('idx_activity_type', 'activity_type'),
        db.Index('idx_activity_created_at', 'created_at'),
        db.Index('idx_activity_expires_at', 'expires_at'),
    )
    
    def __repr__(self):
        return f'<ActivityFeed {self.id}: {self.activity_type} by User {self.user_id}>'
    
    def to_dict(self):
        """Convert activity to dictionary for API responses"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'activity_type': self.activity_type,
            'activity_data': self.activity_data,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }


# ============================================================================
# WEEKLY CHAMPION MODEL
# ============================================================================

class WeeklyChampion(db.Model):
    """
    Weekly champions for homework help
    Stores top helpers by subject, overall, and speed
    """
    __tablename__ = 'weekly_champions'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Champion user
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Champion category
    subject = db.Column(db.String(100), nullable=True)
    # Subject name for subject champions, or 'Overall', 'Speed' for other types
    
    # Statistics
    help_count = db.Column(db.Integer, nullable=False, default=0)
    # Number of helps given in this period
    
    # Week period
    week_start = db.Column(db.Date, nullable=False)
    week_end = db.Column(db.Date, nullable=False)
    avg_response_time_minutes = db.Column(db.String(50), nullable=True)
    
    # Champion type
    champion_type = db.Column(db.String(50), nullable=False)
    # Types: 'subject_champion', 'most_helpful_overall', 'fastest_helper'
    
    # Timestamp
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='championships')
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_champion_user_id', 'user_id'),
        db.Index('idx_champion_week', 'week_start', 'week_end'),
        db.Index('idx_champion_type', 'champion_type'),
        db.Index('idx_champion_subject', 'subject'),
    )
    
    def __repr__(self):
        return f'<WeeklyChampion {self.id}: User {self.user_id} - {self.champion_type}>'
    
    def to_dict(self):
        """Convert champion to dictionary for API responses"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'user_avatar': self.user.avatar_url if self.user else None,
            'subject': self.subject,
            'help_count': self.help_count,
            'week_start': self.week_start.isoformat() if self.week_start else None,
            'week_end': self.week_end.isoformat() if self.week_end else None,
            'champion_type': self.champion_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class HelpRequest(db.Model):
    __tablename__ = "help_requests"

    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    subject = db.Column(db.String(100), nullable=False)
    message = db.Column(db.String(300))  # Optional context from the user

    status = db.Column(db.String(20), default="active")  # active | resolved | expired
    broadcast_sent = db.Column(db.Boolean, default=False)

    # List of volunteers: [{"user_id": 1, "name": "Kola", "avatar": "...", "username": "kola", "volunteered_at": "..."}]
    volunteers = db.Column(MutableList.as_mutable(db.JSON), default=list)

    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime)  # Set to created_at + 2 hours on creation

    requester = db.relationship("User", foreign_keys=[requester_id])

    def is_expired(self):
        return datetime.datetime.utcnow() > self.expires_at if self.expires_at else False

    def __repr__(self):
        return f"<HelpRequest {self.id}: {self.subject} by User {self.requester_id}>"
class LiveStudySession(db.Model):
    __tablename__ = "live_study_sessions"
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Participants
    user1_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user2_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    
    # Session metadata
    session_key = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(200), default="Study Session")
    subject = db.Column(db.String(100))
    
    # ✅ ADD: Resources (NEW)
    resources = db.Column(MutableList.as_mutable(db.JSON), default=list)
    # Format: [{"id": "uuid", "name": "calc.pdf", "url": "...", "type": "pdf", "uploaded_by": user_id, "uploaded_at": "..."}]
    user1_timer_state = db.Column(db.JSON, default=dict)  # {'elapsed': 0, 'started_at': '...'}
    user2_timer_state = db.Column(db.JSON, default=dict)
    
    # Notepad
    notepad_content = db.Column(db.Text, default="# Study Notes\n\n")
    notepad_version = db.Column(db.Integer, default=1)  # ✅ ADD: For conflict detection
    last_notepad_edit_by = db.Column(db.Integer, db.ForeignKey("users.id"))  # ✅ ADD
    last_notepad_edit_at = db.Column(db.DateTime)  # ✅ ADD
    
    # Timer (SIMPLIFIED)
    timer_started_at = db.Column(db.DateTime)  # ✅ CHANGE: Server-controlled
    timer_paused_at = db.Column(db.DateTime)  # ✅ ADD
    timer_total_seconds = db.Column(db.Integer, default=0)  # ✅ ADD
    timer_is_running = db.Column(db.Boolean, default=False)  # ✅ ADD
    timer_owner_id = db.Column(db.Integer, db.ForeignKey('users.id'))  # Who started timer
    
    # ❌ REMOVE: Individual user timers - unnecessary complexity
    
    # AI usage tracking
    ai_messages = db.Column(MutableList.as_mutable(db.JSON), default=list)  # ✅ ADD
    # Format: [{"role": "user", "content": "...", "timestamp": "..."}, ...]
    
    # Status
    status = db.Column(db.String(20), default="active")
    
    session_log = db.Column(db.JSON)  #
    
    # Timestamps
    started_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    ended_at = db.Column(db.DateTime)
    last_activity = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    topics_covered = db.Column(db.JSON, default=list)  # ['Derivatives', 'Chain Rule']
    problems_solved = db.Column(db.Integer, default=0)
    

class ConversationAnalytics(db.Model):
    """
    AI-powered analytics for conversations
    """
    __tablename__ = 'conversation_analytics'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Conversation identifier
    conversation_key = db.Column(db.String(100), unique=True, nullable=False)  # "user1_id-user2_id"
    user1_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user2_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Message stats
    total_messages = db.Column(db.Integer, default=0)
    messages_this_week = db.Column(db.Integer, default=0)
    messages_last_week = db.Column(db.Integer, default=0)
    
    # Subject analysis
    subjects_discussed = db.Column(db.JSON)  # {'Calculus': 45, 'Physics': 23}
    top_subjects = db.Column(db.JSON)  # ['Calculus', 'Physics', 'Chemistry']
    
    # Timeline
    first_message_at = db.Column(db.DateTime)
    last_message_at = db.Column(db.DateTime)
    most_active_day = db.Column(db.String(20))  # 'Monday', 'Tuesday', etc.
    most_active_hour = db.Column(db.Integer)  # 0-23
    
    # Study metrics
    total_study_sessions = db.Column(db.Integer, default=0)
    total_study_time_hours = db.Column(db.Float, default=0)
    
    # Engagement scores
    engagement_score = db.Column(db.Float, default=0)  # 0-100
    learning_score = db.Column(db.Float, default=0)  # 0-100
    avg_response_time_minutes = db.Column(db.Float)
    
    # Computation tracking
    last_computed_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    needs_recompute = db.Column(db.Boolean, default=False)
    
    # Relationships
    user1 = db.relationship('User', foreign_keys=[user1_id])
    user2 = db.relationship('User', foreign_keys=[user2_id])
    
    def __repr__(self):
        return f'<ConversationAnalytics {self.conversation_key}>'



class StudySessionCalendar(db.Model):
    """
    Scheduled study sessions with confirmation workflow
    """
    __tablename__ = 'study_session_calendar'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Users
    requester_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Session details
    title = db.Column(db.String(200), nullable=False)
    subject = db.Column(db.String(100))
    description = db.Column(db.Text)
    
    # Scheduling
    proposed_times = db.Column(db.JSON)  # Array of ISO datetime strings
    confirmed_time = db.Column(db.DateTime)
    duration_minutes = db.Column(db.Integer, default=60)
    
    # Status workflow
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, rescheduled, completed, cancelled
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    confirmed_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    # Notes and resources
    requester_notes = db.Column(db.Text)
    requester_resources = db.Column(db.JSON)
    receiver_notes = db.Column(db.Text)
    receiver_resources = db.Column(db.JSON)
    decline_reason = db.Column(db.Text)
    
    # Message link
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id'))
    
    # Reminder tracking
    reminder_15min_sent = db.Column(db.Boolean, default=False)
    reminder_1hour_sent = db.Column(db.Boolean, default=False)
    
    # Relationships
    requester = db.relationship('User', foreign_keys=[requester_id])
    receiver = db.relationship('User', foreign_keys=[receiver_id])
    
    def __repr__(self):
        return f'<StudySessionCalendar {self.id}: {self.title}>'


        
"""
StudyHub - Updated Models for Homework/Assignment System
This adds the necessary fields to Assignment and HomeworkSubmission models
"""

# ADD THESE FIELDS TO YOUR ASSIGNMENT MODEL:

class Assignment(db.Model):
    """
    Personal assignment tracking with optional sharing for help
    """
    __tablename__ = "assignments"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    resources = db.Column(db.JSON, default=list)

    
    # Assignment details
    title = db.Column(db.String(200), nullable=False)
    subject = db.Column(db.String(100), index=True)
    description = db.Column(db.Text)
    
    # Scheduling
    due_date = db.Column(db.DateTime, nullable=False, index=True)
    estimated_hours = db.Column(db.Float)
    time_spent_minutes = db.Column(db.Integer, default=0)
    
    # Classification
    difficulty = db.Column(db.String(20), default="medium")  # easy, medium, hard
    status = db.Column(db.String(20), default="not_started", index=True)  # not_started, in_progress, completed
    
    # Priority system
    priority_score = db.Column(db.Float, default=0)  # Auto-calculated
    
    # 🆕 NEW: Sharing for help
    is_shared_for_help = db.Column(db.Boolean, default=False, index=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    user = db.relationship("User", backref="assignments")
    
    def calculate_priority(self):
        """
        Smart priority calculation based on:
        - Time until due (urgency)
        - Difficulty
        - Status
        - Estimated hours
        """
        now = datetime.datetime.utcnow()
        hours_until_due = (self.due_date - now).total_seconds() / 3600
        
        # Base score from urgency (0-100)
        if hours_until_due < 0:
            urgency_score = 100  # Overdue
        elif hours_until_due < 24:
            urgency_score = 90
        elif hours_until_due < 48:
            urgency_score = 70
        elif hours_until_due < 168:  # 1 week
            urgency_score = 50
        else:
            urgency_score = 30
        
        # Difficulty multiplier (1.0, 1.3, 1.6)
        difficulty_multiplier = {
            "easy": 1.0,
            "medium": 1.3,
            "hard": 1.6
        }.get(self.difficulty, 1.3)
        
        # Status adjustment
        status_multiplier = {
            "not_started": 1.2,  # Higher priority if not started
            "in_progress": 1.0,
            "completed": 0.1  # Very low priority
        }.get(self.status, 1.0)
        
        # Estimated hours bonus (longer tasks get slight priority boost)
        hours_bonus = min((self.estimated_hours or 0) * 2, 20)
        
        # Final calculation
        self.priority_score = (urgency_score * difficulty_multiplier * status_multiplier) + hours_bonus
        
    def __repr__(self):
        return f"<Assignment {self.id}: {self.title} - {self.status}>"


# UPDATE YOUR HOMEWORKSUBMISSION MODEL:

class HomeworkSubmission(db.Model):
    """
    Represents one person helping another with an assignment
    
    Workflow:
    1. Helper offers to help (status: pending)
    2. Helper submits solution (status: submitted)
    3. Requester reviews and gives feedback (status: reviewed)
    4. Mark as completed (status: completed)
    """
    __tablename__ = "homework_submissions"
    
    id = db.Column(db.Integer, primary_key=True)
    
    # 🆕 NEW: Link to assignment
    assignment_id = db.Column(db.Integer, db.ForeignKey("assignments.id"), nullable=True, index=True)
    
    # Relationship (who's helping who)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    helper_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    # Problem details (copied from assignment or entered manually)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    subject = db.Column(db.String(100), index=True)
    difficulty = db.Column(db.String(20))
    
    # Solution data (from helper)
    solution_text = db.Column(db.Text)
    solution_resources = db.Column(MutableList.as_mutable(db.JSON), default=list)
    # Format: [{"id": "uuid", "name": "solution.pdf", "url": "...", "type": "pdf"}]
    submitted_at = db.Column(db.DateTime)
    
    # Feedback (from requester)
    feedback_text = db.Column(db.Text)
    feedback_resources = db.Column(MutableList.as_mutable(db.JSON), default=list)
    feedback_at = db.Column(db.DateTime)
    
    # Status workflow
    status = db.Column(db.String(20), default="pending", index=True)
    reaction_type = db.Column(db.String(50))
    response_time_seconds = db.Column(db.Integer, nullable=True)  # Time to respond to help request
    reaction_at = db.Column(db.DateTime, nullable=True)  # When reaction was given
    # pending → submitted → reviewed → completed
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    is_marked_helpful = db.Column(db.Boolean, default=False)
    
    # Optional: Link to study session if help happened during a session
    study_session_id = db.Column(db.Integer, db.ForeignKey("live_study_sessions.id"))
    
    # Relationships
    requester = db.relationship("User", foreign_keys=[requester_id])
    helper = db.relationship("User", foreign_keys=[helper_id])
    assignment = db.relationship("Assignment", backref="help_submissions")
    
    def __repr__(self):
        return f"<HomeworkSubmission {self.id}: {self.title} - {self.status}>"
        

class User(UserMixin, db.Model):
    """Main user account - handles authentication and basic identity"""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    in_study_session = db.Column(db.Boolean(), default = False)
    # Auth
    username = db.Column(db.String(50), unique=True, nullable=True, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    pin = db.Column(db.String(200), nullable=False)
    fcm_token = db.Column(db.String(500), nullable=True)
    
    # Profile basics
    name = db.Column(db.String(100), nullable=False)
    bio = db.Column(db.String(500))
    avatar = db.Column(db.String(200))
    
    # Role & status
    role = db.Column(db.String(20), default="student")
    status = db.Column(db.String(30), default="pending_verification")
    email_verified = db.Column(db.Boolean, default=False)
    
    # Gamification
    reputation = db.Column(db.Integer, default=0, index=True)
    reputation_level = db.Column(db.String(20), default="Newbie")
    
    # Activity tracking
    last_active = db.Column(db.DateTime)
    login_streak = db.Column(db.Integer, default=0)
    total_posts = db.Column(db.Integer, default=0)
    total_helpful = db.Column(db.Integer, default=0)
    
    # Profile customization
    skills = db.Column(MutableList.as_mutable(db.JSON), default=list)
    learning_goals = db.Column(MutableList.as_mutable(db.JSON), default=list)
    study_schedule = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    
    # Privacy controls
    privacy_settings = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    notification_settings = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    connection_settings = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    help_streak_current = db.Column(db.Integer, nullable=False, default=0)
    help_streak_longest = db.Column(db.Integer, nullable=False, default=0)
    help_streak_last_updated = db.Column(db.DateTime, nullable=True)
    help_streak_frozen = db.Column(db.Boolean, nullable=False, default=False)

    # ========== HELP STATS ==========
    total_helps_given = db.Column(db.Integer, nullable=False, default=0)
    total_helps_received = db.Column(db.Integer, nullable=False, default=0)
    first_responder_count = db.Column(db.Integer, nullable=False, default=0)

    # ========== WEEKLY STATS ==========
    weekly_helps_count = db.Column(db.Integer, nullable=False, default=0)
    weekly_helps_last_reset = db.Column(db.Date, nullable=True)
    
    # Metadata
    user_metadata = db.Column(
        'metadata', 
        MutableDict.as_mutable(db.JSON), 
        default=lambda: {
            "search_history": [],
            "recent_views": [],
            "feed_preferences": {
                "default_filter": "all",
                "posts_per_page": 20,
                "show_images_preview": True
            },
            "ai_usage": {
                "total_requests": 0,
                "last_request_at": None
            }
        }
    )
    bookmark_folders = db.Column(MutableList.as_mutable(db.JSON), default=list)
    
    # Timestamps
    joined_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relationships
    student_profile = db.relationship('StudentProfile', backref='user', uselist=False, cascade="all, delete-orphan")
    waitlist_signup = db.relationship('WaitlistSignup', backref='user', uselist=False, cascade="all, delete-orphan")
    ai_usage_quota = db.relationship('AIUsageQuota', backref='user', uselist=False, cascade="all, delete-orphan")
    posts = db.relationship("Post", backref="author", lazy="dynamic", cascade="all, delete-orphan")
    comments = db.relationship("Comment", backref="author", lazy="dynamic", cascade="all, delete-orphan")
    onboarding_details = db.relationship('OnboardingDetails', backref='user', uselist=False, cascade="all, delete-orphan")
    threads_created = db.relationship("Thread", foreign_keys="Thread.creator_id", backref="creator", lazy="dynamic")
    badges = db.relationship("UserBadge", backref="user", lazy="dynamic", cascade="all, delete-orphan")
    bookmark_relations = db.relationship("Bookmark", backref="user", lazy="dynamic", cascade="all, delete-orphan")

    
    @property
    def is_active(self):
        return (
            self.email_verified and 
            self.status == "approved" and 
            self.username is not None and
            self.pin != "PENDING_VERIFICATION"
        )

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)
    
    def update_reputation_level(self):
        """Calculate and update reputation level"""
        if self.reputation < 51:
            self.reputation_level = "Newbie"
        elif self.reputation < 201:
            self.reputation_level = "Learner"
        elif self.reputation < 501:
            self.reputation_level = "Contributor"
        elif self.reputation < 1000:
            self.reputation_level = "Expert"
        else:
            self.reputation_level = "Master"

    def __repr__(self):
        return f"<User @{self.username or self.email}>"


class StudentProfile(db.Model):
    """Extended profile info specific to students"""
    __tablename__ = "student_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    pin = db.Column(db.String(200), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=True, index=True)
    
    # Academic info
    full_name = db.Column(db.String(120), nullable=False)
    department = db.Column(db.String(100), nullable=True, index=True)
    class_name = db.Column(db.String(50), nullable=True, index=True)
    
    # Optional info
    date_of_birth = db.Column(db.Date, nullable=True)
    guardian_name = db.Column(db.String(120))
    guardian_contact = db.Column(db.String(50))
    
    # Status
    status = db.Column(db.String(50), default="active")
    registered_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<Student @{self.user.username if self.user else 'Unknown'} - {self.department}>"


class OnboardingDetails(db.Model):
    __tablename__ = "onboarding_details"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True)
    email = db.Column(db.String(120), unique=True, nullable=False)

    department = db.Column(db.String(50))
    class_level = db.Column(db.String(20))

    subjects = db.Column(MutableList.as_mutable(db.JSON), default=list)
    learning_style = db.Column(db.String(300))
    study_preferences = db.Column(MutableList.as_mutable(db.JSON), default=list)
    help_subjects = db.Column(MutableList.as_mutable(db.JSON), default=list)
    strong_subjects = db.Column(MutableList.as_mutable(db.JSON), default=list)
    study_schedule = db.Column(MutableDict.as_mutable(db.JSON), default=dict)

    session_length = db.Column(db.String(100))
    last_updated = db.Column(db.DateTime)


class WaitlistSignup(db.Model):
    __tablename__ = "waitlist_signups"
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True)
    referral_code = db.Column(db.String(20), unique=True, nullable=False)
    referred_by = db.Column(db.String(20))
    referral_count = db.Column(db.Integer, default=0)
    waitlist_position = db.Column(db.Integer)
    signup_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    status = db.Column(db.String(20), default='waiting')


# ============================================================================
# CONTENT MODELS
# ============================================================================

class Post(db.Model):
    """Main content type - questions, discussions, resources"""
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # Content
    title = db.Column(db.String(200), nullable=False)
    text_content = db.Column(db.Text)
    post_type = db.Column(db.String(50), nullable=False, default="discussion", index=True)
    
    # Media
    resources = db.Column(MutableList.as_mutable(db.JSON))
    
    # Organization
    department = db.Column(db.String(100), index=True)
    tags = db.Column(MutableList.as_mutable(db.JSON), default=list)
    
    # Engagement metrics
    positive_reactions_count = db.Column(db.Integer, default=0)
    dislikes_count = db.Column(db.Integer, default=0)
    views_count = db.Column(db.Integer, default=0)
    comments_count = db.Column(db.Integer, default=0)
    bookmark_count = db.Column(db.Integer, default=0)
    helpful_reactions_count = db.Column(db.Integer, default=0)
    
    # Thread system
    thread_enabled = db.Column(db.Boolean, default=False)
    
    # Status flags
    is_solved = db.Column(db.Boolean, default=False)
    is_pinned = db.Column(db.Boolean, default=False)
    is_locked = db.Column(db.Boolean, default=False)
    
    # Timestamps
    posted_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    edited_at = db.Column(db.DateTime)
    solved_at = db.Column(db.DateTime)
    
    # Relationships
    comments = db.relationship("Comment", backref="post", lazy="dynamic", cascade="all, delete-orphan")
    threads = db.relationship("Thread", backref="post", lazy="dynamic", cascade="all, delete-orphan")
    reactions = db.relationship("PostReaction", backref="post", lazy="dynamic", cascade="all, delete-orphan")
    bookmarks = db.relationship("Bookmark", backref="post", lazy="dynamic", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Post {self.id}: {self.title[:30]}>"


class PostView(db.Model):
    """Track post views by users"""
    __tablename__ = "post_views"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    viewed_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'post_id', 'viewed_at', name='unique_daily_view'),
    )


class Comment(db.Model):
    """Comments on posts - supports nested replies"""
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=True)

    # Content
    text_content = db.Column(db.Text, nullable=False)
    resources = db.Column(MutableList.as_mutable(db.JSON))
    
    # Engagement
    likes_count = db.Column(db.Integer, default=0)
    helpful_count = db.Column(db.Integer, default=0)
    replies_count = db.Column(db.Integer, default=0)
    depth_level = db.Column(db.Integer, default=0, index=True)
    
    # Status
    is_solution = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)

    # Timestamps
    posted_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    edited_at = db.Column(db.DateTime)
    
    # Relationships
    replies = db.relationship(
        "Comment",
        backref=db.backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    likes = db.relationship("CommentLike", backref="comment", lazy="dynamic", cascade="all, delete-orphan")
    
    @property
    def direct_replies(self):
        return Comment.query.filter_by(
            parent_id=self.id,
            is_deleted=False
        ).order_by(Comment.posted_at.asc()).all()

    def __repr__(self):
        return f"<Comment {self.id} on Post {self.post_id}>"


class CommentHelpfulMark(db.Model):
    """Track which users marked comments as helpful"""
    __tablename__ = "comment_helpful_marks"
    
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    marked_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('comment_id', 'user_id', name='unique_helpful_mark'),
    )


# ============================================================================
# BOOKMARKS
# ============================================================================

class Bookmark(db.Model):
    """Save posts for later"""
    __tablename__ = "bookmarks"
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    # NEW: Reference to folder (nullable for backward compatibility)
    folder_id = db.Column(db.Integer, db.ForeignKey("bookmark_folders.id"), nullable=True, index=True)
    
    # OLD: Keep for backward compatibility during migration
    folder = db.Column(db.String(100), default="Saved", index=True)
    
    # Metadata
    notes = db.Column(db.Text)
    tags = db.Column(MutableList.as_mutable(db.JSON), default=list)
    
    # Timestamps
    bookmarked_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_accessed_at = db.Column(db.DateTime)
    
    __table_args__ = (
        db.UniqueConstraint('post_id', 'student_id', name='unique_bookmark'),
    )

    def __repr__(self):
        return f"<Bookmark: User {self.student_id} → Post {self.post_id}>"


class BookmarkFolder(db.Model):
    """Organized bookmark folders with metadata"""
    __tablename__ = "bookmark_folders"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    # Folder info
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300))
    icon = db.Column(db.String(50), default="📁")
    color = db.Column(db.String(20), default="#6B7280")
    
    # Organization
    position = db.Column(db.Integer, default=0)
    is_default = db.Column(db.Boolean, default=False)
    
    # Stats
    bookmark_count = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    bookmarks = db.relationship("Bookmark", backref="folder_obj", lazy="dynamic", cascade="all, delete-orphan")
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'name', name='unique_folder_per_user'),
    )
    
    def __repr__(self):
        return f"<BookmarkFolder {self.id}: {self.name}>"


# ============================================================================
# THREADS
# ============================================================================

class Thread(db.Model):
    """Private collaboration groups"""
    __tablename__ = "threads"

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=True, index=True)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    # Thread info
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    avatar = db.Column(db.String(300), nullable=True)
    
    # Settings
    is_open = db.Column(db.Boolean, default=True)
    max_members = db.Column(db.Integer, default=10)
    requires_approval = db.Column(db.Boolean, default=True)
    
    # Metadata
    department = db.Column(db.String(100), index=True)
    tags = db.Column(MutableList.as_mutable(db.JSON), default=list)
    
    # Stats
    member_count = db.Column(db.Integer, default=1)
    message_count = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_activity = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationships
    members = db.relationship("ThreadMember", backref="thread", lazy="dynamic", cascade="all, delete-orphan")
    join_requests = db.relationship("ThreadJoinRequest", backref="thread", lazy="dynamic", cascade="all, delete-orphan")
    messages = db.relationship("ThreadMessage", backref="thread", lazy="dynamic", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Thread {self.id}: {self.title}>"


class ThreadMember(db.Model):
    """Approved members of a thread"""
    __tablename__ = "thread_members"
    
    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("threads.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    role = db.Column(db.String(20), default="member")
    
    # Activity
    joined_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_read_at = db.Column(db.DateTime)
    messages_sent = db.Column(db.Integer, default=0)
    
    __table_args__ = (
        db.UniqueConstraint('thread_id', 'student_id', name='unique_thread_member'),
    )

    def __repr__(self):
        return f"<ThreadMember: User {self.student_id} in Thread {self.thread_id}>"


class ThreadJoinRequest(db.Model):
    """Pending requests to join threads"""
    __tablename__ = "thread_join_requests"
    
    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("threads.id"), nullable=False, index=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    message = db.Column(db.Text)
    status = db.Column(db.String(20), default="pending", index=True)
    
    requested_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    
    __table_args__ = (
        db.UniqueConstraint('thread_id', 'requester_id', name='unique_join_request'),
    )

    def __repr__(self):
        return f"<JoinRequest: User {self.requester_id} → Thread {self.thread_id} [{self.status}]>"


class ThreadMessage(db.Model):
    """Chat messages inside threads"""
    __tablename__ = "thread_messages"
    
    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("threads.id"), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    
    text_content = db.Column(db.Text, nullable=False)
    attachment = db.Column(db.String(255))
    attachment_type = db.Column(db.String(50))
    
    is_edited = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    
    sent_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    edited_at = db.Column(db.DateTime)

    def __repr__(self):
        return f"<ThreadMessage {self.id} in Thread {self.thread_id}>"


# ============================================================================
# CONNECTIONS & SOCIAL
# ============================================================================
class Connection(db.Model):
    """Friend/connection system"""
    __tablename__ = "connections"
    
    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    status = db.Column(db.String(20), default="pending", index=True)
    
    requested_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    responded_at = db.Column(db.DateTime)
    is_seen = db.Column(db.Boolean, default=False)
    
    connection_type = db.Column(db.String(30), default="connection")
    
    requester_notes = db.Column(db.Text)  # Private notes by requester
    receiver_notes = db.Column(db.Text)   # Private notes by receiver
    
    __table_args__ = (
        db.UniqueConstraint('requester_id', 'receiver_id', name='unique_connection'),
        db.CheckConstraint('requester_id != receiver_id', name='no_self_connection')
    )

    def __repr__(self):
        return f"<Connection: {self.requester_id} → {self.receiver_id} [{self.status}]>"




class Mention(db.Model):
    """Track @username mentions"""
    __tablename__ = "mentions"
    
    id = db.Column(db.Integer, primary_key=True)
    
    mentioned_in_type = db.Column(db.String(20), nullable=False, index=True)
    mentioned_in_id = db.Column(db.Integer, nullable=False, index=True)
    
    mentioned_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    mentioned_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    
    is_read = db.Column(db.Boolean, default=False)
    mentioned_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<Mention: @User{self.mentioned_user_id} in {self.mentioned_in_type} {self.mentioned_in_id}>"


class PostFollow(db.Model):
    """Follow posts for notifications"""
    __tablename__ = "post_follows"
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    followed_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    notify_on_comment = db.Column(db.Boolean, default=True)
    notify_on_solution = db.Column(db.Boolean, default=True)
    
    __table_args__ = (
        db.UniqueConstraint('post_id', 'student_id', name='unique_post_follow'),
    )

    def __repr__(self):
        return f"<Follow: User {self.student_id} → Post {self.post_id}>"


class Message(db.Model):
    """Private messaging between connected users"""
    __tablename__ = "messages"
    
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    resources = db.Column(MutableList.as_mutable(db.JSON), default=list)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    subject = db.Column(db.String(200), nullable=True)
    body = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(200), default='pending')
    client_temp_id = db.Column(db.String(300))
    
    sent_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    is_read = db.Column(db.Boolean, default=False, index=True)
    read_at = db.Column(db.DateTime)
    is_deleted = db.Column(db.Boolean, default=False, index=True)
    
    deleted_by_sender = db.Column(db.Boolean, default=False)
    deleted_by_receiver = db.Column(db.Boolean, default=False)
    parent_message_id = db.Column(db.Integer, db.ForeignKey("messages.id"), nullable=True, index=True)
    has_thread = db.Column(db.Boolean, default=False)
    thread_reply_count = db.Column(db.Integer, default=0)
    related_post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=True)
    related_session_id = db.Column(db.Integer, db.ForeignKey("study_session_calendar.id"), nullable=True)
    
    def __repr__(self):
        return f"<Message {self.id}: {self.sender_id} → {self.receiver_id}>"

class MessageReaction(db.Model):
    """
    Emoji reactions to direct messages
    """
    __tablename__ = 'message_reactions'
    
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Reaction data
    reaction_type = db.Column(db.String(50), nullable=False)  # 'love', 'fire', 'laugh', etc.
    emoji = db.Column(db.String(10), nullable=False)  # '❤️', '🔥', etc.
    
    reacted_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    message = db.relationship('Message', backref='reactions')
    user = db.relationship('User', backref='message_reactions')
    
    # Ensure one reaction per user per message
    __table_args__ = (
        db.UniqueConstraint('message_id', 'user_id', name='unique_user_reaction'),
    )
    
    def __repr__(self):
        return f'<MessageReaction {self.emoji} on message {self.message_id}>'




# ============================================================================
# STUDY SESSIONS & PEER TEACHING
# ============================================================================



class PeerTeachingRelationship(db.Model):
    """Formal mentor/mentee or peer teaching partnerships"""
    __tablename__ = 'peer_teaching_relationships'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Participants
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    learner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Teaching Context
    subject = db.Column(db.String(100), nullable=False)
    teaching_type = db.Column(db.String(50), default='peer')
    
    # Progress Tracking
    sessions_completed = db.Column(db.Integer, default=0)
    total_hours = db.Column(db.Float, default=0.0)
    topics_covered = db.Column(MutableList.as_mutable(db.JSON), default=list)
    
    # Learner Progress
    initial_skill_level = db.Column(db.Integer)
    current_skill_level = db.Column(db.Integer)
    skill_improvement = db.Column(db.Float, default=0.0)
    
    # Ratings & Feedback
    learner_rating = db.Column(db.Float)
    teacher_rating = db.Column(db.Float)
    learner_feedback = db.Column(db.Text)
    teacher_feedback = db.Column(db.Text)
    
    # Teaching Resources
    resources_shared = db.Column(MutableList.as_mutable(db.JSON), default=list)
    problems_solved_together = db.Column(db.Integer, default=0)
    
    # Status
    status = db.Column(db.String(20), default='active')
    is_active = db.Column(db.Boolean, default=True)
    
    # Goals & Outcomes
    learning_goals = db.Column(MutableList.as_mutable(db.JSON), default=list)
    goals_achieved = db.Column(MutableList.as_mutable(db.JSON), default=list)
    achievements = db.Column(MutableList.as_mutable(db.JSON), default=list)
    
    # Timestamps
    started_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    last_session_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    __table_args__ = (
        db.CheckConstraint('teacher_id != learner_id', name='check_different_users'),
        db.CheckConstraint('learner_rating >= 1 AND learner_rating <= 5', name='check_learner_rating'),
        db.CheckConstraint('teacher_rating >= 1 AND teacher_rating <= 5', name='check_teacher_rating'),
    )


class StudyBuddyRequest(db.Model):
    """Study partnership requests with matching criteria"""
    __tablename__ = "study_buddy_requests"
    
    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    subjects = db.Column(MutableList.as_mutable(db.JSON), default=list)
    availability = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    message = db.Column(db.Text)
    
    status = db.Column(db.String(20), default="pending", index=True)
    thread_id = db.Column(db.Integer, db.ForeignKey("threads.id"), nullable=True)
    
    requested_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    responded_at = db.Column(db.DateTime)
    
    __table_args__ = (
        db.UniqueConstraint('requester_id', 'receiver_id', name='unique_study_buddy_request'),
    )

    def __repr__(self):
        return f"<StudyBuddy: {self.requester_id} → {self.receiver_id} [{self.status}]>"


class StudyBuddyMatch(db.Model):
    """Active study buddy partnerships"""
    __tablename__ = "study_buddy_matches"
    
    id = db.Column(db.Integer, primary_key=True)
    user1_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    user2_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    subjects = db.Column(MutableList.as_mutable(db.JSON), default=list)
    thread_id = db.Column(db.Integer, db.ForeignKey("threads.id"))
    
    sessions_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    
    matched_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_activity = db.Column(db.DateTime)
    ended_at = db.Column(db.DateTime)
    
    __table_args__ = (
        db.UniqueConstraint('user1_id', 'user2_id', name='unique_study_match'),
    )

    def __repr__(self):
        return f"<StudyMatch: {self.user1_id} ↔ {self.user2_id}>"


# ============================================================================
# ENGAGEMENT & REACTIONS
# ============================================================================

class CommentLike(db.Model):
    """Like tracking for comments"""
    __tablename__ = "comment_likes"
    
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    liked_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('comment_id', 'student_id', name='unique_comment_like'),
    )

    def __repr__(self):
        return f"<CommentLike: User {self.student_id} → Comment {self.comment_id}>"


class PostReaction(db.Model):
    """Emoji reactions for posts"""
    __tablename__ = "post_reactions"
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    reaction_type = db.Column(db.String(20), nullable=False)
    reacted_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('post_id', 'student_id', name='unique_post_reaction'),
    )

    def __repr__(self):
        return f"<Reaction: {self.reaction_type} on Post {self.post_id}>"


class PostEvent(db.Model):
    """Track post events for badges and analytics"""
    __tablename__ = "post_events"
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    event_type = db.Column(db.String(50), nullable=False, index=True)
    event_data = db.Column(MutableDict.as_mutable(db.JSON), default=dict)
    triggered_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    processed = db.Column(db.Boolean, default=False, index=True)
    awarded_badge_id = db.Column(db.Integer, db.ForeignKey("badges.id"))
    
    __table_args__ = (
        db.UniqueConstraint('post_id', 'event_type', name='unique_post_event'),
    )


# ============================================================================
# GAMIFICATION
# ============================================================================

class Badge(db.Model):
    """Achievable badges"""
    __tablename__ = "badges"
    
    id = db.Column(db.Integer, primary_key=True)
    
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(100))
    category = db.Column(db.String(50), index=True)
    
    criteria = db.Column(MutableDict.as_mutable(db.JSON))
    
    rarity = db.Column(db.String(20), default="common")
    awarded_count = db.Column(db.Integer, default=0)
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<Badge: {self.name} [{self.rarity}]>"


class UserBadge(db.Model):
    """Badges earned by users"""
    __tablename__ = "user_badges"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    badge_id = db.Column(db.Integer, db.ForeignKey("badges.id"), nullable=False, index=True)
    
    earned_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    is_featured = db.Column(db.Boolean, default=False)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'badge_id', name='unique_user_badge'),
    )
    
    badge = db.relationship("Badge", backref="user_badges")

    def __repr__(self):
        return f"<UserBadge: User {self.user_id} earned Badge {self.badge_id}>"


class ReputationHistory(db.Model):
    """Log of all reputation changes"""
    __tablename__ = "reputation_history"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    action = db.Column(db.String(100), nullable=False)
    points_change = db.Column(db.Integer, nullable=False)
    
    related_type = db.Column(db.String(20))
    related_id = db.Column(db.Integer)
    
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    
    reputation_before = db.Column(db.Integer)
    reputation_after = db.Column(db.Integer)

    def __repr__(self):
        return f"<RepHistory: User {self.user_id} {self.points_change:+d} pts for {self.action}>"


# ============================================================================
# AI FEATURES
# ============================================================================

class AIConversation(db.Model):
    """AI chat conversations"""
    __tablename__ = "ai_conversations"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    
    # Conversation data
    title = db.Column(db.String(200), default="New Conversation")
    messages = db.Column(MutableList.as_mutable(db.JSON), default=list)
    
    # Context
    attachment = db.Column(db.String(200))
    related_post_id = db.Column(db.Integer, db.ForeignKey("posts.id"))
    related_comment_id = db.Column(db.Integer, db.ForeignKey("comments.id"))
    
    # Completion tracking
    last_incomplete_message = db.Column(db.Text, nullable=True)
    is_last_message_complete = db.Column(db.Boolean, default=True)
    error_count = db.Column(db.Integer, default=0)
    
    # Metadata
    total_messages = db.Column(db.Integer, default=0)
    tokens_used = db.Column(db.Integer, default=0)
    is_archived = db.Column(db.Boolean, default=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    last_message_at = db.Column(db.DateTime)


class AIUsageQuota(db.Model):
    """Track AI usage limits"""
    __tablename__ = "ai_usage_quotas"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True)
    
    # Daily limits
    daily_messages_limit = db.Column(db.Integer, default=50)
    daily_messages_used = db.Column(db.Integer, default=0)
    last_reset_date = db.Column(db.Date, default=datetime.date.today)
    last_message_time = db.Column(db.DateTime, default=datetime.datetime.utcnow)


# ============================================================================
# ANALYTICS & TRACKING
# ============================================================================

class UserActivity(db.Model):
    """Track daily user activity for heatmap and streaks"""
    __tablename__ = "user_activity"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    activity_date = db.Column(db.Date, default=datetime.date.today, nullable=False, index=True)
    
    # Daily counts
    posts_created = db.Column(db.Integer, default=0)
    comments_created = db.Column(db.Integer, default=0)
    threads_joined = db.Column(db.Integer, default=0)
    messages_sent = db.Column(db.Integer, default=0)
    helpful_count = db.Column(db.Integer, default=0)
    
    # Total score for the day
    activity_score = db.Column(db.Integer, default=0)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'activity_date', name='unique_daily_activity'),
    )

    def __repr__(self):
        return f"<Activity: User {self.user_id} on {self.activity_date}>"


class SearchIndex(db.Model):
    """Full-text search index for faster queries"""
    __tablename__ = "search_index"
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, unique=True, index=True)
    
    searchable_text = db.Column(db.Text)
    
    department = db.Column(db.String(100), index=True)
    post_type = db.Column(db.String(50), index=True)
    tags_text = db.Column(db.String(500), index=True)
    
    indexed_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<SearchIndex: Post {self.post_id}>"


# ============================================================================
# UTILITY & MODERATION
# ============================================================================

class Notification(db.Model):
    """In-app notifications"""
    __tablename__ = "notifications"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    link = db.Column(db.String(200))
    
    notification_type = db.Column(db.String(50), index=True)
    
    related_type = db.Column(db.String(20))
    related_id = db.Column(db.Integer)
    
    is_read = db.Column(db.Boolean, default=False, index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    read_at = db.Column(db.DateTime)

    def __repr__(self):
        return f"<Notification {self.id}: {self.notification_type} for User {self.user_id}>"


class PostReport(db.Model):
    """Content moderation"""
    __tablename__ = "post_reports"
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("posts.id"), nullable=False, index=True)
    reported_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    reason = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    status = db.Column(db.String(20), default="pending", index=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    review_notes = db.Column(db.Text)
    action_taken = db.Column(db.String(100))
    
    reported_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)

    def __repr__(self):
        return f"<Report {self.id}: Post {self.post_id} - {self.reason} [{self.status}]>"


class UserWarning(db.Model):
    """Track warnings for policy violations"""
    __tablename__ = "user_warnings"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    
    reason = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    severity = db.Column(db.String(20), default="low")
    
    issued_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    
    related_type = db.Column(db.String(20))
    related_id = db.Column(db.Integer)
    
    is_active = db.Column(db.Boolean, default=True)
    expires_at = db.Column(db.DateTime)
    
    issued_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f"<Warning: User {self.user_id} - {self.severity} [{self.reason}]>"


class ProfileChangeHistory(db.Model):
    """Audit trail for profile changes"""
    __tablename__ = "profile_change_history"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    
    field_changed = db.Column(db.String(100), nullable=False)
    old_value = db.Column(db.String(500))
    new_value = db.Column(db.String(500))
    
    change_type = db.Column(db.String(50), index=True)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(200))
    
    changed_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    def __repr__(self):
        return f"<ProfileChange: User {self.user_id} - {self.field_changed} [{self.change_type}]>"


class PasswordResetToken(db.Model):
    """Secure password reset tokens"""
    __tablename__ = "password_reset_tokens"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    
    token = db.Column(db.String(500), unique=True, nullable=False, index=True)
    
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime)
    
    def is_valid(self):
        return not self.used and datetime.datetime.utcnow() < self.expires_at

    def __repr__(self):
        return f"<PasswordResetToken for User {self.user_id}>"

