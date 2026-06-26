"""
User System Seed Script — GUARANTEED SUGGESTIONS FOR USER 1
============================================================
Key fixes vs previous version
------------------------------
1. CLASS_LEVELS now uses ONLY names the endpoint's class_hierarchy dict
   recognises: Freshman / Sophomore / Junior / Senior / 100-500 Level.
   "Graduate" is removed — it mapped to 0 and broke mentor scoring.

2. Guaranteed-match users are created with class names that actually exist
   in the endpoint's hierarchy so mentor and study-partner scores fire.

3. Enough study-partner matches (score ≥ 30) and mentor matches (score ≥ 40)
   are seeded to guarantee the endpoint returns non-empty lists.

4. clear_existing_data() no longer asks for interactive confirmation —
   it clears unconditionally (FORCE_CLEAR = True).

Run this BEFORE connection_seed.py
"""

import random
import datetime
import logging
from typing import List, Dict, Set, Tuple, Optional
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import SQLAlchemyError
from extensions import db
from models import User, StudentProfile, OnboardingDetails, AIUsageQuota


# ============================================================================
# CONFIGURATION
# ============================================================================

class SeedConfig:
    NUM_USERS           = 60        # total users to create
    SEED_RANDOM_STATE   = 42
    BATCH_SIZE          = 10
    DEFAULT_PASSWORD    = "password123"
    FORCE_CLEAR         = True      # skip interactive confirmation

    # Guaranteed matches split:  study-partners | mentors | peers
    NUM_STUDY_PARTNERS  = 8
    NUM_MENTORS         = 7
    NUM_PEERS           = 5
    NUM_GUARANTEED_MATCHES = NUM_STUDY_PARTNERS + NUM_MENTORS + NUM_PEERS  # 20

    # ── User 1 profile ──────────────────────────────────────────────────────
    # User 1 is a "Junior" CS student so:
    #   study-partners  → same dept, same or adjacent class, overlapping subjects
    #   mentors         → same dept, class_level > Junior (Senior / 400 Level)
    USER_1_CONFIG = {
        "username":       "john.doe",
        "email":          "john.doe@studyhub.edu",
        "first_name":     "John",
        "last_name":      "Doe",
        "department":     "Computer Science",
        "class_level":    "Junior",          # maps to 3 in endpoint hierarchy
        "bio":            "CS major passionate about algorithms and ML. Happy to help!",
        "subjects":       ["Data Structures", "Algorithms", "Machine Learning",
                           "Database Systems", "Web Development"],
        "strong_subjects":["Data Structures", "Algorithms", "Web Development"],
        "help_subjects":  ["Machine Learning", "Database Systems"],
        "skills":         ["Python", "JavaScript", "Algorithm Design"],
        "learning_goals": ["Deep Learning", "Cloud Computing"],
        "reputation":     850,
        "total_posts":    45,
        "total_helpful":  28,
    }

    MAX_DAYS_AGO              = 180
    MIN_DAYS_AGO              = 1
    USER_1_JOINED_DAYS_AGO    = 150
    ACTIVE_USER_PERCENTAGE    = 0.80
    MAX_RECENT_ACTIVITY_DAYS  = 7
    MAX_INACTIVE_DAYS         = 30


config = SeedConfig()

# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("seed_users.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


# ============================================================================
# DATA POOLS
# ============================================================================

FIRST_NAMES = [
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
    "Isabella", "William", "Mia", "James", "Charlotte", "Benjamin", "Amelia",
    "Lucas", "Harper", "Henry", "Evelyn", "Alexander", "Abigail", "Michael",
    "Emily", "Daniel", "Elizabeth", "Matthew", "Sofia", "Aiden", "Avery",
    "Jackson", "Ella", "Sebastian", "Scarlett", "David", "Grace", "Joseph",
    "Chloe", "Samuel", "Victoria", "Carter", "Riley", "Owen", "Aria",
    "Wyatt", "Lily", "Luke", "Aubrey", "Jack", "Zoey", "Penelope",
    "Adaeze", "Chisom", "Emeka", "Tunde", "Ngozi", "Kelechi", "Amara",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
    "Okafor", "Nwosu", "Adeyemi", "Ibrahim", "Eze", "Bello", "Chukwu",
    "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker",
]

DEPARTMENTS = [
    "Computer Science", "Mathematics", "Physics", "Engineering",
    "Chemistry", "Biology", "Business", "Economics",
    "Psychology", "English", "History",
]

