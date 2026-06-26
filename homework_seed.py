"""
StudyHub - Comprehensive Homework Feature Seed Script
======================================================
Populates the database with realistic homework/assignment data for endpoint testing.

Focus:
  - User ID=1 gets a large, varied set of assignments (personal + shared)
  - User ID=1's accepted connections are used as helpers/requesters
  - Full HomeworkSubmission lifecycle: pending → submitted → reviewed → completed
  - Covers every endpoint in homework_system.py

Run AFTER user_seed.py and connection_seed.py.

Usage:
    python homework_seed.py
    python homework_seed.py --clear   # wipe existing homework data first
    python homework_seed.py --dry-run # preview counts without writing
"""

import sys
import random
import logging
import argparse
import datetime
from typing import List, Optional, Tuple

from sqlalchemy.exc import SQLAlchemyError, IntegrityError

# ---------------------------------------------------------------------------
# Bootstrap – allow running from project root
# ---------------------------------------------------------------------------
try:
    from app import app
    from extensions import db
    from models import (
        User, Connection, Assignment, HomeworkSubmission, Notification,
        ActivityFeed
    )
except ImportError as exc:
    print(f"❌ Import error: {exc}")
    print("   Make sure you run this from your project root directory.")
    sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

class SeedConfig:
    PRIMARY_USER_ID = 1
    RANDOM_SEED     = 99

    # ── Assignment volumes ────────────────────────────────────────────────
    # Assignments owned by User 1
    USER1_PRIVATE_ASSIGNMENTS   = 18   # not shared, personal to-do list
    USER1_SHARED_ASSIGNMENTS    = 22   # shared for help (have submissions)

    # Assignments owned by connections (that are shared so User 1 can help)
    CONNECTION_ASSIGNMENTS      = 30   # each connection owns 1–3 of these

    # Extra private assignments owned by connections (not shared)
    CONNECTION_PRIVATE_ASSIGNS  = 15

    # ── Submission volumes ────────────────────────────────────────────────
    # How many of the 22 shared assignments get >1 helper
    MULTI_HELPER_ASSIGNMENTS    = 8

    BATCH_SIZE = 25

    # ── Date windows ─────────────────────────────────────────────────────
    PAST_DAYS   = 90   # how far back to spread old assignments
    FUTURE_DAYS = 30   # how far forward due-dates can go

config = SeedConfig()
random.seed(config.RANDOM_SEED)

# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("seed_homework.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# REALISTIC DATA POOLS
# ============================================================================

SUBJECTS = [
    "Mathematics", "Physics", "Chemistry", "Biology",
    "Computer Science", "Data Structures", "Algorithms",
    "Linear Algebra", "Calculus", "Statistics",
    "Database Systems", "Web Development", "Machine Learning",
    "Discrete Math", "Operating Systems", "Software Engineering",
    "English Literature", "History", "Economics", "Psychology",
    "Philosophy", "Sociology", "Political Science", "Geography",
]

DIFFICULTIES = ["easy", "medium", "hard"]
DIFFICULTY_WEIGHTS = [0.25, 0.45, 0.30]

STATUSES = ["not_started", "in_progress", "completed"]

