"""
StudyHub - Comprehensive Homework Feature Seed Script (v2 - Expanded)
======================================================================
Populates the database with 200+ realistic homework/assignment records
for thorough endpoint testing.

Endpoints covered:
  GET  /homework/<id>/helpers                – Phase 3 (multi-helper assignments)
  GET  /activity/feed                        – Phase 8 (fresh activity entries)
  GET  /homework/my-streak                   – Phase 5 (User 1 helps often → streak)
  GET  /homework/champions                   – Phase 9 (WeeklyChampion records)
  GET  /assignments                          – Phase 1 + 2 (private + shared for User 1)
  POST /assignments                          – (live; seed gives context)
  PUT  /assignments/<id>                     – Phase 1/2 (varied statuses to update)
  DEL  /assignments/<id>                     – Phase 10 (soft-delete candidates)
  POST /assignments/<id>/quick-actions       – Phase 1 (overdue/urgent rows)
  GET  /homework/feed                        – Phase 4 (connection shared assignments)
  POST /homework/<id>/offer-help             – Phase 4 (unhelped shared assignments)
  GET  /homework/my-help-requests            – Phase 3 (submissions where requester=1)
  GET  /homework/helping                     – Phase 5 (submissions where helper=1)
  GET  /homework/submission/<id>             – All phases
  POST /homework/submission/<id>/submit-solution  – Phase 5 (pending subs for User 1)
  POST /homework/submission/<id>/give-feedback    – Phase 3 (submitted → reviewed)
  DEL  /homework/submission/<id>/cancel      – Phase 10 (cancellable subs)
  GET  /homework/stats                       – Phase 1-5 + ReputationHistory
  GET  /homework/stats/charts                – Phase 1-5 + UserActivity

Focus: User ID = 1 is the primary test account.

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
        User, Connection, Assignment, HomeworkSubmission,
        Notification, ActivityFeed, ReputationHistory,
        UserActivity, WeeklyChampion,
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
    RANDOM_SEED     = 42

    # ── Assignment volumes ────────────────────────────────────────────────
    # Assignments owned by User 1
    USER1_PRIVATE_ASSIGNMENTS    = 40   # not shared – tests GET /assignments private view
    USER1_SHARED_ASSIGNMENTS     = 45   # shared for help – rich source for submissions

    # Assignments owned by connections (shared so User 1 can help / browse feed)
    CONNECTION_ASSIGNMENTS       = 70   # spread across connections; most get ≥1 sub from User 1
    CONNECTION_PRIVATE_ASSIGNS   = 20   # extra unshared connection assignments

    # ── Submission volumes ────────────────────────────────────────────────
    MULTI_HELPER_ASSIGNMENTS     = 15   # how many of User 1's shared get >1 helper
    USER1_PENDING_SUBS_AS_HELPER = 8    # pending subs where helper=1 (to test submit-solution)
    CANCELLABLE_SUBS             = 6    # pending subs User 1 owns (to test /cancel)

    BATCH_SIZE = 30

    # ── Date windows ─────────────────────────────────────────────────────
    PAST_DAYS   = 120
    FUTURE_DAYS = 45


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
        logging.StreamHandler(),
    ],
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
    "Electrical Engineering", "Thermodynamics", "Network Security",
    "Mobile Development", "Cloud Computing", "Artificial Intelligence",
]

DIFFICULTIES = ["easy", "medium", "hard"]
DIFFICULTY_WEIGHTS = [0.22, 0.48, 0.30]

REACTION_TYPES   = ["thanks", "lifesaver", "mind_blown", "perfect"]
REACTION_WEIGHTS = [0.28, 0.35, 0.17, 0.20]

# ── Assignment titles per subject ─────────────────────────────────────────
ASSIGNMENT_TITLES = {
    "Mathematics": [
        "Integration by Parts Problem Set",
        "Differential Equations Worksheet",
        "Series and Sequences Assignment",
        "Matrix Operations Exercise",
        "Probability Theory Task",
        "Fourier Transform Application",
        "Complex Number Problem Set",
    ],
    "Physics": [
        "Kinematics Lab Report",
        "Electromagnetic Fields Problem Set",
        "Quantum Mechanics Homework",
        "Thermodynamics Assignment",
        "Wave Optics Exercise",
        "Fluid Dynamics Problem Set",
        "Relativity Concepts Assignment",
    ],
    "Chemistry": [
        "Organic Chemistry Reaction Mechanisms",
        "Stoichiometry Problem Set",
        "Electrochemistry Lab Report",
        "Acid-Base Equilibrium Assignment",
        "Molecular Orbital Theory Exercise",
        "Spectroscopy Analysis Task",
        "Polymer Chemistry Report",
    ],
    "Biology": [
        "Cell Division and Mitosis Report",
        "Genetics Punnett Square Assignment",
        "Ecosystem Analysis Essay",
        "Protein Synthesis Problem Set",
        "Evolution and Natural Selection Review",
        "Microbiology Case Study",
        "Human Anatomy Assessment",
    ],
    "Computer Science": [
        "Binary Search Tree Implementation",
        "Sorting Algorithm Analysis",
        "Recursion Problem Set",
        "OOP Design Exercise",
        "Complexity Theory Assignment",
        "Compiler Design Task",
        "Distributed Systems Overview",
    ],
    "Data Structures": [
        "Linked List Implementation",
        "Stack and Queue Problems",
        "Graph Traversal Assignment",
        "Hash Table Design Exercise",
        "Heap and Priority Queue Task",
        "Trie Implementation",
        "Segment Tree Problem Set",
    ],
    "Algorithms": [
        "Dynamic Programming Problems",
        "Greedy Algorithm Assignment",
        "Divide and Conquer Exercise",
        "Graph Shortest Path Problems",
        "NP-Completeness Analysis",
        "Backtracking Problem Set",
        "String Matching Algorithms",
    ],
    "Linear Algebra": [
        "Eigenvalue and Eigenvector Problems",
        "Vector Spaces Assignment",
        "Linear Transformation Exercise",
        "Matrix Decomposition Task",
        "Orthogonality Problem Set",
        "Singular Value Decomposition Lab",
        "Projection and Least Squares",
    ],
    "Calculus": [
        "Multivariable Calculus Problem Set",
        "Taylor Series Expansion Exercise",
        "Double and Triple Integrals",
        "Gradient and Directional Derivatives",
        "Optimization Problems",
        "Stokes Theorem Application",
        "Laplace Transform Problem Set",
    ],
    "Statistics": [
        "Hypothesis Testing Assignment",
        "Regression Analysis Task",
        "Probability Distributions Exercise",
        "Confidence Intervals Problem Set",
        "ANOVA and Chi-Square Test",
        "Bayesian Inference Assignment",
        "Time Series Analysis Report",
    ],
    "Database Systems": [
        "SQL Query Optimization Task",
        "ER Diagram Design Assignment",
        "Normalization Exercise",
        "Transaction Management Problem Set",
        "NoSQL Database Comparison Report",
        "Indexing Strategy Analysis",
        "Distributed Database Design",
    ],
    "Web Development": [
        "React Component Architecture",
        "REST API Design Assignment",
        "CSS Flexbox and Grid Exercise",
        "Authentication Flow Implementation",
        "Database Integration Task",
        "GraphQL API Design",
        "PWA Conversion Exercise",
    ],
    "Machine Learning": [
        "Linear Regression Implementation",
        "Neural Network Design Exercise",
        "Feature Engineering Assignment",
        "Model Evaluation Problem Set",
        "Clustering Algorithm Task",
        "Convolutional Network Lab",
        "Reinforcement Learning Basics",
    ],
    "Discrete Math": [
        "Graph Theory Problem Set",
        "Combinatorics Assignment",
        "Boolean Algebra Exercise",
        "Set Theory and Logic Task",
        "Number Theory Problems",
        "Recurrence Relations Assignment",
        "Generating Functions Exercise",
    ],
    "Operating Systems": [
        "Process Scheduling Assignment",
        "Memory Management Exercise",
        "File System Design Task",
        "Deadlock Detection Problem Set",
        "Concurrency and Synchronization",
        "Virtual Memory Analysis",
        "I/O Systems Design",
    ],
    "Software Engineering": [
        "UML Diagram Design Exercise",
        "Agile Sprint Planning Assignment",
        "Code Review and Refactoring Task",
        "Testing Strategy Problem Set",
        "Design Patterns Implementation",
        "DevOps Pipeline Design",
        "Requirements Engineering Lab",
    ],
    "Artificial Intelligence": [
        "Search Algorithm Problem Set",
        "Knowledge Representation Exercise",
        "Constraint Satisfaction Problems",
        "Planning and Reasoning Task",
        "Natural Language Processing Basics",
    ],
    "Cloud Computing": [
        "AWS Architecture Design",
        "Containerisation with Docker",
        "Kubernetes Deployment Exercise",
        "Serverless Function Lab",
        "Cloud Security Assessment",
    ],
    "Network Security": [
        "Cryptography Problem Set",
        "Vulnerability Assessment Report",
        "Firewall Rule Design Exercise",
        "Penetration Testing Methodology",
        "Zero Trust Architecture Overview",
    ],
}

GENERIC_TITLES = [
    "Chapter Review and Analysis",
    "Weekly Problem Set",
    "Lab Report Submission",
    "Research Essay Draft",
    "End-of-Unit Assignment",
    "Concept Application Exercise",
    "Critical Thinking Task",
    "Group Project Contribution",
    "Mid-Term Revision Notes",
    "Case Study Analysis",
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
    "This builds on last week's material – review your notes before attempting.",
    "All diagrams must be labelled clearly and referenced in the body text.",
    "Submit both the source code and a brief write-up explaining your approach.",
]

SOLUTION_TEXTS = [
    "Here's my step-by-step breakdown:\n\n1. First I identified the key variables and constraints.\n2. Applied the relevant theorem to simplify the expression.\n3. Worked through the algebra carefully, checking each line.\n4. The final answer comes out to the value shown below.\n\nLet me know if any step is unclear and I can elaborate!",
    "I solved this by breaking it into smaller sub-problems:\n\n**Part A:** Used integration by substitution. Let u = 3x + 1, then du = 3dx.\n**Part B:** Applied the chain rule carefully.\n**Part C:** Combined both results to get the final expression.\n\nHappy to walk through any part in more detail.",
    "Great question! The trick here is recognising the pattern early:\n\n- The recurrence relation simplifies to a closed form.\n- Once you see it as a geometric series, everything falls into place.\n- Substituting back in confirms the answer.\n\nCode implementation is included in my resources.",
    "I approached this problem using dynamic programming:\n\n```\ndefine dp[i] = optimal solution up to index i\nbase case: dp[0] = 0\ntransition: dp[i] = max(dp[i-1], dp[i-2] + value[i])\n```\n\nTime complexity: O(n), Space: O(1) with the rolling-variable optimisation.",
    "Here is my solution with full working:\n\n**Setup:** Drew out the system diagram first.\n**Analysis:** Identified all forces / variables acting on the system.\n**Calculation:** Applied Newton's second law as appropriate.\n**Result:** The answer is consistent with the expected range from the textbook.",
    "I researched this extensively and here's what I found:\n\nThe primary concept revolves around the principle of superposition. When applied to this particular scenario, the combined effect yields a net result that can be computed as follows...\n\nSources: Textbook Chapter 7, pages 142–148.",
    "Solution using first principles:\n\n1. Start with the definition.\n2. Apply the relevant lemma proved in lecture 9.\n3. Simplify using the identity we derived last week.\n4. Final answer confirmed numerically.\n\nTook me a while but once I saw the substitution it clicked!",
    "I built a complete working implementation:\n\n```python\ndef solve(n, memo={}):\n    if n in memo: return memo[n]\n    if n <= 1: return n\n    memo[n] = solve(n-1) + solve(n-2)\n    return memo[n]\n```\n\nAll edge cases are handled. Let me know if you'd like me to add more test cases.",
    "Here is a clean approach using the divide-and-conquer strategy:\n\n- Split the problem at the midpoint\n- Solve each half recursively\n- Merge in O(n) time\n\nOverall time complexity: O(n log n). This matches the lower bound for comparison-based sorting.",
    "After reviewing the problem carefully, I identified that it reduces to a standard shortest-path problem:\n\n1. Build the graph (O(E) time)\n2. Run Dijkstra's algorithm (O((V+E) log V))\n3. Extract the path from the predecessor array\n\nSee attached pseudocode for clarity.",
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
    "Wow, you explained this way better than my textbook does. Bookmarked this for revision.",
    "I especially liked the complexity analysis at the end – that's the part I always forget to include.",
]

# ============================================================================
# UTILITY HELPERS
# ============================================================================

def now() -> datetime.datetime:
    return datetime.datetime.utcnow()


def past(days: int = 0, hours: int = 0) -> datetime.datetime:
    return now() - datetime.timedelta(days=days, hours=hours)


def future(days: int) -> datetime.datetime:
    return now() + datetime.timedelta(days=days)


def rand_past(min_days: int = 1, max_days: int = config.PAST_DAYS) -> datetime.datetime:
    return past(days=random.randint(min_days, max_days))


def rand_future_due() -> datetime.datetime:
    """Return a due date spread across past-overdue, near-future, and upcoming."""
    roll = random.random()
    if roll < 0.15:
        return past(days=random.randint(1, 20))                                          # overdue
    elif roll < 0.30:
        return future(days=0) + datetime.timedelta(hours=random.randint(1, 23))          # due today/tonight
    elif roll < 0.50:
        return future(days=random.randint(1, 7))                                         # this week
    else:
        return future(days=random.randint(8, config.FUTURE_DAYS))                       # upcoming


def pick_title(subject: str) -> str:
    pool = ASSIGNMENT_TITLES.get(subject, GENERIC_TITLES)
    return random.choice(pool)


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
            Connection.receiver_id  == user.id,
        ),
        Connection.status == "accepted",
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
    """Wipe assignments, submissions, related notifications, activity, reputation, activity, champions."""
    try:
        sub_count    = HomeworkSubmission.query.count()
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
    if random.random() < 0.80:
        est_hours = round(random.uniform(0.5, 10.0), 1)

    time_spent = 0
    if status != "not_started" and est_hours:
        pct        = random.uniform(0.1, 1.0) if status == "in_progress" else random.uniform(0.8, 1.3)
        time_spent = int(est_hours * 60 * pct)

    completed_at = None
    if status == "completed":
        completed_at = created_at + datetime.timedelta(
            hours=random.randint(1, max(int((est_hours or 2) * 2), 2))
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

    Lifecycle order:  pending → submitted → reviewed → completed
    """
    base_time = base_time or (
        assignment.created_at + datetime.timedelta(hours=random.randint(1, 12))
    )

    sub = HomeworkSubmission(
        assignment_id      = assignment.id,
        requester_id       = requester_id,
        helper_id          = helper_id,
        title              = assignment.title,
        description        = assignment.description,
        subject            = assignment.subject,
        difficulty         = assignment.difficulty,
        status             = "pending",
        created_at         = base_time,
        solution_resources = [],
        feedback_resources = [],
    )

    if target_status == "pending":
        return sub

    # ── submitted ────────────────────────────────────────────────────────
    submitted_delta           = datetime.timedelta(seconds=rand_response_seconds(1, 48))
    sub.submitted_at          = base_time + submitted_delta
    sub.solution_text         = random.choice(SOLUTION_TEXTS)
    sub.response_time_seconds = int(submitted_delta.total_seconds())
    sub.status                = "submitted"

    if target_status == "submitted":
        return sub

    # ── reviewed (feedback given) ─────────────────────────────────────────
    feedback_delta    = datetime.timedelta(hours=random.randint(1, 36))
    sub.feedback_at   = sub.submitted_at + feedback_delta
    sub.feedback_text = random.choice(FEEDBACK_TEXTS)
    sub.feedback_rating = random.randint(3, 5)
    sub.status        = "reviewed"

    if target_status == "reviewed":
        return sub

    # ── completed (marked helpful + reaction) ─────────────────────────────
    reaction_delta        = datetime.timedelta(hours=random.randint(1, 12))
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
    from models import Notification
    created_at = created_at or rand_past(1, 45)
    read_at    = None
    if is_read:
        read_at = created_at + datetime.timedelta(hours=random.randint(1, 48))

    return Notification(
        user_id           = user_id,
        title             = title,
        body              = body,
        notification_type = notification_type,
        related_type      = "assignment",
        related_id        = related_id,
        is_read           = is_read,
        created_at        = created_at,
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
    created = created_at or (now() - datetime.timedelta(hours=random.randint(0, 22)))
    return ActivityFeed(
        user_id       = user_id,
        activity_type = activity_type,
        activity_data = data,
        created_at    = created,
        expires_at    = created + datetime.timedelta(hours=24),
    )


# ============================================================================
# REPUTATION HISTORY FACTORY  (powers /homework/stats)
# ============================================================================

def make_rep_history(
    user_id: int,
    action: str,
    points: int,
    related_type: str = "submission",
    related_id: Optional[int] = None,
    created_at: Optional[datetime.datetime] = None,
    rep_before: int = 0,
) -> ReputationHistory:
    return ReputationHistory(
        user_id           = user_id,
        action            = action,
        points_change     = points,
        related_type      = related_type,
        related_id        = related_id,
        created_at        = created_at or rand_past(1, 90),
        reputation_before = rep_before,
        reputation_after  = rep_before + points,
    )


# ============================================================================
# USER ACTIVITY FACTORY  (powers /homework/stats/charts heatmap)
# ============================================================================

def make_user_activity(
    user_id: int,
    activity_date: datetime.date,
    posts: int = 0,
    comments: int = 0,
    helpful: int = 0,
    messages: int = 0,
) -> UserActivity:
    score = posts * 5 + comments * 3 + helpful * 10 + messages * 1
    return UserActivity(
        user_id          = user_id,
        activity_date    = activity_date,
        posts_created    = posts,
        comments_created = comments,
        helpful_count    = helpful,
        messages_sent    = messages,
        activity_score   = score,
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

    Phase 1   – Private assignments for User 1 (40 rows, varied urgency/status)
    Phase 2   – Shared assignments for User 1 (45 rows, all statuses)
    Phase 3   – Submissions on User 1's shared assignments (connections helping User 1)
    Phase 4   – Assignments owned by connections (shared; User 1 can browse feed)
    Phase 5   – User 1 helps connections (submissions where helper_id=1)
    Phase 6   – Extra private assignments owned by connections
    Phase 7   – Pending subs where User 1 is helper (test submit-solution endpoint)
    Phase 8   – Cancellable subs where User 1 is requester (test /cancel endpoint)
    Phase 9   – Notifications for User 1
    Phase 10  – Activity feed entries (fresh, within 24h)
    Phase 11  – Reputation history for User 1 (powers /stats)
    Phase 12  – UserActivity rows for heatmap (/stats/charts)
    Phase 13  – WeeklyChampion records (/homework/champions)
    """
    print("\n" + "=" * 65)
    print("📚 StudyHub Homework Seed Script v2 (Expanded)")
    print("=" * 65)

    # ── prerequisites ────────────────────────────────────────────────────
    primary = get_primary_user()
    if not primary:
        return False

    connections = get_accepted_connections(primary)
    if not connections:
        print("⚠️  User 1 has no accepted connections. Seeding with limited data.")
        print("   Run connection_seed.py first for full coverage.")

    all_users  = User.query.filter_by(status="approved").all()
    non_primary = [u for u in all_users if u.id != primary.id]

    # Fall back to any non-primary users if no connections exist
    helpers_pool = connections if connections else non_primary[:15]

    if dry_run:
        print("\n🔍 DRY RUN – no data will be written.")
        print(f"   Primary user        : ID={primary.id}  name='{primary.name}'")
        print(f"   Accepted connections: {len(connections)}")
        print(f"   All other users     : {len(non_primary)}")
        print(f"\n   Would create:")
        print(f"     {config.USER1_PRIVATE_ASSIGNMENTS} private assignments for User 1")
        print(f"     {config.USER1_SHARED_ASSIGNMENTS} shared assignments for User 1")
        print(f"     {config.CONNECTION_ASSIGNMENTS} assignments owned by connections (shared)")
        print(f"     {config.CONNECTION_PRIVATE_ASSIGNS} assignments owned by connections (private)")
        print(f"     Submissions spanning all lifecycle stages")
        print(f"     {config.USER1_PENDING_SUBS_AS_HELPER} pending subs where User 1 is helper")
        print(f"     {config.CANCELLABLE_SUBS} cancellable pending subs for User 1")
        print(f"     Notifications, activity feed, reputation history, heatmap, champions")
        return True

    # ════════════════════════════════════════════════════════════════════
    # PHASE 1 – Private assignments for User 1
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📝 Phase 1: Creating {config.USER1_PRIVATE_ASSIGNMENTS} private assignments for User 1 …")

    phase1_items = []

    # Deliberately mix urgency scenarios so quick-actions endpoint has coverage
    urgency_scenarios = [
        # (due_fn, status, count) – overdue
        ("overdue",  "not_started",  5),
        ("overdue",  "in_progress",  3),
        # urgent (< 24h)
        ("urgent",   "not_started",  4),
        ("urgent",   "in_progress",  3),
        # this week
        ("soon",     "not_started",  5),
        ("soon",     "in_progress",  6),
        # upcoming
        ("upcoming", "not_started",  5),
        ("upcoming", "in_progress",  4),
        ("upcoming", "completed",    5),
    ]

    subjects_cycle = SUBJECTS * 5
    idx = 0
    for (urgency, status, count) in urgency_scenarios:
        for _ in range(count):
            if urgency == "overdue":
                due = past(days=random.randint(1, 20))
            elif urgency == "urgent":
                due = future(days=0) + datetime.timedelta(hours=random.randint(1, 22))
            elif urgency == "soon":
                due = future(days=random.randint(1, 6))
            else:
                due = future(days=random.randint(8, config.FUTURE_DAYS))

            subj = subjects_cycle[idx % len(subjects_cycle)]
            idx += 1

            a = make_assignment(
                owner_id   = primary.id,
                subject    = subj,
                status     = status,
                difficulty = pick_difficulty(),
                is_shared  = False,
                due_date   = due,
                created_at = rand_past(2, 60),
            )
            phase1_items.append(a)

    ok1, fail1 = batch_commit(phase1_items, "Phase1-PrivateAssignments")
    print(f"   ✅ {ok1} created, {fail1} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 2 – Shared assignments for User 1
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📤 Phase 2: Creating {config.USER1_SHARED_ASSIGNMENTS} shared assignments for User 1 …")

    phase2_items = []

    # Bucket distribution for shared:
    # not_started (want help immediately), in_progress, completed (past help sessions)
    buckets = (
        [("not_started", "future_near")] * 12 +
        [("in_progress", "future_mid")]  * 18 +
        [("completed",   "past")]        * 15
    )
    random.shuffle(buckets)
    shared_subjects = random.choices(SUBJECTS, k=config.USER1_SHARED_ASSIGNMENTS)

    for i, (status, timing) in enumerate(buckets[:config.USER1_SHARED_ASSIGNMENTS]):
        if timing == "future_near":
            due = future(days=random.randint(1, 10))
        elif timing == "future_mid":
            due = future(days=random.randint(0, 20))
        else:
            due = past(days=random.randint(1, 40))

        a = make_assignment(
            owner_id   = primary.id,
            subject    = shared_subjects[i],
            status     = status,
            difficulty = pick_difficulty(),
            is_shared  = True,
            due_date   = due,
            created_at = rand_past(1, 55),
        )
        phase2_items.append(a)

    ok2, fail2 = batch_commit(phase2_items, "Phase2-SharedAssignments")
    print(f"   ✅ {ok2} created, {fail2} failed")

    # Retrieve persisted shared assignments for User 1
    user1_shared = Assignment.query.filter_by(
        user_id=primary.id, is_shared_for_help=True
    ).all()
    user1_all    = Assignment.query.filter_by(user_id=primary.id).all()
    logger.info(f"User 1 shared assignments in DB: {len(user1_shared)}")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 3 – Submissions on User 1's shared assignments
    #           (connections helping User 1; tests my-help-requests + /helpers endpoint)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🤝 Phase 3: Creating submissions on User 1's shared assignments …")

    phase3_items = []
    user1_subs_as_requester = []   # collect for notification phase

    if not helpers_pool:
        print("   ⚠️  Skipped – no accepted connections.")
    else:
        # Lifecycle weights: complete > reviewed > submitted > pending
        lifecycle_pool = (
            ["completed"] * 14 +
            ["reviewed"]  *  8 +
            ["submitted"] *  6 +
            ["pending"]   *  4
        )

        for idx, assignment in enumerate(user1_shared):
            # First MULTI_HELPER_ASSIGNMENTS assignments get 2–4 helpers each
            if idx < config.MULTI_HELPER_ASSIGNMENTS:
                num_helpers = random.randint(2, min(4, len(helpers_pool)))
            else:
                num_helpers = 1

            sampled_helpers = random.sample(helpers_pool, min(num_helpers, len(helpers_pool)))

            for h_idx, helper in enumerate(sampled_helpers):
                stage  = lifecycle_pool[(idx + h_idx) % len(lifecycle_pool)]
                base_t = assignment.created_at + datetime.timedelta(
                    hours=random.randint(1, 8) + h_idx * 3
                )
                sub = make_submission(
                    assignment    = assignment,
                    requester_id  = primary.id,
                    helper_id     = helper.id,
                    target_status = stage,
                    base_time     = base_t,
                )
                phase3_items.append(sub)
                user1_subs_as_requester.append(sub)

        ok3, fail3 = batch_commit(phase3_items, "Phase3-User1Submissions")
        print(f"   ✅ {ok3} submissions created, {fail3} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 4 – Assignments owned by connections (shared)
    #           Tests: GET /homework/feed  and  POST /homework/<id>/offer-help
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📋 Phase 4: Creating {config.CONNECTION_ASSIGNMENTS} shared assignments owned by connections …")

    phase4_items = []

    if helpers_pool:
        per_conn  = max(1, config.CONNECTION_ASSIGNMENTS // len(helpers_pool))
        remainder = config.CONNECTION_ASSIGNMENTS % len(helpers_pool)

        for conn_idx, conn_user in enumerate(helpers_pool):
            count = per_conn + (1 if conn_idx < remainder else 0)
            for _ in range(count):
                subject = random.choice(SUBJECTS)
                status  = random.choices(
                    ["not_started", "in_progress", "completed"],
                    weights=[0.40, 0.40, 0.20],
                )[0]
                a = make_assignment(
                    owner_id   = conn_user.id,
                    subject    = subject,
                    status     = status,
                    difficulty = pick_difficulty(),
                    is_shared  = True,
                    due_date   = rand_future_due(),
                    created_at = rand_past(1, 50),
                )
                phase4_items.append(a)

        ok4, fail4 = batch_commit(phase4_items, "Phase4-ConnectionAssignments")
        print(f"   ✅ {ok4} created, {fail4} failed")
    else:
        print("   ⚠️  Skipped – no connection users available.")
        ok4 = 0

    # Retrieve connection shared assignments
    if helpers_pool:
        conn_ids = [u.id for u in helpers_pool]
        connection_shared = Assignment.query.filter(
            Assignment.user_id.in_(conn_ids),
            Assignment.is_shared_for_help == True,
        ).all()
    else:
        connection_shared = []

    # ════════════════════════════════════════════════════════════════════
    # PHASE 5 – User 1 helps connections
    #           Tests: GET /homework/helping  and all sub detail/solution endpoints
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🎓 Phase 5: User 1 helping connections …")

    phase5_items = []
    user1_subs_as_helper = []   # collect for notification phase

    if connection_shared:
        # Sample generously – ~85 % of connection assignments
        help_targets = random.sample(
            connection_shared,
            min(int(len(connection_shared) * 0.85), len(connection_shared)),
        )

        stage_pool = (
            ["completed"] * 15 +
            ["reviewed"]  *  8 +
            ["submitted"] *  5 +
            ["pending"]   *  2
        )

        for idx, assignment in enumerate(help_targets):
            stage  = stage_pool[idx % len(stage_pool)]
            base_t = assignment.created_at + datetime.timedelta(hours=random.randint(1, 10))

            sub = make_submission(
                assignment    = assignment,
                requester_id  = assignment.user_id,
                helper_id     = primary.id,
                target_status = stage,
                base_time     = base_t,
            )
            phase5_items.append(sub)
            user1_subs_as_helper.append(sub)

        ok5, fail5 = batch_commit(phase5_items, "Phase5-User1Helping")
        print(f"   ✅ {ok5} submissions created (User 1 as helper), {fail5} failed")
    else:
        print("   ⚠️  Skipped – no connection assignments available.")
        ok5 = 0

    # ════════════════════════════════════════════════════════════════════
    # PHASE 6 – Extra private assignments for connections (feed diversity)
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
    # PHASE 7 – Pending subs where User 1 is the helper
    #           Tests: POST /homework/submission/<id>/submit-solution
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📬 Phase 7: Creating {config.USER1_PENDING_SUBS_AS_HELPER} pending subs where User 1 is helper …")

    phase7_items = []
    # Find connection-owned shared assignments not yet helped by User 1
    helped_ids  = {sub.assignment_id for sub in user1_subs_as_helper}
    unhelpeds   = [a for a in connection_shared if a.id not in helped_ids]
    pending_targets = random.sample(unhelpeds, min(config.USER1_PENDING_SUBS_AS_HELPER, len(unhelpeds)))

    for assignment in pending_targets:
        base_t = now() - datetime.timedelta(hours=random.randint(1, 12))
        sub = make_submission(
            assignment    = assignment,
            requester_id  = assignment.user_id,
            helper_id     = primary.id,
            target_status = "pending",
            base_time     = base_t,
        )
        phase7_items.append(sub)

    ok7, fail7 = batch_commit(phase7_items, "Phase7-PendingHelpSubs")
    print(f"   ✅ {ok7} pending submissions created (User 1 as helper), {fail7} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 8 – Cancellable subs where User 1 is the requester
    #           Tests: DELETE /homework/submission/<id>/cancel
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🗑️  Phase 8: Creating {config.CANCELLABLE_SUBS} cancellable pending subs for User 1 …")

    phase8_items = []
    # Use helpers that haven't submitted yet
    if helpers_pool and user1_shared:
        cancel_targets = random.sample(user1_shared, min(config.CANCELLABLE_SUBS, len(user1_shared)))
        used_helpers   = set()

        for assignment in cancel_targets:
            avail = [h for h in helpers_pool if h.id not in used_helpers]
            if not avail:
                avail = helpers_pool
            helper = random.choice(avail)
            used_helpers.add(helper.id)

            base_t = now() - datetime.timedelta(hours=random.randint(1, 6))
            sub = make_submission(
                assignment    = assignment,
                requester_id  = primary.id,
                helper_id     = helper.id,
                target_status = "pending",
                base_time     = base_t,
            )
            phase8_items.append(sub)

        ok8, fail8 = batch_commit(phase8_items, "Phase8-CancellableSubs")
        print(f"   ✅ {ok8} cancellable pending submissions created, {fail8} failed")
    else:
        print("   ⚠️  Skipped.")
        ok8 = 0

    # ════════════════════════════════════════════════════════════════════
    # PHASE 9 – Notifications for User 1
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🔔 Phase 9: Generating notifications for User 1 …")

    phase9_items = []

    # Reload from DB to get persisted IDs
    db_subs_as_requester = HomeworkSubmission.query.filter_by(
        requester_id=primary.id
    ).limit(30).all()
    db_subs_as_helper = HomeworkSubmission.query.filter_by(
        helper_id=primary.id
    ).limit(30).all()

    # Notifications: someone helped User 1
    for sub in db_subs_as_requester[:20]:
        helper = User.query.get(sub.helper_id)
        helper_name = helper.name if helper else "Someone"

        if sub.status in ["submitted", "reviewed", "completed"]:
            phase9_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_solution_submitted",
                title             = "New solution for your assignment",
                body              = f"{helper_name} submitted a solution for '{sub.title}'",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.55,
                created_at        = sub.submitted_at,
            ))

        if sub.status in ["reviewed", "completed"] and sub.is_marked_helpful:
            phase9_items.append(make_notification(
                user_id           = helper.id if helper else primary.id,
                notification_type = "homework_marked_helpful",
                title             = "Your help was marked helpful! 🎉",
                body              = f"Your solution for '{sub.title}' was rated '{sub.reaction_type}'",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.50,
                created_at        = sub.reaction_at or sub.feedback_at,
            ))

    # Notifications: User 1 got feedback on their solutions
    for sub in db_subs_as_helper[:20]:
        requester = User.query.get(sub.requester_id)
        req_name  = requester.name if requester else "Someone"

        if sub.status not in ["pending"]:
            phase9_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_feedback_given",
                title             = "Feedback on your solution",
                body              = f"{req_name} left feedback on your solution for '{sub.title}'",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.65,
                created_at        = sub.feedback_at or sub.submitted_at,
            ))

        if sub.is_marked_helpful:
            phase9_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_marked_helpful",
                title             = f"Reaction received: {sub.reaction_type} 🎉",
                body              = f"{req_name} reacted '{sub.reaction_type}' to your solution",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.45,
                created_at        = sub.reaction_at or sub.feedback_at,
            ))

    # "Help requested" notifications from connections sharing assignments
    for assignment in random.sample(connection_shared[:30], min(12, len(connection_shared))):
        owner = User.query.get(assignment.user_id)
        if owner:
            phase9_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_help_requested",
                title             = "Connection needs help!",
                body              = f"{owner.name} shared '{assignment.title}' and needs help with {assignment.subject}",
                related_id        = assignment.id,
                is_read           = random.random() < 0.35,
                created_at        = assignment.created_at + datetime.timedelta(minutes=random.randint(2, 20)),
            ))

    # Completed homework notifications
    for sub in db_subs_as_requester[:8]:
        if sub.status == "completed":
            phase9_items.append(make_notification(
                user_id           = primary.id,
                notification_type = "homework_completed",
                title             = "Assignment help completed!",
                body              = f"Your assignment '{sub.title}' has been fully resolved.",
                related_id        = sub.assignment_id,
                is_read           = random.random() < 0.80,
                created_at        = sub.reaction_at or sub.feedback_at,
            ))

    ok9, fail9 = batch_commit(phase9_items, "Phase9-Notifications")
    print(f"   ✅ {ok9} notifications created, {fail9} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 10 – Activity feed entries  (GET /activity/feed)
    #            Must be within last 24h to appear in the live feed
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📡 Phase 10: Generating activity feed entries …")

    phase10_items = []

    # User 1's own recent activity
    for assignment in user1_all[-8:]:
        phase10_items.append(make_activity(
            user_id       = primary.id,
            activity_type = "assignment_created",
            data          = {
                "assignment_id": assignment.id,
                "title":         assignment.title,
                "subject":       assignment.subject,
                "difficulty":    assignment.difficulty,
            },
            created_at = now() - datetime.timedelta(hours=random.randint(0, 22)),
        ))

    for sub in db_subs_as_helper[-8:]:
        phase10_items.append(make_activity(
            user_id       = primary.id,
            activity_type = "homework_help_given",
            data          = {
                "submission_id": sub.id,
                "title":         sub.title,
                "subject":       sub.subject,
                "status":        sub.status,
            },
            created_at = now() - datetime.timedelta(hours=random.randint(0, 22)),
        ))

    for sub in db_subs_as_requester[-5:]:
        if sub.status == "completed":
            phase10_items.append(make_activity(
                user_id       = primary.id,
                activity_type = "homework_completed",
                data          = {"submission_id": sub.id, "title": sub.title},
                created_at    = now() - datetime.timedelta(hours=random.randint(0, 20)),
            ))

    # Connection activity visible in User 1's feed
    for conn_user in helpers_pool[:10]:
        activity_type = random.choice([
            "homework_shared", "homework_help_given", "assignment_created",
        ])
        phase10_items.append(make_activity(
            user_id       = conn_user.id,
            activity_type = activity_type,
            data          = {
                "subject":    random.choice(SUBJECTS),
                "difficulty": pick_difficulty(),
            },
            created_at = now() - datetime.timedelta(hours=random.randint(0, 23)),
        ))

    ok10, fail10 = batch_commit(phase10_items, "Phase10-ActivityFeed")
    print(f"   ✅ {ok10} activity entries created, {fail10} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 11 – Reputation history for User 1  (GET /homework/stats)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n⭐ Phase 11: Generating reputation history for User 1 …")

    phase11_items = []
    rep_cursor    = primary.reputation or 200

    rep_actions = [
        ("homework_help_completed",  10),
        ("homework_marked_helpful",  15),
        ("homework_lifesaver",       20),
        ("homework_first_response",   5),
        ("assignment_completed",      5),
        ("homework_mind_blown",       20),
        ("homework_perfect_rating",  15),
    ]

    # 60 reputation history entries spanning past 3 months
    for i in range(60):
        action, points = random.choice(rep_actions)
        created = rand_past(1, 90)
        related_sub = random.choice(db_subs_as_helper) if db_subs_as_helper else None

        phase11_items.append(make_rep_history(
            user_id      = primary.id,
            action       = action,
            points       = points,
            related_type = "submission",
            related_id   = related_sub.id if related_sub else None,
            created_at   = created,
            rep_before   = max(0, rep_cursor - points),
        ))
        rep_cursor += points

    ok11, fail11 = batch_commit(phase11_items, "Phase11-ReputationHistory")
    print(f"   ✅ {ok11} reputation history entries created, {fail11} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 12 – UserActivity rows for heatmap  (GET /homework/stats/charts)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n📊 Phase 12: Generating UserActivity heatmap data for User 1 …")

    phase12_items = []
    today = datetime.date.today()

    for day_offset in range(120):
        activity_date = today - datetime.timedelta(days=day_offset)

        # Skip some days for a realistic sparse heatmap
        if random.random() < 0.20:
            continue

        # Heavier activity in recent 30 days
        if day_offset < 30:
            helpful = random.randint(1, 5)
            posts   = random.randint(0, 3)
            comments= random.randint(1, 6)
            msgs    = random.randint(2, 10)
        else:
            helpful = random.randint(0, 3)
            posts   = random.randint(0, 2)
            comments= random.randint(0, 4)
            msgs    = random.randint(0, 6)

        # Avoid duplicate constraint (user_id + activity_date must be unique)
        existing = UserActivity.query.filter_by(
            user_id=primary.id, activity_date=activity_date
        ).first()
        if existing:
            continue

        phase12_items.append(make_user_activity(
            user_id       = primary.id,
            activity_date = activity_date,
            posts         = posts,
            comments      = comments,
            helpful       = helpful,
            messages      = msgs,
        ))

    ok12, fail12 = batch_commit(phase12_items, "Phase12-UserActivity")
    print(f"   ✅ {ok12} user activity rows created, {fail12} failed")

    # ════════════════════════════════════════════════════════════════════
    # PHASE 13 – WeeklyChampion records  (GET /homework/champions)
    # ════════════════════════════════════════════════════════════════════
    print(f"\n🏆 Phase 13: Generating WeeklyChampion records …")

    phase13_items = []
    champion_subjects = random.sample(SUBJECTS, 6)

    # Current week
    week_start = today - datetime.timedelta(days=today.weekday())
    week_end   = week_start + datetime.timedelta(days=6)

    # User 1 as overall champion this week
    phase13_items.append(WeeklyChampion(
        user_id                   = primary.id,
        subject                   = None,
        help_count                = random.randint(12, 30),
        week_start                = week_start,
        week_end                  = week_end,
        avg_response_time_minutes = str(random.randint(20, 90)),
        champion_type             = "overall",
        created_at                = now() - datetime.timedelta(hours=2),
    ))

    # User 1 as speed champion this week
    phase13_items.append(WeeklyChampion(
        user_id                   = primary.id,
        subject                   = None,
        help_count                = random.randint(8, 20),
        week_start                = week_start,
        week_end                  = week_end,
        avg_response_time_minutes = str(random.randint(10, 35)),
        champion_type             = "speed",
        created_at                = now() - datetime.timedelta(hours=2),
    ))

    # User 1 as subject champion for a few subjects
    for subj in champion_subjects[:3]:
        phase13_items.append(WeeklyChampion(
            user_id                   = primary.id,
            subject                   = subj,
            help_count                = random.randint(4, 12),
            week_start                = week_start,
            week_end                  = week_end,
            avg_response_time_minutes = str(random.randint(15, 60)),
            champion_type             = "subject",
            created_at                = now() - datetime.timedelta(hours=2),
        ))

    # Other connection users as champions
    for conn_user in helpers_pool[:5]:
        subj = random.choice(champion_subjects[3:])
        phase13_items.append(WeeklyChampion(
            user_id                   = conn_user.id,
            subject                   = subj,
            help_count                = random.randint(3, 10),
            week_start                = week_start,
            week_end                  = week_end,
            avg_response_time_minutes = str(random.randint(15, 120)),
            champion_type             = "subject",
            created_at                = now() - datetime.timedelta(hours=3),
        ))

    # Previous week records (history)
    prev_week_start = week_start - datetime.timedelta(weeks=1)
    prev_week_end   = week_end   - datetime.timedelta(weeks=1)
    phase13_items.append(WeeklyChampion(
        user_id                   = primary.id,
        subject                   = None,
        help_count                = random.randint(10, 25),
        week_start                = prev_week_start,
        week_end                  = prev_week_end,
        avg_response_time_minutes = str(random.randint(20, 80)),
        champion_type             = "overall",
        created_at                = now() - datetime.timedelta(days=7),
    ))

    ok13, fail13 = batch_commit(phase13_items, "Phase13-WeeklyChampions")
    print(f"   ✅ {ok13} champion records created, {fail13} failed")

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

    for stage in ["pending", "submitted", "reviewed", "completed"]:
        req_count = HomeworkSubmission.query.filter_by(
            requester_id=primary.id, status=stage).count()
        hlp_count = HomeworkSubmission.query.filter_by(
            helper_id=primary.id, status=stage).count()
        print(f"   [{stage:9s}] requester={req_count:3d}  helper={hlp_count:3d}")

    print(f"\n⭐ Reactions on User 1's help:")
    for reaction in REACTION_TYPES:
        cnt = HomeworkSubmission.query.filter_by(
            helper_id=primary.id, reaction_type=reaction).count()
        print(f"   {reaction:12s}: {cnt}")

    helpful_count = HomeworkSubmission.query.filter_by(
        helper_id=primary.id, is_marked_helpful=True).count()
    print(f"\n   Marked helpful (User 1 as helper): {helpful_count}")

    user1_subs = Assignment.query.filter_by(user_id=primary.id).all()
    subjects_seen = {}
    for a in user1_subs:
        subjects_seen[a.subject] = subjects_seen.get(a.subject, 0) + 1
    top5 = sorted(subjects_seen.items(), key=lambda x: x[1], reverse=True)[:5]
    print(f"\n📖 Top subjects (User 1's assignments):")
    for subj, cnt in top5:
        print(f"   {subj:<30}: {cnt}")

    notif_count    = Notification.query.filter_by(user_id=primary.id).count()
    activity_count = ActivityFeed.query.filter_by(user_id=primary.id).count()
    rep_count      = ReputationHistory.query.filter_by(user_id=primary.id).count()
    ua_count       = UserActivity.query.filter_by(user_id=primary.id).count()
    champ_count    = WeeklyChampion.query.filter_by(user_id=primary.id).count()

    print(f"\n🔔 Notifications for User 1   : {notif_count}")
    print(f"📡 Activity feed (User 1)     : {activity_count}")
    print(f"📈 Reputation history         : {rep_count}")
    print(f"🗓️  UserActivity rows          : {ua_count}")
    print(f"🏆 WeeklyChampion records     : {champ_count}")

    print(f"\n{'─'*65}")
    print(f"🎯 Endpoints with coverage:")
    endpoints = [
        ("GET  /assignments",                            u1_assignments > 0),
        ("POST /assignments",                            True),   # live, always ready
        ("PUT  /assignments/<id>",                       u1_assignments > 0),
        ("DEL  /assignments/<id>",                       u1_assignments > 0),
        ("POST /assignments/<id>/quick-actions",         u1_private > 0),
        ("GET  /homework/feed",                          HomeworkSubmission.query.count() > 0),
        ("POST /homework/<id>/offer-help",               u1_as_helper > 0),
        ("GET  /homework/my-help-requests",              u1_as_requester > 0),
        ("GET  /homework/helping",                       u1_as_helper > 0),
        ("GET  /homework/submission/<id>",               total_submissions > 0),
        ("POST /submission/<id>/submit-solution",
            HomeworkSubmission.query.filter_by(helper_id=primary.id, status="pending").count() > 0),
        ("POST /submission/<id>/give-feedback",
            HomeworkSubmission.query.filter_by(requester_id=primary.id, status="submitted").count() > 0),
        ("DEL  /submission/<id>/cancel",
            HomeworkSubmission.query.filter_by(requester_id=primary.id, status="pending").count() > 0),
        ("GET  /homework/stats",                         rep_count > 0),
        ("GET  /homework/stats/charts",                  ua_count > 0),
        ("GET  /homework/my-streak",                     u1_as_helper > 0),
        ("GET  /homework/champions",                     champ_count > 0),
        ("GET  /homework/<id>/helpers",                  u1_as_requester > 0),
        ("GET  /activity/feed",                          activity_count > 0),
    ]

    for ep, ok in endpoints:
        status_icon = "✅" if ok else "⚠️ "
        print(f"   {status_icon} {ep}")

    print("\n" + "=" * 65)
    print("✨ Homework seed v2 complete! Ready for endpoint testing.")
    print("=" * 65 + "\n")
    logger.info("Seed summary printed successfully.")


# ============================================================================
# ENTRY POINT
# ============================================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="Seed homework feature data for StudyHub (v2 - Expanded)."
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing homework data before seeding (no confirmation prompt).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be created without writing to the database.",
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
            logger.info("Homework seed script v2 completed successfully.")
            sys.exit(0)
        else:
            logger.error("Homework seed script v2 failed.")
            sys.exit(1)