# ── IMPORTANT: only class names the endpoint's class_hierarchy recognises ──
# Endpoint dict:
#   "Freshman":1  "Sophomore":2  "Junior":3  "Senior":4
#   "100 Level":1 "200 Level":2  "300 Level":3 "400 Level":4 "500 Level":5
VALID_CLASS_LEVELS = [
    "Freshman", "Sophomore", "Junior", "Senior",          # UK/US names
    "100 Level", "200 Level", "300 Level", "400 Level",   # Nigerian university names
]

# Classes that are strictly ABOVE Junior (level 3) — needed for mentor candidates
SENIOR_CLASS_LEVELS = ["Senior", "400 Level", "500 Level"]

CS_CORE_SUBJECTS = [
    "Data Structures", "Algorithms", "Database Systems",
    "Web Development", "Machine Learning", "Operating Systems",
    "Computer Networks", "Software Engineering", "Computer Architecture",
    "Artificial Intelligence",
]

SUBJECT_GROUPS = {
    "Computer Science": CS_CORE_SUBJECTS,
    "Mathematics":      ["Calculus", "Linear Algebra", "Discrete Math", "Statistics", "Number Theory"],
    "Physics":          ["Classical Mechanics", "Electromagnetism", "Quantum Mechanics", "Thermodynamics"],
    "Chemistry":        ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Biochemistry"],
    "Engineering":      ["Circuits", "Thermodynamics", "Mechanics", "Signal Processing", "Control Systems"],
    "Biology":          ["Cell Biology", "Genetics", "Ecology", "Microbiology", "Physiology"],
    "Business":         ["Financial Accounting", "Microeconomics", "Marketing", "Business Strategy"],
    "Economics":        ["Microeconomics", "Macroeconomics", "Econometrics", "Game Theory"],
    "Psychology":       ["Cognitive Psychology", "Developmental Psychology", "Social Psychology"],
    "English":          ["Literature", "Creative Writing", "Linguistics", "Composition"],
    "History":          ["World History", "African History", "Modern History", "Political History"],
}

GENERAL_SUBJECTS = ["Calculus", "Statistics", "Writing", "Critical Thinking"]

LEARNING_STYLES = [
    "Visual learner - I learn best with diagrams and charts",
    "Auditory learner - I prefer listening and discussion",
    "Kinesthetic learner - I learn by doing and practice",
    "Reading/Writing - I prefer written materials and notes",
]

STUDY_PREFERENCES = [
    "Morning study sessions", "Evening study sessions",
    "Group study", "One-on-one tutoring",
    "Video tutorials", "Practice problems",
]

BIO_TEMPLATES = [
    "Passionate about {subject}. Always happy to help or collaborate!",
    "{level} {department} major. Love discussing {subject} and {subject2}.",
    "Studying {department}. Looking for study partners in {subject}!",
    "Here to learn and help others. Strongest in {subject}.",
    "{department} enthusiast. Currently working through {subject}.",
]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_username(first: str, last: str, used: Set[str]) -> str:
    base = f"{first.lower()}.{last.lower()}"
    uname, n = base, 1
    while uname in used:
        uname = f"{base}{n}"
        n += 1
    used.add(uname)
    return uname


def generate_email(username: str, used: Set[str]) -> str:
    domains = ["gmail.com", "yahoo.com", "outlook.com", "student.edu", "uni.edu.ng"]
    for d in domains:
        e = f"{username}@{d}"
        if e not in used:
            used.add(e)
            return e
    n = 1
    while True:
        e = f"{username}{n}@{random.choice(domains)}"
        if e not in used:
            used.add(e)
            return e
        n += 1


def generate_study_schedule() -> Dict[str, List[str]]:
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    slots = ["morning", "afternoon", "evening"]
    avail = random.sample(days, random.randint(3, 6))
    return {d: random.sample(slots, random.randint(1, 3)) for d in avail}


def generate_bio(dept: str, level: str, subjects: List[str]) -> str:
    t = random.choice(BIO_TEMPLATES)
    return t.format(
        department=dept,
        level=level,
        subject=subjects[0] if subjects else "learning",
        subject2=subjects[1] if len(subjects) > 1 else "teaching",
    )