# ── Assignment titles per subject ─────────────────────────────────────────
ASSIGNMENT_TITLES = {
    "Mathematics": [
        "Integration by Parts Problem Set",
        "Differential Equations Worksheet",
        "Series and Sequences Assignment",
        "Matrix Operations Exercise",
        "Probability Theory Task",
    ],
    "Physics": [
        "Kinematics Lab Report",
        "Electromagnetic Fields Problem Set",
        "Quantum Mechanics Homework",
        "Thermodynamics Assignment",
        "Wave Optics Exercise",
    ],
    "Chemistry": [
        "Organic Chemistry Reaction Mechanisms",
        "Stoichiometry Problem Set",
        "Electrochemistry Lab Report",
        "Acid-Base Equilibrium Assignment",
        "Molecular Orbital Theory Exercise",
    ],
    "Biology": [
        "Cell Division and Mitosis Report",
        "Genetics Punnett Square Assignment",
        "Ecosystem Analysis Essay",
        "Protein Synthesis Problem Set",
        "Evolution and Natural Selection Review",
    ],
    "Computer Science": [
        "Binary Search Tree Implementation",
        "Sorting Algorithm Analysis",
        "Recursion Problem Set",
        "OOP Design Exercise",
        "Complexity Theory Assignment",
    ],
    "Data Structures": [
        "Linked List Implementation",
        "Stack and Queue Problems",
        "Graph Traversal Assignment",
        "Hash Table Design Exercise",
        "Heap and Priority Queue Task",
    ],
    "Algorithms": [
        "Dynamic Programming Problems",
        "Greedy Algorithm Assignment",
        "Divide and Conquer Exercise",
        "Graph Shortest Path Problems",
        "NP-Completeness Analysis",
    ],
    "Linear Algebra": [
        "Eigenvalue and Eigenvector Problems",
        "Vector Spaces Assignment",
        "Linear Transformation Exercise",
        "Matrix Decomposition Task",
        "Orthogonality Problem Set",
    ],
    "Calculus": [
        "Multivariable Calculus Problem Set",
        "Taylor Series Expansion Exercise",
        "Double and Triple Integrals",
        "Gradient and Directional Derivatives",
        "Optimization Problems",
    ],
    "Statistics": [
        "Hypothesis Testing Assignment",
        "Regression Analysis Task",
        "Probability Distributions Exercise",
        "Confidence Intervals Problem Set",
        "ANOVA and Chi-Square Test",
    ],
    "Database Systems": [
        "SQL Query Optimization Task",
        "ER Diagram Design Assignment",
        "Normalization Exercise",
        "Transaction Management Problem Set",
        "NoSQL Database Comparison Report",
    ],
    "Web Development": [
        "React Component Architecture",
        "REST API Design Assignment",
        "CSS Flexbox and Grid Exercise",
        "Authentication Flow Implementation",
        "Database Integration Task",
    ],
    "Machine Learning": [
        "Linear Regression Implementation",
        "Neural Network Design Exercise",
        "Feature Engineering Assignment",
        "Model Evaluation Problem Set",
        "Clustering Algorithm Task",
    ],
    "Discrete Math": [
        "Graph Theory Problem Set",
        "Combinatorics Assignment",
        "Boolean Algebra Exercise",
        "Set Theory and Logic Task",
        "Number Theory Problems",
    ],
    "Operating Systems": [
        "Process Scheduling Assignment",
        "Memory Management Exercise",
        "File System Design Task",
        "Deadlock Detection Problem Set",
        "Concurrency and Synchronization",
    ],
    "Software Engineering": [
        "UML Diagram Design Exercise",
        "Agile Sprint Planning Assignment",
        "Code Review and Refactoring Task",
        "Testing Strategy Problem Set",
        "Design Patterns Implementation",
    ],
}

# Generic fallbacks for subjects not in the map above
GENERIC_TITLES = [
    "Chapter Review and Analysis",
    "Weekly Problem Set",
    "Lab Report Submission",
    "Research Essay Draft",
    "End-of-Unit Assignment",
    "Concept Application Exercise",
    "Critical Thinking Task",
    "Group Project Contribution",
]

DESCRIPTIONS = [
    "Complete all questions thoroughly. Show your working where applicable.",
    "Refer to the textbook chapters 4–6 for background reading before starting.",
    "This is worth 20% of the final grade – take your time and be precise.",
    "You may discuss approaches with classmates but final answers must be your own.",
    "Submit via the online portal. Late submissions incur a 10% daily penalty.",
    "Use diagrams where they help clarify your explanations.",
    "Include at least three cited references in your write-up.",
    "Code tasks must include unit tests for full marks.",
    "Focus on efficiency – brute-force solutions will receive partial credit only.",
    "Compare at least two approaches and justify your chosen method.",
    "Ensure your report follows the standard format outlined in the course guide.",
    "Pair up with a study partner if you find parts challenging.",
]

SOLUTION_TEXTS = [
    "Here's my step-by-step breakdown:\n\n1. First I identified the key variables and constraints.\n2. Applied the relevant theorem to simplify the expression.\n3. Worked through the algebra carefully, checking each line.\n4. The final answer comes out to the value shown below.\n\nLet me know if any step is unclear and I can elaborate!",
    "I solved this by breaking it into smaller sub-problems:\n\n**Part A:** Used integration by substitution. Let u = 3x + 1, then du = 3dx.\n**Part B:** Applied the chain rule. The derivative is as follows...\n**Part C:** Combined both results to get the final expression.\n\nHappy to walk through any part in more detail.",
    "Great question! The trick here is recognising the pattern early:\n\n- The recurrence relation simplifies to a closed form.\n- Once you see it as a geometric series, everything falls into place.\n- Substituting back in confirms the answer.\n\nCode implementation is attached in my resources.",
    "I approached this problem using dynamic programming:\n\n```\ndefine dp[i] = optimal solution up to index i\nbase case: dp[0] = 0\ntransition: dp[i] = max(dp[i-1], dp[i-2] + value[i])\n```\n\nTime complexity: O(n), Space: O(1) with optimisation.",
    "Here is my solution with full working:\n\n**Setup:** Drew out the system diagram first.\n**Analysis:** Identified all forces / variables acting on the system.\n**Calculation:** Applied Newton's second law / Kirchhoff's laws as appropriate.\n**Result:** The answer is consistent with the expected range from the textbook.\n\nDouble-check the sign conventions on your end!",
    "I researched this extensively and here's what I found:\n\nThe primary concept revolves around the principle of superposition. When applied to this particular scenario, the combined effect yields a net result that can be computed as follows...\n\nSources:\n- Textbook Chapter 7, pages 142–148\n- Additional reading from the course portal",
    "Solution using first principles:\n\n1. Start with the definition.\n2. Apply the relevant lemma proved in lecture 9.\n3. Simplify using the identity we derived last week.\n4. Final answer confirmed numerically.\n\nTook me a while but once I saw the substitution it clicked!",
]

