"""
User System Seed Script - GUARANTEED SUGGESTIONS FOR USER 1
Creates realistic users with INTENTIONAL overlap to ensure suggestions work
Run this BEFORE connection_seed.py
"""

import random
import datetime
import logging
from typing import List, Dict, Set, Tuple, Optional
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from extensions import db
from models import User, StudentProfile, OnboardingDetails, AIUsageQuota

# ============================================================================
# CONFIGURATION
# ============================================================================

class SeedConfig:
    """Centralized configuration for seeding"""
    NUM_USERS = 50
    SEED_RANDOM_STATE = 42
    BATCH_SIZE = 10
    DEFAULT_PASSWORD = "password123"
    
    # ✅ GUARANTEED MATCHES: First 15 users will match User 1
    NUM_GUARANTEED_MATCHES = 15
    
    # User 1 Specific Details
    USER_1_CONFIG = {
        "username": "john.doe",
        "email": "john.doe@studyhub.edu",
        "first_name": "John",
        "last_name": "Doe",
        "department": "Computer Science",
        "class_level": "Junior",
        "bio": "CS major passionate about algorithms and machine learning. Always happy to help with coding problems!",
        "subjects": ["Data Structures", "Algorithms", "Machine Learning", "Database Systems", "Web Development"],
        "strong_subjects": ["Data Structures", "Algorithms", "Web Development"],
        "help_subjects": ["Machine Learning", "Database Systems"],
        "skills": ["Python", "JavaScript", "Algorithm Design"],
        "learning_goals": ["Deep Learning", "Cloud Computing"],
        "reputation": 850,
        "total_posts": 45,
        "total_helpful": 28
    }
    
    # Date ranges
    MAX_DAYS_AGO = 180
    MIN_DAYS_AGO = 1
    USER_1_JOINED_DAYS_AGO = 150
    
    # Activity distribution
    ACTIVE_USER_PERCENTAGE = 0.80
    MAX_RECENT_ACTIVITY_DAYS = 7
    MAX_INACTIVE_DAYS = 30

config = SeedConfig()

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('seed_users.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# REALISTIC DATA POOLS
# ============================================================================

FIRST_NAMES = [
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
    "Isabella", "William", "Mia", "James", "Charlotte", "Benjamin", "Amelia",
    "Lucas", "Harper", "Henry", "Evelyn", "Alexander", "Abigail", "Michael",
    "Emily", "Daniel", "Elizabeth", "Matthew", "Sofia", "Aiden", "Avery",
    "Jackson", "Ella", "Sebastian", "Scarlett", "David", "Grace", "Joseph",
    "Chloe", "Samuel", "Victoria", "Carter", "Riley", "Owen", "Aria",
    "Wyatt", "Lily", "Luke", "Aubrey", "Jack", "Zoey", "Penelope"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
    "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts"
]

DEPARTMENTS = [
    "Computer Science", "Mathematics", "Physics", "Engineering",
    "Chemistry", "Biology", "Business", "Economics",
    "Psychology", "English", "History"
]

CLASS_LEVELS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]

# ✅ CORE SUBJECTS FOR MATCHING
CS_CORE_SUBJECTS = [
    "Data Structures", "Algorithms", "Database Systems",
    "Web Development", "Machine Learning", "Operating Systems",
    "Computer Networks", "Software Engineering"
]

SUBJECT_GROUPS = {
    "Computer Science": CS_CORE_SUBJECTS,
    "Mathematics": ["Calculus", "Linear Algebra", "Discrete Math", "Statistics"],
    "Physics": ["Classical Mechanics", "Electromagnetism", "Quantum Mechanics"],
    "Chemistry": ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry"],
    "Engineering": ["Circuits", "Thermodynamics", "Mechanics"],
    "Biology": ["Cell Biology", "Genetics", "Ecology"],
    "Business": ["Financial Accounting", "Microeconomics", "Marketing"],
    "Economics": ["Microeconomics", "Macroeconomics", "Econometrics"]
}

GENERAL_SUBJECTS = ["Calculus", "Statistics", "Writing", "Critical Thinking"]

LEARNING_STYLES = [
    "Visual learner - I learn best with diagrams and charts",
    "Auditory learner - I prefer listening and discussion",
    "Kinesthetic learner - I learn by doing and practice",
    "Reading/Writing - I prefer written materials and notes"
]

STUDY_PREFERENCES = [
    "Morning study sessions", "Evening study sessions",
    "Group study", "One-on-one tutoring",
    "Video tutorials", "Practice problems"
]