def generate_reputation() -> int:
    return random.choices(
        [random.randint(0, 50), random.randint(51, 200),
         random.randint(201, 500), random.randint(501, 1000)],
        weights=[30, 30, 25, 15],
    )[0]


def generate_activity_dates(joined_at: datetime.datetime):
    now = datetime.datetime.utcnow()
    if random.random() < config.ACTIVE_USER_PERCENTAGE:
        days_ago = random.randint(0, config.MAX_RECENT_ACTIVITY_DAYS)
    else:
        days_ago = random.randint(8, config.MAX_INACTIVE_DAYS)
    last_active = now - datetime.timedelta(days=days_ago)
    days_since = (now - joined_at).days
    streak = random.randint(0, min(days_since, 30)) if days_ago < 2 else 0
    return last_active, streak


def _build_user(
    username, email, pin, full_name, bio, dept, class_level,
    subjects, strong_subjects, help_subjects,
    reputation, joined_at, last_active, login_streak,
    role="student", status="approved",
) -> Tuple[User, StudentProfile, OnboardingDetails, AIUsageQuota]:
    """Shared factory for User + StudentProfile + OnboardingDetails + AIUsageQuota."""
    study_schedule = generate_study_schedule()

    user = User(
        username=username,
        email=email,
        pin=pin,
        name=full_name,
        bio=bio,
        role=role,
        status=status,
        email_verified=True,
        reputation=reputation,
        last_active=last_active,
        login_streak=login_streak,
        total_posts=random.randint(3, 50),
        total_helpful=random.randint(2, 25),
        skills=subjects[:2],
        learning_goals=help_subjects[:2],
        study_schedule=study_schedule,
        joined_at=joined_at,
        last_login=last_active,
    )
    user.update_reputation_level()

    profile = StudentProfile(
        user=user,
        pin=pin,
        username=username,
        full_name=full_name,
        department=dept,
        class_name=class_level,       # ← class_name is what the endpoint reads
        status="active",
        registered_at=joined_at,
    )

    onboarding = OnboardingDetails(
        user=user,
        email=email,
        department=dept,
        class_level=class_level,
        subjects=subjects,
        learning_style=random.choice(LEARNING_STYLES),
        study_preferences=random.sample(STUDY_PREFERENCES, 3),
        help_subjects=help_subjects,
        strong_subjects=strong_subjects,
        study_schedule=study_schedule,
        session_length=random.choice(["1-2 hours", "2+ hours"]),
        last_updated=joined_at,
    )

    quota = AIUsageQuota(
        user=user,
        daily_messages_limit=50,
        daily_messages_used=random.randint(0, 10),
        last_reset_date=datetime.date.today(),
        last_message_time=last_active,
    )

    return user, profile, onboarding, quota


# ============================================================================
# USER-1 CREATION
# ============================================================================

def create_user_1(used_usernames: Set[str], used_emails: Set[str]) -> bool:
    try:
        print("\n👤 Creating User 1 (Primary Test User)...")
        cfg = config.USER_1_CONFIG
        used_usernames.add(cfg["username"])
        used_emails.add(cfg["email"])

        now       = datetime.datetime.utcnow()
        joined_at = now - datetime.timedelta(days=config.USER_1_JOINED_DAYS_AGO)
        last_active = now - datetime.timedelta(days=1)
        pin = generate_password_hash(config.DEFAULT_PASSWORD)
        full_name = f"{cfg['first_name']} {cfg['last_name']}"

        study_schedule = {
            "Monday":    ["afternoon", "evening"],
            "Tuesday":   ["morning", "evening"],
            "Wednesday": ["afternoon", "evening"],
            "Thursday":  ["morning", "evening"],
            "Friday":    ["afternoon"],
            "Saturday":  ["morning", "afternoon"],
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
            last_login=last_active,
        )
        user.update_reputation_level()

        profile = StudentProfile(
            user=user,
            pin=pin,
            username=cfg["username"],
            full_name=full_name,
            department=cfg["department"],
            class_name=cfg["class_level"],    # "Junior" → level 3
            status="active",
            registered_at=joined_at,
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
            last_updated=joined_at,
        )

        quota = AIUsageQuota(
            user=user,
            daily_messages_limit=50,
            daily_messages_used=5,
            last_reset_date=datetime.date.today(),
            last_message_time=last_active,
        )

        db.session.add_all([user, profile, onboarding, quota])
        db.session.flush()

        print(f"✅ User 1 created: @{cfg['username']}  |  Password: {config.DEFAULT_PASSWORD}")
        return True

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating User 1: {e}", exc_info=True)
        print(f"❌ Failed to create User 1: {e}")
        return False