FEEDBACK_TEXTS = [
    "This is exactly what I needed – thank you so much! The step-by-step breakdown made it really easy to follow along.",
    "Really helpful! I had the right idea but was making an error in step 3. Now I see where I went wrong.",
    "Perfect explanation. I especially appreciated the alternative approach you showed in Part B.",
    "Saved me hours! The code example was really clear and I managed to adapt it for my own solution.",
    "Good solution but I think there might be a small error in line 4 – the coefficient should be 2, not 3. Otherwise great!",
    "Thank you! I understood the concept but was struggling to apply it. Your worked example cleared everything up.",
    "Brilliant – I can see exactly where my logic was off now. Will definitely reach out again.",
    "This is very thorough. I'll study each step carefully before my exam tomorrow. Really appreciate it!",
]

REACTION_TYPES = ["thanks", "lifesaver", "mind_blown", "perfect"]
REACTION_WEIGHTS = [0.30, 0.35, 0.15, 0.20]

NOTIFICATION_TYPES = [
    "homework_help_requested",
    "homework_solution_submitted",
    "homework_feedback_given",
    "homework_marked_helpful",
    "homework_completed",
]

# ============================================================================
# UTILITY HELPERS
# ============================================================================

def now() -> datetime.datetime:
    return datetime.datetime.utcnow()