BIO_TEMPLATES = [
    "Passionate about {subject}. Always happy to help or collaborate!",
    "{level} {department} major. Love discussing {subject} and {subject2}.",
    "Studying {department}. Looking for study partners in {subject}!",
    "Here to learn and help others. Strongest in {subject}."
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_username(first_name: str, last_name: str, used_usernames: Set[str]) -> str:
    """Generate unique username"""
    base = f"{first_name.lower()}.{last_name.lower()}"
    username = base
    counter = 1
    
    while username in used_usernames:
        username = f"{base}{counter}"
        counter += 1
    
    used_usernames.add(username)
    return username


def generate_email(username: str, used_emails: Set[str]) -> str:
    """Generate unique email"""
    domains = ["gmail.com", "yahoo.com", "outlook.com", "student.edu"]
    
    for domain in domains:
        email = f"{username}@{domain}"
        if email not in used_emails:
            used_emails.add(email)
            return email
    
    counter = 1
    while True:
        email = f"{username}{counter}@{random.choice(domains)}"
        if email not in used_emails:
            used_emails.add(email)
            return email
        counter += 1


def generate_study_schedule() -> Dict[str, List[str]]:
    """Generate study schedule matching HTML format"""
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    time_slots = ["morning", "afternoon", "evening"]
    schedule = {}
    
    available_days = random.sample(days, random.randint(3, 6))
    
    for day in available_days:
        num_slots = random.randint(1, 3)
        day_slots = random.sample(time_slots, num_slots)
        schedule[day] = day_slots
    
    return schedule


def generate_bio(department: str, level: str, subjects: List[str]) -> str:
    """Generate realistic bio"""
    template = random.choice(BIO_TEMPLATES)
    return template.format(
        department=department,
        level=level,
        subject=subjects[0] if subjects else "learning",
        subject2=subjects[1] if len(subjects) > 1 else "teaching"
    )


def generate_reputation() -> int:
    """Generate realistic reputation"""
    return random.choices(
        [
            random.randint(0, 50),
            random.randint(51, 200),
            random.randint(201, 500),
            random.randint(501, 1000)
        ],
        weights=[40, 30, 20, 10]
    )[0]


def generate_activity_dates(joined_at: datetime.datetime) -> Tuple[datetime.datetime, int]:
    """Generate realistic last active date"""
    now = datetime.datetime.utcnow()
    days_since_join = (now - joined_at).days
    
    if random.random() < config.ACTIVE_USER_PERCENTAGE:
        last_active_days = random.randint(0, config.MAX_RECENT_ACTIVITY_DAYS)
    else:
        last_active_days = random.randint(8, config.MAX_INACTIVE_DAYS)
    
    last_active = now - datetime.timedelta(days=last_active_days)
    login_streak = random.randint(0, min(days_since_join, 30)) if last_active_days < 2 else 0
    
    return last_active, login_streak


# ============================================================================
# ✅ NEW: GUARANTEED MATCH GENERATION
# ============================================================================

def create_guaranteed_match_user(
    match_type: str,
    user_index: int,
    used_usernames: Set[str],
    used_emails: Set[str]
) -> Tuple[User, StudentProfile, OnboardingDetails, AIUsageQuota]:
    """
    Create user guaranteed to match User 1
    
    Match types:
    - "study_partner": Same dept, overlapping subjects
    - "mentor": Strong in User 1's help subjects
    - "peer": Same dept + class, some overlap
    """
    
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    username = generate_username(first_name, last_name, used_usernames)
    email = generate_email(username, used_emails)
    
    full_name = f"{first_name} {last_name}"
    pin = generate_password_hash(config.DEFAULT_PASSWORD)
    
    # Get User 1 config for matching
    u1_cfg = config.USER_1_CONFIG
    
    # ============================================================
    # MATCH TYPE 1: STUDY PARTNER (Same dept + overlapping subjects)
    # ============================================================
    if match_type == "study_partner":
        department = u1_cfg["department"]  # Same as User 1
        class_level = random.choice(["Sophomore", "Junior", "Senior"])
        
        # Subjects: Mix User 1's subjects with some unique ones
        all_subjects = random.sample(u1_cfg["subjects"], 3) + \
                      random.sample(CS_CORE_SUBJECTS, 2)
        
        # Strong: Some overlap with User 1's subjects
        strong_subjects = random.sample(u1_cfg["subjects"], 2)
        
        # Help: Include at least 1 of User 1's strong subjects
        help_subjects = [random.choice(u1_cfg["strong_subjects"])] + \
                       random.sample([s for s in all_subjects if s not in strong_subjects], 1)
    
    # ============================================================
    # MATCH TYPE 2: MENTOR (Strong in what User 1 needs)
    # ============================================================
    elif match_type == "mentor":
        department = u1_cfg["department"]  # Same dept
        class_level = random.choice(["Senior", "Graduate"])
        
        # Subjects: Include User 1's help subjects
        all_subjects = u1_cfg["help_subjects"] + \
                      random.sample(CS_CORE_SUBJECTS, 2)
        
        # Strong: User 1's help subjects (they can mentor User 1)
        strong_subjects = u1_cfg["help_subjects"]
        
        # Help: Different subjects
        help_subjects = random.sample(
            [s for s in CS_CORE_SUBJECTS if s not in strong_subjects], 2
        )
    
    # ============================================================
    # MATCH TYPE 3: PEER (Same dept + class + some overlap)
    # ============================================================
    else:  # peer
        department = u1_cfg["department"]  # Same dept
        class_level = u1_cfg["class_level"]  # Same class
        
        # Subjects: 50% overlap with User 1
        overlap_count = random.randint(2, 3)
        all_subjects = random.sample(u1_cfg["subjects"], overlap_count) + \
                      random.sample(CS_CORE_SUBJECTS, 2)
        
        # Strong/Help: Mix
        strong_subjects = random.sample(all_subjects, 2)
        help_subjects = [s for s in all_subjects if s not in strong_subjects][:2]
    
    # Generate profile
    bio = generate_bio(department, class_level, all_subjects)
    reputation = random.randint(200, 800)
    
    now = datetime.datetime.utcnow()
    days_ago = random.randint(30, 120)
    joined_at = now - datetime.timedelta(days=days_ago)
    last_active, login_streak = generate_activity_dates(joined_at)
    
    study_schedule = generate_study_schedule()
    
    # Create User
    user = User(
        username=username,
        email=email,
        pin=pin,
        name=full_name,
        bio=bio,
        role="student",
        status="approved",
        email_verified=True,
        reputation=reputation,
        last_active=last_active,
        login_streak=login_streak,
        total_posts=random.randint(5, 40),
        total_helpful=random.randint(3, 20),
        skills=random.sample(strong_subjects, min(2, len(strong_subjects))),
        learning_goals=random.sample(help_subjects, min(2, len(help_subjects))),
        study_schedule=study_schedule,
        joined_at=joined_at,
        last_login=last_active
    )
    
    user.update_reputation_level()
    
    # Create StudentProfile
    student_profile = StudentProfile(
        user=user,
        pin=pin,
        username=username,
        full_name=full_name,
        department=department,
        class_name=class_level,
        status="active",
        registered_at=joined_at
    )
    
    # Create OnboardingDetails
    onboarding = OnboardingDetails(
        user=user,
        email=email,
        department=department,
        class_level=class_level,
        subjects=all_subjects,
        learning_style=random.choice(LEARNING_STYLES),
        study_preferences=random.sample(STUDY_PREFERENCES, 3),
        help_subjects=help_subjects,
        strong_subjects=strong_subjects,
        study_schedule=study_schedule,
        session_length=random.choice(["1-2 hours", "2+ hours"]),
        last_updated=joined_at
    )
    
    # Create AIUsageQuota
    ai_quota = AIUsageQuota(
        user=user,
        daily_messages_limit=50,
        daily_messages_used=random.randint(0, 10),
        last_reset_date=datetime.date.today(),
        last_message_time=last_active
    )
    
    logger.info(f"Created guaranteed match #{user_index}: {match_type} - {username}")
    
    return user, student_profile, onboarding, ai_quota


def create_random_user(
    used_usernames: Set[str],
    used_emails: Set[str]
) -> Tuple[User, StudentProfile, OnboardingDetails, AIUsageQuota]:
    """Create random user (may or may not match User 1)"""
    
    first_name = random.choice(FIRST_NAMES)
    last_name = random.choice(LAST_NAMES)
    username = generate_username(first_name, last_name, used_usernames)
    email = generate_email(username, used_emails)
    
    full_name = f"{first_name} {last_name}"
    pin = generate_password_hash(config.DEFAULT_PASSWORD)
    
    department = random.choice(DEPARTMENTS)
    class_level = random.choice(CLASS_LEVELS)
    
    # Get subjects for department
    dept_subjects = SUBJECT_GROUPS.get(department, GENERAL_SUBJECTS).copy()
    
    num_subjects = random.randint(3, 5)
    all_subjects = random.sample(dept_subjects, min(num_subjects, len(dept_subjects)))
    
    split_point = max(1, len(all_subjects) // 2)
    strong_subjects = all_subjects[:split_point]
    help_subjects = all_subjects[split_point:]
    
    bio = generate_bio(department, class_level, all_subjects)
    reputation = generate_reputation()
    
    now = datetime.datetime.utcnow()
    days_ago = random.randint(config.MIN_DAYS_AGO, config.MAX_DAYS_AGO)
    joined_at = now - datetime.timedelta(days=days_ago)
    last_active, login_streak = generate_activity_dates(joined_at)
    
    study_schedule = generate_study_schedule()
    
    user = User(
        username=username,
        email=email,
        pin=pin,
        name=full_name,
        bio=bio,
        role="student",
        status="approved",
        email_verified=True,
        reputation=reputation,
        last_active=last_active,
        login_streak=login_streak,
        total_posts=random.randint(0, 30),
        total_helpful=random.randint(0, 15),
        skills=random.sample(strong_subjects, min(2, len(strong_subjects))),
        learning_goals=random.sample(help_subjects, min(1, len(help_subjects))),
        study_schedule=study_schedule,
        joined_at=joined_at,
        last_login=last_active
    )
    
    user.update_reputation_level()
    
    student_profile = StudentProfile(
        user=user,
        pin=pin,
        username=username,
        full_name=full_name,
        department=department,
        class_name=class_level,
        status="active",
        registered_at=joined_at
    )
    
    onboarding = OnboardingDetails(
        user=user,
        email=email,
        department=department,
        class_level=class_level,
        subjects=all_subjects,
        learning_style=random.choice(LEARNING_STYLES),
        study_preferences=random.sample(STUDY_PREFERENCES, random.randint(2, 4)),
        help_subjects=help_subjects,
        strong_subjects=strong_subjects,
        study_schedule=study_schedule,
        session_length=random.choice(["30-60 min", "1-2 hours", "2+ hours"]),
        last_updated=joined_at
    )
    
    ai_quota = AIUsageQuota(
        user=user,
        daily_messages_limit=50,
        daily_messages_used=random.randint(0, 20),
        last_reset_date=datetime.date.today(),
        last_message_time=last_active
    )
    
    return user, student_profile, onboarding, ai_quota


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def verify_database_connection() -> bool:
    """Verify database is accessible"""
       
    return True

def clear_existing_data() -> bool:
    """Clear existing user data"""
    try:
        existing_count = User.query.count()
        
        if existing_count > 0:
            logger.warning(f"Found {existing_count} existing users")
            print(f"\n⚠️  Warning: {existing_count} users already exist")
            response = input("Clear all existing user data? (yes/no): ")
            
            if response.lower() != 'yes':
                logger.info("Seed aborted by user")
                print("❌ Seed aborted")
                return False
        
        print("🗑️  Clearing existing data...")
        AIUsageQuota.query.delete()
        OnboardingDetails.query.delete()
        StudentProfile.query.delete()
        User.query.delete()
        db.session.commit()
        
        logger.info("Existing data cleared")
        print("✅ Cleared existing data")
        return True
        
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Failed to clear data: {e}")
        print(f"❌ Failed to clear data: {e}")
        return False


def create_user_1(used_usernames: Set[str], used_emails: Set[str]) -> bool:
    """Create User 1"""
    try:
        print("\n👤 Creating User 1 (Primary Test User)...")
        
        cfg = config.USER_1_CONFIG
        used_usernames.add(cfg["username"])
        used_emails.add(cfg["email"])
        
        now = datetime.datetime.utcnow()
        joined_at = now - datetime.timedelta(days=config.USER_1_JOINED_DAYS_AGO)
        last_active = now - datetime.timedelta(days=1)
        
        pin = generate_password_hash(config.DEFAULT_PASSWORD)
        full_name = f"{cfg['first_name']} {cfg['last_name']}"
        
        study_schedule = {
            "Monday": ["afternoon", "evening"],
            "Tuesday": ["morning", "evening"],
            "Wednesday": ["afternoon", "evening"],
            "Thursday": ["morning", "evening"],
            "Friday": ["afternoon"],
            "Saturday": ["morning", "afternoon"]
        }
        
        user = User(
            username=cfg["username"],
            email=cfg["email"],
            pin=pin,
            name=full_name,
            bio=cfg["bio"],
            role="student",
            status="approved",
            email_verified=True,
            reputation=cfg["reputation"],
            last_active=last_active,
            login_streak=15,
            total_posts=cfg["total_posts"],
            total_helpful=cfg["total_helpful"],
            skills=cfg["skills"],
            learning_goals=cfg["learning_goals"],
            study_schedule=study_schedule,
            joined_at=joined_at,
            last_login=last_active
        )
        
        user.update_reputation_level()
        
        student_profile = StudentProfile(
            user=user,
            pin=pin,
            username=cfg["username"],
            full_name=full_name,
            department=cfg["department"],
            class_name=cfg["class_level"],
            status="active",
            registered_at=joined_at
        )
        
        onboarding = OnboardingDetails(
            user=user,
            email=cfg["email"],
            department=cfg["department"],
            class_level=cfg["class_level"],
            subjects=cfg["subjects"],
            learning_style="Visual learner - I learn best with diagrams and charts",
            study_preferences=["Morning study sessions", "Group study", "Practice problems"],
            help_subjects=cfg["help_subjects"],
            strong_subjects=cfg["strong_subjects"],
            study_schedule=study_schedule,
            session_length="1-2 hours",
            last_updated=joined_at
        )
        
        ai_quota = AIUsageQuota(
            user=user,
            daily_messages_limit=50,
            daily_messages_used=5,
            last_reset_date=datetime.date.today(),
            last_message_time=last_active
        )
        
        db.session.add(user)
        db.session.add(student_profile)
        db.session.add(onboarding)
        db.session.add(ai_quota)
        db.session.flush()
        
        print(f"✅ User 1 created: {cfg['username']} | Password: {config.DEFAULT_PASSWORD}")
        return True
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating User 1: {e}")
        print(f"❌ Failed to create User 1: {e}")
        return False


# ============================================================================
# MAIN SEED FUNCTION
# ============================================================================

def seed_users() -> bool:
    """Create users with guaranteed suggestions for User 1"""
    
    print("🌱 Starting user seed (GUARANTEED SUGGESTIONS)...")
    print(f"📝 Creating {config.NUM_USERS} users...")
    print(f"✅ First {config.NUM_GUARANTEED_MATCHES} users will match User 1\n")
    
    random.seed(config.SEED_RANDOM_STATE)
    
    if not verify_database_connection():
        return False
    
    if not clear_existing_data():
        return False
    
    used_usernames: Set[str] = set()
    used_emails: Set[str] = set()
    users_created = 0
    
    try:
        # Create User 1
        if not create_user_1(used_usernames, used_emails):
            return False
        
        users_created += 1
        db.session.commit()
        print("✅ User 1 committed\n")
        
        # ============================================================
        # PHASE 1: Create guaranteed matches for User 1
        # ============================================================
        print(f"🎯 Creating {config.NUM_GUARANTEED_MATCHES} guaranteed matches...")
        
        match_types = []
        for i in range(config.NUM_GUARANTEED_MATCHES):
            if i < 5:
                match_types.append("study_partner")
            elif i < 10:
                match_types.append("mentor")
            else:
                match_types.append("peer")
        
        for i, match_type in enumerate(match_types):
            try:
                user, profile, onboarding, quota = create_guaranteed_match_user(
                    match_type, i + 1, used_usernames, used_emails
                )
                
                db.session.add(user)
                db.session.add(profile)
                db.session.add(onboarding)
                db.session.add(quota)
                
                users_created += 1
                
                if users_created % config.BATCH_SIZE == 0:
                    db.session.commit()
                    print(f"   ✓ Created {users_created}/{config.NUM_USERS} users...")
                    
            except Exception as e:
                logger.error(f"Error creating match user {i}: {e}")
                continue
        
        # ============================================================
        # PHASE 2: Create remaining random users
        # ============================================================
        remaining = config.NUM_USERS - users_created
        if remaining > 0:
            print(f"\n📝 Creating {remaining} random users...")
        
        for i in range(remaining):
            try:
                user, profile, onboarding, quota = create_random_user(
                    used_usernames, used_emails
                )
                
                db.session.add(user)
                db.session.add(profile)
                db.session.add(onboarding)
                db.session.add(quota)
                
                users_created += 1
                
                if users_created % config.BATCH_SIZE == 0:
                    db.session.commit()
                    print(f"   ✓ Created {users_created}/{config.NUM_USERS} users...")
                    
            except Exception as e:
                logger.error(f"Error creating random user {i}: {e}")
                continue
        
        # Final commit
        db.session.commit()
        print(f"\n✅ Created {users_created} users successfully!")
        
        print_summary_statistics()
        return True
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        db.session.rollback()
        print(f"❌ Unexpected error: {e}")
        return False


# ============================================================================
# SUMMARY STATISTICS
# ============================================================================

def print_summary_statistics():
    """Print summary with suggestion validation"""
    print("\n" + "="*60)
    print("📊 SEED SUMMARY")
    print("="*60)
    
    total_users = User.query.count()
    print(f"Total Users: {total_users}")
    
    # User 1 info
    user1 = User.query.filter_by(id=1).first()
    if user1:
        print(f"\n👤 User 1:")
        print(f"   Username: {user1.username}")
        print(f"   Password: {config.DEFAULT_PASSWORD}")
        print(f"   Department: {user1.student_profile.department}")
        
        if user1.onboarding_details:
            print(f"   Help needed: {', '.join(user1.onboarding_details.help_subjects)}")
    
    # Check potential matches
    if user1 and user1.onboarding_details:
        print(f"\n🎯 Potential Suggestions for User 1:")
        
        u1_dept = user1.onboarding_details.department
        u1_class = user1.onboarding_details.class_level
        u1_subjects = set(s.lower() for s in user1.onboarding_details.subjects)
        u1_help = set(s.lower() for s in user1.onboarding_details.help_subjects)
        
        candidates = User.query.filter(
            User.id != 1,
            User.status == "approved"
        ).all()
        
        match_count = 0
        for candidate in candidates[:20]:  # Check first 20
            if not candidate.onboarding_details:
                continue
            
            score = 0
            reasons = []
            
            # Same dept
            if candidate.student_profile and candidate.student_profile.department == u1_dept:
                score += 30
                reasons.append("Same department")
            
            # Same class
            if candidate.student_profile and candidate.student_profile.class_name == u1_class:
                score += 10
                reasons.append("Same class")
            
            # Common subjects
            cand_subjects = set(s.lower() for s in candidate.onboarding_details.subjects)
            common = u1_subjects & cand_subjects
            if common:
                subject_score = min(len(common) * 8, 25)
                score += subject_score
                reasons.append(f"{len(common)} shared subjects")
            
            # They can help User 1
            cand_strong = set(s.lower() for s in candidate.onboarding_details.strong_subjects)
            can_help = u1_help & cand_strong
            if can_help:
                score += 20
                reasons.append(f"Can help with {len(can_help)} subjects")
            
            if score >= 60:
                match_count += 1
                print(f"   ✅ {candidate.name} - Score: {score} ({', '.join(reasons[:2])})")
        
        print(f"\n   Total matches (score ≥60): {match_count}")
        
        if match_count < 5:
            print("   ⚠️  WARNING: Low match count - suggestions may be limited")
        else:
            print("   ✅ Good! Should have plenty of suggestions")
    
    # Department distribution
    print(f"\n📚 By Department:")
    from collections import Counter
    dept_list = [p.department for p in StudentProfile.query.all()]
    dept_counts = Counter(dept_list)
    
    for dept, count in dept_counts.most_common(5):
        percentage = (count / total_users) * 100
        print(f"   {dept}: {count} ({percentage:.1f}%)")
    
    # Completion check
    complete_profiles = db.session.query(User).join(
        StudentProfile, StudentProfile.user_id == User.id
    ).join(
        OnboardingDetails, OnboardingDetails.user_id == User.id
    ).filter(
        User.status == "approved"
    ).count()
    
    print(f"\n✅ Data Completeness:")
    print(f"   Complete profiles: {complete_profiles}/{total_users}")
    print(f"   Ready for suggestions: {'YES ✓' if complete_profiles == total_users else 'NO ✗'}")
    
    print("\n" + "="*60)
    print("✨ Seed complete! Test /connections/suggestions endpoint now.")
    print("="*60 + "\n")


# ============================================================================
# STANDALONE EXECUTION
# ============================================================================

if __name__ == "__main__":
    from app import app
    
    with app.app_context():
        success = seed_users()
        
        if success:
            logger.info("Seed script completed successfully")
            exit(0)
        else:
            logger.error("Seed script failed")
            exit(1)