# ============================================================================
# GUARANTEED MATCH CREATION
# ============================================================================

def create_guaranteed_match_user(
    match_type: str,
    user_index: int,
    used_usernames: Set[str],
    used_emails: Set[str],
) -> Tuple[User, StudentProfile, OnboardingDetails, AIUsageQuota]:
    """
    Create a user that is GUARANTEED to pass the endpoint's scoring thresholds.

    Study-partner threshold : sp_score >= 30
    Mentor threshold         : m_score  >= 40  (AND cand_level > current_level=3
                                                  AND same dept)

    Scoring breakdown (from endpoint):
      same dept      → +30 sp_score
      same class     → +10 sp_score
      shared subjects→ +8 each (max 25)
      same style     → +10 sp_score
      mentor base    → +20 m_score
      level_diff*15  → up to +30 m_score
      help_subjects  → +10 each (max 25) m_score
      reputation≥500 → +10 m_score
    """
    u1  = config.USER_1_CONFIG
    now = datetime.datetime.utcnow()

    first = random.choice(FIRST_NAMES)
    last  = random.choice(LAST_NAMES)
    uname = generate_username(first, last, used_usernames)
    email = generate_email(uname, used_emails)
    pin   = generate_password_hash(config.DEFAULT_PASSWORD)
    full  = f"{first} {last}"

    # ── STUDY PARTNER ─────────────────────────────────────────────────────────
    # Guaranteed sp_score:  dept(+30) + ≥3 shared subjects(+24) = 54 ✓
    if match_type == "study_partner":
        dept        = u1["department"]                          # same dept → +30
        class_level = random.choice(["Sophomore", "Junior"])   # same or adjacent
        # Take at least 3 subjects from User 1 so shared-subject score fires
        subjects = random.sample(u1["subjects"], 3) + random.sample(
            [s for s in CS_CORE_SUBJECTS if s not in u1["subjects"]], 2
        )
        strong_subjects = random.sample(u1["subjects"], 2)
        help_subjects   = random.sample(
            [s for s in u1["strong_subjects"]], 1
        ) + random.sample(
            [s for s in subjects if s not in strong_subjects], 1
        )
        reputation = random.randint(200, 700)

    # ── MENTOR ────────────────────────────────────────────────────────────────
    # Guaranteed m_score:
    #   base(+20) + dept implicit (same dept is required by the endpoint)
    #   level_diff ≥ 1 → +15   (Senior=4, Junior=3 → diff=1 → +15)
    #   strong_subjects ∩ help_subjects → at least 1 → +10
    #   Total ≥ 20+15+10 = 45 ✓
    elif match_type == "mentor":
        dept = u1["department"]                                  # same dept (required)
        # Must be > level 3 (Junior). Senior=4, 400 Level=4, 500 Level=5
        class_level = random.choice(["Senior", "400 Level"])
        subjects = list(u1["help_subjects"]) + random.sample(
            [s for s in CS_CORE_SUBJECTS if s not in u1["help_subjects"]], 3
        )
        # strong_subjects MUST intersect with User 1's help_subjects
        strong_subjects = list(u1["help_subjects"])             # → m_score +20
        help_subjects   = random.sample(
            [s for s in CS_CORE_SUBJECTS if s not in strong_subjects], 2
        )
        reputation = random.randint(500, 950)   # ≥500 gives bonus +10

    # ── PEER ──────────────────────────────────────────────────────────────────
    # Same dept + same class + some shared subjects → solid study-partner match
    else:
        dept        = u1["department"]
        class_level = u1["class_level"]                        # "Junior"
        subjects = random.sample(u1["subjects"], 3) + random.sample(
            [s for s in CS_CORE_SUBJECTS if s not in u1["subjects"]], 1
        )
        strong_subjects = random.sample(subjects, 2)
        help_subjects   = [s for s in subjects if s not in strong_subjects][:2]
        reputation = random.randint(150, 600)

    days_ago    = random.randint(30, 120)
    joined_at   = now - datetime.timedelta(days=days_ago)
    last_active, streak = generate_activity_dates(joined_at)
    bio = generate_bio(dept, class_level, subjects)

    logger.info(f"Guaranteed match #{user_index}: {match_type} — @{uname}")
    return _build_user(
        uname, email, pin, full, bio, dept, class_level,
        subjects, strong_subjects, help_subjects,
        reputation, joined_at, last_active, streak,
    )