def past(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime.datetime:
    return now() - datetime.timedelta(days=days, hours=hours, minutes=minutes)


def future(days: int) -> datetime.datetime:
    return now() + datetime.timedelta(days=days)


def rand_past(min_days: int = 1, max_days: int = config.PAST_DAYS) -> datetime.datetime:
    return past(days=random.randint(min_days, max_days))


def rand_future_due() -> datetime.datetime:
    """Return a due date spread across past-overdue, near-future, and upcoming."""
    roll = random.random()
    if roll < 0.15:
        # Overdue
        return past(days=random.randint(1, 14))
    elif roll < 0.35:
        # Due within 24 hours (urgent)
        return future(days=0) + datetime.timedelta(hours=random.randint(1, 23))
    elif roll < 0.55:
        # Due in 2–7 days
        return future(days=random.randint(2, 7))
    else:
        # Upcoming (1–30 days)
        return future(days=random.randint(8, config.FUTURE_DAYS))


def pick_title(subject: str) -> str:
    titles = ASSIGNMENT_TITLES.get(subject, GENERIC_TITLES)
    return random.choice(titles)


def pick_description() -> str:
    return random.choice(DESCRIPTIONS)


def pick_difficulty() -> str:
    return random.choices(DIFFICULTIES, weights=DIFFICULTY_WEIGHTS)[0]


def pick_reaction() -> str:
    return random.choices(REACTION_TYPES, weights=REACTION_WEIGHTS)[0]


def rand_response_seconds(min_h: int = 1, max_h: int = 72) -> int:
    return random.randint(min_h * 3600, max_h * 3600)


# ============================================================================
# FETCH HELPERS
# ============================================================================

def get_primary_user() -> Optional[User]:
    user = User.query.get(config.PRIMARY_USER_ID)
    if not user:
        logger.error(f"User ID={config.PRIMARY_USER_ID} not found.")
        print(f"❌ User ID={config.PRIMARY_USER_ID} does not exist. Run user_seed.py first.")
    return user


def get_accepted_connections(user: User) -> List[User]:
    """Return User objects that have an accepted connection with `user`."""
    connections = Connection.query.filter(
        db.or_(
            Connection.requester_id == user.id,
            Connection.receiver_id  == user.id
        ),
        Connection.status == "accepted"
    ).all()

    connected_ids = set()
    for c in connections:
        other_id = c.receiver_id if c.requester_id == user.id else c.requester_id
        connected_ids.add(other_id)

    users = User.query.filter(User.id.in_(connected_ids)).all()
    logger.info(f"Found {len(users)} accepted connections for User {user.id}")
    return users


# ============================================================================
# CLEAR EXISTING DATA
# ============================================================================

def clear_homework_data(force: bool = False) -> bool:
    """Wipe assignments and submissions."""
    try:
        sub_count   = HomeworkSubmission.query.count()
        assign_count = Assignment.query.count()

        if (sub_count + assign_count) == 0:
            print("ℹ️  No existing homework data to clear.")
            return True

        if not force:
            print(f"\n⚠️  Found {assign_count} assignments and {sub_count} submissions.")
            resp = input("Clear all existing homework data? (yes/no): ")
            if resp.lower() != "yes":
                print("❌ Clear aborted.")
                return False

        print("🗑️  Clearing homework data …")
        HomeworkSubmission.query.delete()
        Assignment.query.delete()
        db.session.commit()
        print("✅ Homework data cleared.")
        logger.info("Homework data cleared.")
        return True

    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Clear failed: {e}")
        print(f"❌ Clear failed: {e}")
        return False


# ============================================================================
# ASSIGNMENT FACTORY
# ============================================================================

def make_assignment(
    owner_id: int,
    subject: Optional[str] = None,
    status: Optional[str] = None,
    difficulty: Optional[str] = None,
    is_shared: bool = False,
    created_at: Optional[datetime.datetime] = None,
    due_date: Optional[datetime.datetime] = None,
) -> Assignment:
    subject    = subject    or random.choice(SUBJECTS)
    difficulty = difficulty or pick_difficulty()
    status     = status     or random.choices(
                                    ["not_started", "in_progress", "completed"],
                                    weights=[0.30, 0.40, 0.30]
                                )[0]
    created_at = created_at or rand_past(1, 60)
    due_date   = due_date   or rand_future_due()

    est_hours = None
    if random.random() < 0.75:
        est_hours = round(random.uniform(0.5, 8.0), 1)

    time_spent = 0
    if status != "not_started" and est_hours:
        pct = random.uniform(0.1, 1.0) if status == "in_progress" else random.uniform(0.8, 1.2)
        time_spent = int(est_hours * 60 * pct)

    completed_at = None
    if status == "completed":
        completed_at = created_at + datetime.timedelta(
            hours=random.randint(1, int(max(est_hours or 2, 1) * 2))
        )

    a = Assignment(
        user_id            = owner_id,
        title              = pick_title(subject),
        subject            = subject,
        description        = pick_description(),
        difficulty         = difficulty,
        status             = status,
        estimated_hours    = est_hours,
        time_spent_minutes = time_spent,
        is_shared_for_help = is_shared,
        due_date           = due_date,
        created_at         = created_at,
        completed_at       = completed_at,
        resources          = [],
        priority_score     = 0.0,
    )
    a.calculate_priority()
    return a


# ============================================================================
# SUBMISSION FACTORY
# ============================================================================

def make_submission(
    assignment: Assignment,
    requester_id: int,
    helper_id: int,
    target_status: str = "completed",
    base_time: Optional[datetime.datetime] = None,
) -> HomeworkSubmission:
    """
    Build a HomeworkSubmission at the requested lifecycle stage.

    Lifecycle order:
        pending → submitted → reviewed → completed
    """
    base_time = base_time or (assignment.created_at + datetime.timedelta(hours=random.randint(1, 12)))

    sub = HomeworkSubmission(
        assignment_id  = assignment.id,
        requester_id   = requester_id,
        helper_id      = helper_id,
        title          = assignment.title,
        description    = assignment.description,
        subject        = assignment.subject,
        difficulty     = assignment.difficulty,
        status         = "pending",
        created_at     = base_time,
        solution_resources = [],
        feedback_resources = [],
    )

    if target_status == "pending":
        return sub

    # ── submitted ────────────────────────────────────────────────────────
    submitted_delta = datetime.timedelta(seconds=rand_response_seconds(1, 48))
    sub.submitted_at       = base_time + submitted_delta
    sub.solution_text      = random.choice(SOLUTION_TEXTS)
    sub.response_time_seconds = int(submitted_delta.total_seconds())
    sub.status             = "submitted"

    if target_status == "submitted":
        return sub

    # ── reviewed (feedback given) ─────────────────────────────────────────
    feedback_delta = datetime.timedelta(hours=random.randint(1, 24))
    sub.feedback_at   = sub.submitted_at + feedback_delta
    sub.feedback_text = random.choice(FEEDBACK_TEXTS)
    sub.feedback_rating = random.randint(3, 5)
    sub.status        = "reviewed"

    if target_status == "reviewed":
        return sub

    # ── completed (marked helpful + reaction) ─────────────────────────────
    reaction_delta = datetime.timedelta(hours=random.randint(1, 12))
    sub.reaction_at       = sub.feedback_at + reaction_delta
    sub.is_marked_helpful = True
    sub.reaction_type     = pick_reaction()
    sub.status            = "completed"

    return sub


# ============================================================================
# NOTIFICATION FACTORY
# ============================================================================

def make_notification(
    user_id: int,
    notification_type: str,
    title: str,
    body: str,
    related_id: Optional[int] = None,
    is_read: bool = False,
    created_at: Optional[datetime.datetime] = None,
) -> Notification:
    read_at = None
    if is_read:
        created_at = created_at or rand_past(1, 30)
        read_at = created_at + datetime.timedelta(hours=random.randint(1, 48))

    return Notification(
        user_id           = user_id,
        title             = title,
        body              = body,
        notification_type = notification_type,
        related_type      = "assignment",
        related_id        = related_id,
        is_read           = is_read,
        created_at        = created_at or rand_past(1, 30),
        read_at           = read_at,
        link              = f"/homework/{related_id}" if related_id else None,
    )


# ============================================================================
# ACTIVITY FEED FACTORY
# ============================================================================

def make_activity(
    user_id: int,
    activity_type: str,
    data: dict,
    created_at: Optional[datetime.datetime] = None,
) -> ActivityFeed:
    created = created_at or rand_past(0, 1)  # Activity expires after 24h so keep recent
    return ActivityFeed(
        user_id       = user_id,
        activity_type = activity_type,
        activity_data = data,
        created_at    = created,
        expires_at    = created + datetime.timedelta(hours=24),
    )


# ============================================================================
# COMMIT HELPER
# ============================================================================

def batch_commit(items: list, label: str) -> Tuple[int, int]:
    """Add a list of ORM objects, committing in batches. Returns (ok, failed)."""
    ok, failed = 0, 0
    for i, item in enumerate(items, 1):
        try:
            db.session.add(item)
        except Exception as e:
            logger.error(f"Add error ({label} #{i}): {e}")
            failed += 1
            continue

        if i % config.BATCH_SIZE == 0:
            try:
                db.session.commit()
                logger.debug(f"{label}: committed batch at {i}")
            except (SQLAlchemyError, IntegrityError) as e:
                db.session.rollback()
                logger.error(f"Batch commit error ({label} #{i}): {e}")
                failed += config.BATCH_SIZE

        ok += 1

    try:
        db.session.commit()
    except (SQLAlchemyError, IntegrityError) as e:
        db.session.rollback()
        logger.error(f"Final commit error ({label}): {e}")
        failed += len(items) % config.BATCH_SIZE

    return ok, failed


# ============================================================================
# MAIN SEEDING LOGIC
# ============================================================================

def seed_homework(dry_run: bool = False) -> bool:
    """
    Master seeding function.

    Phase 1  – Private assignments for User 1 (not shared)
    Phase 2  – Shared assignments for User 1 (visible to connections)
    Phase 3  – Submissions on User 1's shared assignments (connections helping)
    Phase 4  – Assignments owned by connections (shared, User 1 can help)
    Phase 5  – User 1 helps connections (submissions where helper=1)
    Phase 6  – Extra private assignments owned by connections
    Phase 7  – Notifications
    Phase 8  – Activity feed entries
    """
    print("\n" + "=" * 65)
    print("📚 StudyHub Homework Seed Script")
    print("=" * 65)

    # ── prerequisites ────────────────────────────────────────────────────
    primary = get_primary_user()
    if not primary:
        return False

    connections = get_accepted_connections(primary)
    if not connections:
        print("⚠️  User 1 has no accepted connections. Seeding with limited data.")
        print("   Run connection_seed.py first for full coverage.")

    all_users = User.query.filter_by(status="approved").all()
    non_primary = [u for u in all_users if u.id != primary.id]

    if dry_run:
        print("\n🔍 DRY RUN – no data will be written.")
        print(f"   Primary user: ID={primary.id}  name='{primary.name}'")
        print(f"   Accepted connections: {len(connections)}")
        print(f"   All other users: {len(non_primary)}")
        print(f"\n   Would create:")
        print(f"     {config.USER1_PRIVATE_ASSIGNMENTS} private assignments for User 1")
        print(f"     {config.USER1_SHARED_ASSIGNMENTS}  shared assignments for User 1")
        print(f"     {config.CONNECTION_ASSIGNMENTS} assignments owned by connections (shared)")
        print(f"     {config.CONNECTION_PRIVATE_ASSIGNS} assignments owned by connections (private)")
        print(f"     Submissions covering all lifecycle stages")
        print(f"     Notifications + activity feed entries")
        return True

    # ════════════════════════════════════════════════════════════════════
    # PHASE 1 – Private assignments for User 1
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📝 Phase 1: Creating {config.USER1_PRIVATE_ASSIGNMENTS} private assignments for User 1 …")

    phase1_items = []
    subjects_used = random.sample(SUBJECTS, min(config.USER1_PRIVATE_ASSIGNMENTS, len(SUBJECTS)))

    for i in range(config.USER1_PRIVATE_ASSIGNMENTS):
        subject = subjects_used[i % len(subjects_used)]

        # Deliberately include overdue, urgent, upcoming for smart-suggestions coverage
        if i < 3:
            due = past(days=random.randint(1, 5))          # overdue
            status = "not_started"
        elif i < 6:
            due = future(days=0) + datetime.timedelta(hours=random.randint(2, 22))  # urgent
            status = random.choice(["not_started", "in_progress"])
        elif i < 10:
            due = future(days=random.randint(2, 7))         # soon
            status = "in_progress"
        else:
            due = future(days=random.randint(8, 30))        # upcoming
            status = random.choices(["not_started", "in_progress", "completed"],
                                    weights=[0.4, 0.4, 0.2])[0]

        a = make_assignment(
            owner_id   = primary.id,
            subject    = subject,
            status     = status,
            difficulty = pick_difficulty(),
            is_shared  = False,
            due_date   = due,
            created_at = rand_past(2, 45),
        )
        phase1_items.append(a)

    ok1, fail1 = batch_commit(phase1_items, "Phase1-PrivateAssignments")
    print(f"   ✅ {ok1} created, {fail1} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 2 – Shared assignments for User 1
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📤 Phase 2: Creating {config.USER1_SHARED_ASSIGNMENTS} shared assignments for User 1 …")

    phase2_items = []
    shared_subjects = random.choices(SUBJECTS, k=config.USER1_SHARED_ASSIGNMENTS)

    for i, subject in enumerate(shared_subjects):
        difficulty = pick_difficulty()

        # Mix of statuses – some still active, some completed
        if i < 5:
            status = "not_started"
            due    = future(days=random.randint(1, 14))
        elif i < 12:
            status = "in_progress"
            due    = future(days=random.randint(0, 10))
        else:
            status = "completed"
            due    = past(days=random.randint(1, 30))

        a = make_assignment(
            owner_id   = primary.id,
            subject    = subject,
            status     = status,
            difficulty = difficulty,
            is_shared  = True,
            due_date   = due,
            created_at = rand_past(1, 50),
        )
        phase2_items.append(a)

    ok2, fail2 = batch_commit(phase2_items, "Phase2-SharedAssignments")
    print(f"   ✅ {ok2} created, {fail2} failed")

    # Retrieve persisted shared assignments for User 1
    user1_shared = Assignment.query.filter_by(
        user_id=primary.id, is_shared_for_help=True
    ).all()
    logger.info(f"User 1 shared assignments in DB: {len(user1_shared)}")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 3 – Submissions on User 1's shared assignments
    #           (connections helping User 1)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🤝 Phase 3: Creating submissions on User 1's shared assignments …")

    if not connections:
        print("   ⚠️  Skipped – no accepted connections.")
    else:
        phase3_items = []
        lifecycle_stages = ["completed", "completed", "completed", "reviewed",
                            "submitted", "pending", "completed", "reviewed"]

        for idx, assignment in enumerate(user1_shared):
            # Decide how many helpers this assignment gets
            if idx < config.MULTI_HELPER_ASSIGNMENTS:
                num_helpers = random.randint(2, min(4, len(connections)))
            else:
                num_helpers = 1

            helpers = random.sample(connections, min(num_helpers, len(connections)))

            for helper_idx, helper in enumerate(helpers):
                stage = lifecycle_stages[(idx + helper_idx) % len(lifecycle_stages)]
                base_t = assignment.created_at + datetime.timedelta(
                    hours=random.randint(1, 6) + helper_idx * 2
                )

                sub = make_submission(
                    assignment   = assignment,
                    requester_id = primary.id,
                    helper_id    = helper.id,
                    target_status= stage,
                    base_time    = base_t,
                )
                phase3_items.append(sub)

        ok3, fail3 = batch_commit(phase3_items, "Phase3-User1Submissions")
        print(f"   ✅ {ok3} submissions created, {fail3} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 4 – Assignments owned by connections (shared so User 1 can help)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📋 Phase 4: Creating {config.CONNECTION_ASSIGNMENTS} shared assignments owned by connections …")

    phase4_items = []
    helpers_pool = connections if connections else non_primary[:10]

    if helpers_pool:
        per_connection = max(1, config.CONNECTION_ASSIGNMENTS // len(helpers_pool))
        remainder      = config.CONNECTION_ASSIGNMENTS % len(helpers_pool)

        for conn_idx, conn_user in enumerate(helpers_pool):
            count = per_connection + (1 if conn_idx < remainder else 0)
            for _ in range(count):
                subject = random.choice(SUBJECTS)
                status  = random.choices(
                    ["not_started", "in_progress", "completed"],
                    weights=[0.35, 0.45, 0.20]
                )[0]

                a = make_assignment(
                    owner_id   = conn_user.id,
                    subject    = subject,
                    status     = status,
                    difficulty = pick_difficulty(),
                    is_shared  = True,
                    due_date   = rand_future_due(),
                    created_at = rand_past(1, 45),
                )
                phase4_items.append(a)

        ok4, fail4 = batch_commit(phase4_items, "Phase4-ConnectionAssignments")
        print(f"   ✅ {ok4} created, {fail4} failed")
    else:
        print("   ⚠️  Skipped – no connection users available.")
        ok4 = 0

    # Retrieve those assignments
    if helpers_pool:
        conn_ids = [u.id for u in helpers_pool]
        connection_shared = Assignment.query.filter(
            Assignment.user_id.in_(conn_ids),
            Assignment.is_shared_for_help == True
        ).all()
    else:
        connection_shared = []

    # ════════════════════════════════════════════════════════════════════
    # PHASE 5 – User 1 helps connections
    #           (submissions where helper_id = User 1)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🎓 Phase 5: User 1 helping connections with their assignments …")

    phase5_items = []

    # We want a good spread: User 1 should have helped many, across all lifecycle stages
    if connection_shared:
        # Sample generously – up to 80% of connection assignments
        help_targets = random.sample(
            connection_shared,
            min(int(len(connection_shared) * 0.80), len(connection_shared))
        )

        # Stage distribution weighted toward completed/reviewed (shows rich data)
        stage_options = (
            ["completed"] * 12 +
            ["reviewed"]  *  6 +
            ["submitted"] *  5 +
            ["pending"]   *  3
        )

        for idx, assignment in enumerate(help_targets):
            stage  = stage_options[idx % len(stage_options)]
            base_t = assignment.created_at + datetime.timedelta(
                hours=random.randint(1, 8)
            )

            sub = make_submission(
                assignment   = assignment,
                requester_id = assignment.user_id,
                helper_id    = primary.id,
                target_status= stage,
                base_time    = base_t,
            )
            phase5_items.append(sub)

        ok5, fail5 = batch_commit(phase5_items, "Phase5-User1Helping")
        print(f"   ✅ {ok5} submissions created (User 1 as helper), {fail5} failed")
    else:
        print("   ⚠️  Skipped – no connection assignments available.")
        ok5 = 0

    # ════════════════════════════════════════════════════════════════════
    # PHASE 6 – Extra private assignments owned by connections
    #           (gives User 1's feed more diversity)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📓 Phase 6: Creating {config.CONNECTION_PRIVATE_ASSIGNS} private assignments for connections …")

    phase6_items = []
    if helpers_pool:
        for _ in range(config.CONNECTION_PRIVATE_ASSIGNS):
            owner = random.choice(helpers_pool)
            a = make_assignment(
                owner_id   = owner.id,
                is_shared  = False,
                created_at = rand_past(1, 60),
                due_date   = rand_future_due(),
            )
            phase6_items.append(a)

        ok6, fail6 = batch_commit(phase6_items, "Phase6-ConnectionPrivate")
        print(f"   ✅ {ok6} created, {fail6} failed")
    else:
        print("   ⚠️  Skipped.")
        ok6 = 0

    # ════════════════════════════════════════════════════════════════════
    # PHASE 7 – Notifications
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🔔 Phase 7: Generating notifications for User 1 …")

    phase7_items = []

    user1_assignments = Assignment.query.filter_by(user_id=primary.id).all()
    user1_subs_as_requester = HomeworkSubmission.query.filter_by(
        requester_id=primary.id
    ).limit(20).all()
    user1_subs_as_helper = HomeworkSubmission.query.filter_by(
        helper_id=primary.id
    ).limit(20).all()

    # Notifications for User 1 being helped
    for sub in user1_subs_as_requester[:15]:
        helper = User.query.get(sub.helper_id)
        helper_name = helper.name if helper else "Someone"

        if sub.status in ["submitted", "reviewed", "completed"]:
            phase7_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_solution_submitted",
                title             = "New solution for your assignment",
                body              = f"{helper_name} submitted a solution for '{sub.title}'",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.6,
                created_at        = sub.submitted_at,
            ))

        if sub.status in ["reviewed", "completed"] and sub.is_marked_helpful:
            phase7_items.append(make_notification(
                user_id           = helper.id if helper else primary.id,
                notification_type = "homework_marked_helpful",
                title             = "Your help was marked helpful! 🎉",
                body              = f"Your solution for '{sub.title}' was rated '{sub.reaction_type}'",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.5,
                created_at        = sub.reaction_at or sub.feedback_at,
            ))

    # Notifications for User 1 as helper
    for sub in user1_subs_as_helper[:15]:
        requester = User.query.get(sub.requester_id)
        req_name  = requester.name if requester else "Someone"

        if sub.status not in ["pending"]:
            phase7_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_feedback_given",
                title             = "Feedback on your solution",
                body              = f"{req_name} left feedback on your solution for '{sub.title}'",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.7,
                created_at        = sub.feedback_at or sub.submitted_at,
            ))

        if sub.is_marked_helpful:
            phase7_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_marked_helpful",
                title             = f"Reaction received: {sub.reaction_type} 🎉",
                body              = f"{req_name} reacted '{sub.reaction_type}' to your solution",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.5,
                created_at        = sub.reaction_at or sub.feedback_at,
            ))

    # A few unread "help requested" notifications for User 1 (connection shared an assignment)
    for assignment in random.sample(connection_shared[:20], min(8, len(connection_shared))):
        owner = User.query.get(assignment.user_id)
        if owner:
            phase7_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_help_requested",
                title             = "Connection needs help!",
                body              = f"{owner.name} shared '{assignment.title}' and needs help with {assignment.subject}",
                related_id        = assignment.id,
                is_read           = random.random() < 0.4,
                created_at        = assignment.created_at + datetime.timedelta(minutes=5),
            ))

    ok7, fail7 = batch_commit(phase7_items, "Phase7-Notifications")
    print(f"   ✅ {ok7} notifications created, {fail7} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 8 – Activity feed entries (last 24h so they show up live)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📡 Phase 8: Generating activity feed entries …")

    phase8_items = []

    # Recent activity for User 1
    for assignment in random.sample(user1_assignments[-5:], min(5, len(user1_assignments))):
        phase8_items.append(make_activity(
            user_id       = primary.id,
            activity_type = "assignment_created",
            data          = {"assignment_id": assignment.id, "title": assignment.title,
                             "subject": assignment.subject},
            created_at    = now() - datetime.timedelta(hours=random.randint(1, 20)),
        ))

    for sub in user1_subs_as_helper[-5:]:
        phase8_items.append(make_activity(
            user_id       = primary.id,
            activity_type = "homework_help_given",
            data          = {"submission_id": sub.id, "title": sub.title,
                             "subject": sub.subject, "status": sub.status},
            created_at    = now() - datetime.timedelta(hours=random.randint(1, 20)),
        ))

    # Activity from connections (visible in User 1's feed)
    for conn_user in connections[:8]:
        phase8_items.append(make_activity(
            user_id       = conn_user.id,
            activity_type = "homework_shared",
            data          = {"subject": random.choice(SUBJECTS),
                             "difficulty": pick_difficulty()},
            created_at    = now() - datetime.timedelta(hours=random.randint(0, 22)),
        ))

    ok8, fail8 = batch_commit(phase8_items, "Phase8-ActivityFeed")
    print(f"   ✅ {ok8} activity entries created, {fail8} failed")

    # ════════════════════════════════════════════════════════════════════
    # SUMMARY
    # ════════════════════════════════════════════════════════════════════
    print_summary(primary)
    return True


# ============================================================================
# SUMMARY PRINTER
# ============================================================================

def print_summary(primary: User):
    print("\n" + "=" * 65)
    print("📊 SEED SUMMARY")
    print("=" * 65)

    total_assignments = Assignment.query.count()
    total_submissions = HomeworkSubmission.query.count()

    u1_assignments = Assignment.query.filter_by(user_id=primary.id).count()
    u1_shared      = Assignment.query.filter_by(user_id=primary.id, is_shared_for_help=True).count()
    u1_private     = u1_assignments - u1_shared

    u1_as_requester = HomeworkSubmission.query.filter_by(requester_id=primary.id).count()
    u1_as_helper    = HomeworkSubmission.query.filter_by(helper_id=primary.id).count()

    print(f"\n📚 Assignments")
    print(f"   Total in DB              : {total_assignments}")
    print(f"   Owned by User 1          : {u1_assignments}")
    print(f"     ├─ Private (not shared): {u1_private}")
    print(f"     └─ Shared for help     : {u1_shared}")

    print(f"\n🤝 Submissions")
    print(f"   Total in DB              : {total_submissions}")
    print(f"   User 1 as requester      : {u1_as_requester}")
    print(f"   User 1 as helper         : {u1_as_helper}")

    # Submission status breakdown for User 1
    for stage in ["pending", "submitted", "reviewed", "completed"]:
        req_count = HomeworkSubmission.query.filter_by(
            requester_id=primary.id, status=stage).count()
        hlp_count = HomeworkSubmission.query.filter_by(
            helper_id=primary.id, status=stage).count()
        print(f"   [{stage:9s}] requester={req_count:3d}  helper={hlp_count:3d}")

    # Reaction breakdown for User 1 as helper
    print(f"\n⭐ Reactions on User 1's help:")
    for reaction in REACTION_TYPES:
        cnt = HomeworkSubmission.query.filter_by(
            helper_id=primary.id, reaction_type=reaction).count()
        print(f"   {reaction:12s}: {cnt}")

    helpful_count = HomeworkSubmission.query.filter_by(
        helper_id=primary.id, is_marked_helpful=True).count()
    print(f"\n   Marked helpful (User 1 as helper): {helpful_count}")

    # Subject spread for User 1's assignments
    user1_subs = Assignment.query.filter_by(user_id=primary.id).all()
    subjects_seen = {}
    for a in user1_subs:
        subjects_seen[a.subject] = subjects_seen.get(a.subject, 0) + 1
    top5 = sorted(subjects_seen.items(), key=lambda x: x[1], reverse=True)[:5]
    print(f"\n📖 Top subjects (User 1's assignments):")
    for subj, cnt in top5:
        print(f"   {subj:<25}: {cnt}")

    # Notification and activity counts
    notif_count = Notification.query.filter_by(user_id=primary.id).count()
    activity_count = ActivityFeed.query.filter_by(user_id=primary.id).count()
    print(f"\n🔔 Notifications for User 1  : {notif_count}")
    print(f"📡 Activity feed (User 1)    : {activity_count}")

    print("\n" + "=" * 65)
    print("✨ Homework seed complete! Ready for endpoint testing.")
    print("=" * 65 + "\n")

    logger.info("Seed summary printed successfully.")


# ============================================================================
# ENTRY POINT
# ============================================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="Seed homework feature data for StudyHub."
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing homework data before seeding (no confirmation prompt)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be created without writing to the database."
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    with app.app_context():
        if not args.dry_run:
            cleared = clear_homework_data(force=args.clear)
            if not cleared:
                sys.exit(1)

        success = seed_homework(dry_run=args.dry_run)

        if success:
            logger.info("Homework seed script completed successfully.")
            sys.exit(0)
        else:
            logger.error("Homework seed script failed.")
            sys.exit(1)