# ============================================================================
# RANDOM USER CREATION
# ============================================================================

def create_random_user(
    used_usernames: Set[str],
    used_emails: Set[str],
) -> Tuple[User, StudentProfile, OnboardingDetails, AIUsageQuota]:
    first = random.choice(FIRST_NAMES)
    last  = random.choice(LAST_NAMES)
    uname = generate_username(first, last, used_usernames)
    email = generate_email(uname, used_emails)
    pin   = generate_password_hash(config.DEFAULT_PASSWORD)
    full  = f"{first} {last}"

    dept        = random.choice(DEPARTMENTS)
    class_level = random.choice(VALID_CLASS_LEVELS)   # only valid hierarchy values

    dept_subjects = SUBJECT_GROUPS.get(dept, GENERAL_SUBJECTS).copy()
    subjects = random.sample(dept_subjects, min(random.randint(3, 5), len(dept_subjects)))
    split    = max(1, len(subjects) // 2)
    strong_subjects = subjects[:split]
    help_subjects   = subjects[split:]

    reputation = generate_reputation()
    now        = datetime.datetime.utcnow()
    joined_at  = now - datetime.timedelta(days=random.randint(config.MIN_DAYS_AGO, config.MAX_DAYS_AGO))
    last_active, streak = generate_activity_dates(joined_at)
    bio = generate_bio(dept, class_level, subjects)

    return _build_user(
        uname, email, pin, full, bio, dept, class_level,
        subjects, strong_subjects, help_subjects,
        reputation, joined_at, last_active, streak,
    )


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def clear_existing_data() -> bool:
    """Clear all user-related tables unconditionally (no interactive prompt)."""
    try:
        count = User.query.count()
        if count > 0:
            print(f"🗑️  Auto-clearing {count} existing users (FORCE_CLEAR=True)...")
        AIUsageQuota.query.delete()
        OnboardingDetails.query.delete()
        StudentProfile.query.delete()
        User.query.delete()
        db.session.commit()
        print("✅ Existing data cleared")
        return True
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Failed to clear data: {e}")
        print(f"❌ Failed to clear data: {e}")
        return False


# ============================================================================
# MAIN SEED FUNCTION
# ============================================================================

def seed_users() -> bool:
    print("🌱 Starting user seed (GUARANTEED SUGGESTIONS FOR USER 1)...")
    print(f"📝 Target: {config.NUM_USERS} users  |  "
          f"Guaranteed matches: {config.NUM_GUARANTEED_MATCHES}\n")

    random.seed(config.SEED_RANDOM_STATE)

    if not clear_existing_data():
        return False

    used_usernames: Set[str] = set()
    used_emails:    Set[str] = set()
    users_created = 0

    try:
        # ── Create User 1 ────────────────────────────────────────────────────
        if not create_user_1(used_usernames, used_emails):
            return False
        users_created += 1
        db.session.commit()
        print("✅ User 1 committed\n")

        # ── Phase 1: Guaranteed matches ───────────────────────────────────────
        print(f"🎯 Creating {config.NUM_GUARANTEED_MATCHES} guaranteed matches...")

        match_schedule = (
            ["study_partner"] * config.NUM_STUDY_PARTNERS
            + ["mentor"]       * config.NUM_MENTORS
            + ["peer"]         * config.NUM_PEERS
        )

        for idx, mtype in enumerate(match_schedule, start=1):
            try:
                objects = create_guaranteed_match_user(mtype, idx, used_usernames, used_emails)
                db.session.add_all(objects)
                users_created += 1

                if users_created % config.BATCH_SIZE == 0:
                    db.session.commit()
                    print(f"   ✓ {users_created}/{config.NUM_USERS} users created...")

            except Exception as e:
                logger.error(f"Error on guaranteed match {idx}: {e}", exc_info=True)

        # ── Phase 2: Random filler users ─────────────────────────────────────
        remaining = config.NUM_USERS - users_created
        if remaining > 0:
            print(f"\n📝 Creating {remaining} random filler users...")

        for _ in range(remaining):
            try:
                objects = create_random_user(used_usernames, used_emails)
                db.session.add_all(objects)
                users_created += 1

                if users_created % config.BATCH_SIZE == 0:
                    db.session.commit()
                    print(f"   ✓ {users_created}/{config.NUM_USERS} users created...")

            except Exception as e:
                logger.error(f"Error creating random user: {e}", exc_info=True)

        db.session.commit()
        print(f"\n✅ {users_created} users created successfully!")
        print_summary_statistics()
        return True

    except Exception as e:
        db.session.rollback()
        logger.error(f"Unexpected error: {e}", exc_info=True)
        print(f"❌ Unexpected error: {e}")
        return False


# ============================================================================
# SUMMARY
# ============================================================================

def print_summary_statistics():
    from collections import Counter

    print("\n" + "=" * 60)
    print("📊 SEED SUMMARY")
    print("=" * 60)

    total = User.query.count()
    print(f"Total Users: {total}")

    user1 = User.query.filter_by(id=1).first()
    if user1:
        print(f"\n👤 User 1 (focus account):")
        print(f"   Username : {user1.username}")
        print(f"   Password : {config.DEFAULT_PASSWORD}")
        print(f"   Dept     : {user1.student_profile.department}")
        print(f"   Class    : {user1.student_profile.class_name}")
        if user1.onboarding_details:
            print(f"   Subjects : {', '.join(user1.onboarding_details.subjects)}")
            print(f"   Help     : {', '.join(user1.onboarding_details.help_subjects)}")

    # Simulate endpoint scoring to preview matches
    if user1 and user1.onboarding_details:
        u1_dept     = user1.student_profile.department
        u1_class    = user1.student_profile.class_name
        u1_subjects = set(s.lower() for s in user1.onboarding_details.subjects)
        u1_help     = set(s.lower() for s in user1.onboarding_details.help_subjects)
        hierarchy   = {
            "Freshman":1, "Sophomore":2, "Junior":3, "Senior":4,
            "100 Level":1, "200 Level":2, "300 Level":3, "400 Level":4, "500 Level":5,
        }
        u1_level = hierarchy.get(u1_class, 0)

        candidates = (
            db.session.query(User, StudentProfile, OnboardingDetails)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .join(OnboardingDetails, OnboardingDetails.user_id == User.id)
            .filter(User.id != 1, User.status == "approved")
            .all()
        )

        sp_hits, mentor_hits = 0, 0
        print(f"\n🎯 Endpoint preview (simulated scoring):")

        for cand, prof, onb in candidates:
            # Study-partner score
            sp = 0
            if prof.department == u1_dept:
                sp += 30
            if prof.class_name == u1_class:
                sp += 10
            common_subj = u1_subjects & set(s.lower() for s in onb.subjects)
            sp += min(len(common_subj) * 8, 25)
            if sp >= 30:
                sp_hits += 1

            # Mentor score
            cand_level = hierarchy.get(prof.class_name, 0)
            if cand_level > u1_level and prof.department == u1_dept:
                ms = 20 + min((cand_level - u1_level) * 15, 30)
                help_match = u1_help & set(s.lower() for s in onb.strong_subjects)
                ms += min(len(help_match) * 10, 25)
                if cand.reputation >= 500:
                    ms += 10
                if ms >= 40:
                    mentor_hits += 1

        print(f"   Study-partner candidates (score ≥ 30): {sp_hits}")
        print(f"   Mentor candidates        (score ≥ 40): {mentor_hits}")
        ok = sp_hits >= 5 and mentor_hits >= 3
        print(f"   Endpoint will return data: {'✅ YES' if ok else '⚠️  MAYBE LOW'}")

    # Dept distribution
    print(f"\n📚 Department distribution (top 5):")
    depts = [p.department for p in StudentProfile.query.all()]
    for dept, cnt in Counter(depts).most_common(5):
        print(f"   {dept}: {cnt} ({cnt/total*100:.1f}%)")

    complete = (
        db.session.query(User)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .join(OnboardingDetails, OnboardingDetails.user_id == User.id)
        .filter(User.status == "approved")
        .count()
    )
    print(f"\n✅ Complete profiles: {complete}/{total}")
    print("=" * 60)
    print("✨ Run connection_seed.py next.")
    print("=" * 60 + "\n")


# ============================================================================
# STANDALONE
# ============================================================================

if __name__ == "__main__":
    from app import app

    with app.app_context():
        success = seed_users()
        exit(0 if success else 1)
