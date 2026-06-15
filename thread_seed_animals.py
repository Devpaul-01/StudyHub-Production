"""
Thread System Seed Script — Animal Edition
Creates realistic threads, members, join requests, messages,
reactions, replies, pinned messages, AI messages, soft-deleted messages,
message delivery/read statuses, and per-user read receipts.

Key guarantees:
  • Thread titles use animal names.
  • User ID=1 and User ID=2 are present in EVERY thread.
  • In every thread, at least one of user 1 / user 2 holds the role
    "creator" (i.e. is thread.creator_id) or "moderator".
    Specifically:
      - The thread creator is added with role="creator".
      - If user 1 is NOT the creator they are added as "moderator".
      - If user 2 is NOT the creator they are added as "moderator".
    This means both users always carry role "creator" or "moderator".
  • Each thread gets ~100 messages (90–110 range).
  • Both primary users send a significantly higher share of messages.

Run this AFTER user_seed.py and connection_seed.py.
"""

import random
import datetime
import logging
from typing import List, Optional, Tuple, Set
from sqlalchemy.exc import SQLAlchemyError
from extensions import db
from models import (
    User,
    Thread,
    ThreadMember,
    ThreadJoinRequest,
    ThreadMessage,
    ThreadMessageReaction,
    ThreadMessageReadReceipt,
)


# ============================================================================
# CONFIGURATION
# ============================================================================

class SeedConfig:
    """Centralized configuration for thread seeding"""

    # Thread counts
    NUM_THREADS_AS_CREATOR    = 10   # threads where user 1 is the creator
    NUM_THREADS_AS_MEMBER     = 8    # threads created by others; user 1 & 2 forced in
    NUM_EMPTY_THREADS         = 4    # threads with members but zero messages
    AVG_MEMBERS_PER_THREAD    = 8    # average members per thread (including creator)
    NUM_JOIN_REQUESTS         = 30   # pending join requests across all threads

    # Message counts — ~100 per thread
    MESSAGES_PER_THREAD_MIN   = 90
    MESSAGES_PER_THREAD_MAX   = 110

    # How often user 1 / user 2 send a message (vs a random member)
    # 0.50 means ~50 % of non-AI messages come from one of the two primary users
    PRIMARY_USER_MESSAGE_BIAS = 0.50

    # Reaction counts
    REACTIONS_PER_MESSAGE_CHANCE = 0.60   # 60% of messages get at least one reaction
    MAX_REACTIONS_PER_MESSAGE    = 6

    # Soft-delete rate
    DELETE_MESSAGE_CHANCE     = 0.06   # 6% of messages are soft-deleted

    # Pin rate
    PIN_MESSAGE_CHANCE        = 0.05   # 5% of messages are pinned

    # AI message rate
    AI_MESSAGE_CHANCE         = 0.07   # 7% of messages are from the Learnora bot

    # Reply (thread) rate
    REPLY_CHANCE              = 0.30   # 30% of messages are replies to earlier ones

    # Message status weights — sent / delivered / read
    MESSAGE_STATUS_WEIGHTS    = [0.10, 0.20, 0.70]

    SEED_RANDOM_STATE         = 99
    BATCH_SIZE                = 25

    # Date window
    MAX_DAYS_AGO  = 120
    MIN_DAYS_AGO  = 1

    # ── Phase 5 — Invite scenario counts ─────────────────────────────────────
    # Threads created WITHOUT user 1 as a member, so invite/request records
    # have a realistic non-member thread to point at.
    NUM_INVITE_THREADS   = 2   # threads where user 1 receives a status="invited"
    NUM_REQUEST_THREADS  = 2   # threads where user 1 sent a status="pending" request
    NUM_INBOUND_REQUESTS = 3   # pending requests from non-members on threads
                               # where user 1 is creator or moderator


config = SeedConfig()


# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("seed_threads.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


# ============================================================================
# REALISTIC DATA POOLS
# ============================================================================

DEPARTMENTS = [
    "Computer Science", "Mathematics", "Physics",
    "Chemistry", "Engineering", "Statistics",
    "Data Science", "Economics",
]

SUBJECTS = [
    "Calculus", "Linear Algebra", "Discrete Math",
    "Algorithms", "Data Structures", "Operating Systems",
    "Machine Learning", "Databases", "Networks",
    "Probability & Statistics", "Physics I", "Physics II",
    "Organic Chemistry", "Thermodynamics", "Software Engineering",
]

# ── Animal-themed thread titles ──────────────────────────────────────────────
THREAD_TITLES = [
    "The Owl's Algorithm Den 🦉",
    "Wolfpack Calculus Crew 🐺",
    "Elephant Memory — Data Structures 🐘",
    "Cheetah Speed Coding Circle 🐆",
    "Dolphin Deep Learning Pod 🐬",
    "Hawk-Eye Networks & Security 🦅",
    "Penguin OS & Systems Study 🐧",
    "Panther Linear Algebra Lab 🐾",
    "Fox Probability & Statistics Lounge 🦊",
    "Bison Thermodynamics Herd 🦬",
    "Octopus Distributed Systems Tank 🐙",
    "Raven Research Methods Flock 🪶",
    "Tiger Competitive Programming Den 🐯",
    "Salamander Organic Chemistry Burrow 🦎",
    "Falcon Software Engineering Squad 🦆",
    "Orca Bayesian Inference Pod 🐋",
    "Lynx Discrete Math Pride 🐱",
    "Manta Ray Web Dev & System Design 🐟",
    "Grizzly AI Ethics Workshop 🐻",
    "Hummingbird Data Science Studio 🐦",
    "Cobra Graph Theory Guild 🐍",
    "Bald Eagle Cloud & DevOps Nest 🦅",
]

THREAD_DESCRIPTIONS = [
    "Solving sorting, searching, and graph problems — with live code walkthroughs.",
    "Solving ODEs, root-finding, and numerical integration — with Python and MATLAB examples.",
    "Building intuition for trees, heaps, hash maps, and advanced data structures.",
    "Daily speed-coding challenges to sharpen problem-solving under time pressure.",
    "Building intuition for neural architectures, backprop, and modern training tricks.",
    "Packet analysis, protocol deep-dives, and CTF-style security challenges.",
    "Collaborative prep for OS finals — processes, scheduling, memory management.",
    "Drop practice problems here. We explain solutions step by step.",
    "Prior selection, MCMC sampling, and hierarchical models — worked examples every session.",
    "Work through textbook thermodynamics problems together with full solutions.",
    "Microservices, CAP theorem, container orchestration, and cloud-native patterns.",
    "Academic writing, literature reviews, citation management, and peer editing.",
    "LeetCode grinding, competitive contests, and time-complexity breakdowns.",
    "Reaction mechanisms, naming conventions, and spectroscopy breakdowns.",
    "Tracking milestones, assigning tasks, and reviewing each other's code.",
    "Bayesian reasoning, conjugate priors, and real-world inference problems.",
    "Daily challenge problems to sharpen proof-writing and logic skills.",
    "System design mock interviews and frontend/backend architecture reviews.",
    "Exploring the societal impact of AI, fairness, bias, and regulation.",
    "Data wrangling, EDA discussions, model evaluation, and viz critiques.",
    "Proof techniques, spanning trees, graph colouring, and combinatorial identities.",
    "CI/CD pipelines, Kubernetes, and cloud-native deployment strategies.",
]

TAGS_POOL = [
    ["algorithms", "dsa", "problem-solving"],
    ["numerical-methods", "simulation", "matlab"],
    ["data-structures", "trees", "heaps"],
    ["speed-coding", "challenges", "competitive"],
    ["deep-learning", "backprop", "neural-nets"],
    ["networking", "security", "protocols"],
    ["os", "processes", "threads"],
    ["linear-algebra", "matrices", "eigenvalues"],
    ["bayesian", "statistics", "inference"],
    ["thermodynamics", "heat-transfer"],
    ["cloud", "distributed-systems", "microservices"],
    ["research", "writing", "citations"],
    ["competitive-programming", "contests", "optimization"],
    ["organic-chem", "reactions", "spectroscopy"],
    ["capstone", "agile", "code-review"],
    ["bayesian", "mcmc", "inference"],
    ["discrete-math", "graph-theory", "proofs"],
    ["system-design", "web-dev", "rest-api"],
    ["ai-ethics", "fairness", "regulation"],
    ["data-science", "pandas", "visualization"],
    ["graph-theory", "combinatorics", "proofs"],
    ["cloud", "devops", "kubernetes"],
]

JOIN_REQUEST_MESSAGES = [
    "Hey! I'm really struggling with this topic and would love some peer support.",
    "I've been following this group's posts and the discussions look super helpful.",
    "My study partner recommended I join — hoping to contribute and learn.",
    "I have some good resources I'd like to share with the group if admitted.",
    "Looking for an active study community for the upcoming exam season.",
    "I've already solved a few of the posted practice problems. Would love to join!",
    "This thread covers exactly what I need help with this semester.",
    "I can help others with the theory parts if someone helps me with proofs.",
    "I've been self-studying and want to benchmark my progress with peers.",
    "Referred by a classmate. Looking forward to being a productive member!",
]

JOIN_REQUEST_STATUSES = ["pending", "pending", "pending", "accepted", "rejected"]

# Used by Phase 5 — Scenario A (someone invited user 1)
INVITE_MESSAGES = [
    "[INVITE] We think you'd be a great addition to our group — hope you'll join us!",
    "[INVITE] A classmate recommended you. Your background here would be really valuable.",
    "[INVITE] We spotted your profile and think you'd fit right in. Come study with us!",
    "[INVITE] Heard great things about you — we'd love to have you in our study circle.",
    "[INVITE] Our group is working on exactly what you're strong in. We could use you!",
]

MESSAGE_TEMPLATES = [
    "Has anyone finished problem set {num}? I'm stuck on question {q}.",
    "Sharing my notes from today's lecture on {topic} — hope it helps!",
    "Quick reminder: our next session is scheduled for {day}. Don't miss it!",
    "Can someone explain the intuition behind {concept}? The textbook is confusing.",
    "I found a great YouTube video on {topic}. Dropping the link here.",
    "Practice problem: {problem_snippet}. Take a shot and I'll post the solution tomorrow.",
    "Just finished the mock exam — that {topic} section was brutal.",
    "Does anyone have the professor's slides from week {num}?",
    "Pro tip: when solving {concept} problems, always check boundary conditions first.",
    "I compared two approaches for {topic} and wrote a short breakdown. See below.",
    "Reminder to review {concept} before Friday — it's almost always on the exam.",
    "Anyone up for a voice call study session tonight? Drop your availability.",
    "I got stuck on the proof for {concept}. Can someone walk me through it?",
    "Posted a worked solution to last week's challenge in the pinned messages.",
    "Heads up — the problem set deadline has been extended to next {day}.",
    "My biggest takeaway from studying {topic}: don't memorise formulas, derive them.",
    "Can we compile a shared cheat sheet for {concept}? I'll start the document.",
    "Important: the exam covers {topic} from chapters {num} through {q}.",
    "I ran the code and it works now — the bug was a missing base case in recursion.",
    "Here's my attempt at the proof. Please poke holes in it so I can improve.",
    "This week's challenge problem is posted! 48 hours to submit your solution.",
    "Summary of today's group call: we covered {topic} and assigned follow-up tasks.",
    "I'm confused about the difference between {concept} and its variant. Anyone?",
    "Resource drop: this paper on {topic} cleared up so many misconceptions for me.",
    "Question: does the time complexity change if we use a hash map instead of a list?",
    "For those using Python — the `functools.lru_cache` decorator is a lifesaver here.",
    "Gentle reminder: reply to the thread, not the main channel, for specific sub-topics.",
    "I'll compile everyone's solutions and post a comparison by end of week.",
    "We're now {num} members strong! Let's keep the quality discussions going.",
    "New pinned resource: a curated problem bank for the next three weeks.",
    "Just want to say — the quality of discussion here has been amazing lately 🙌",
    "Anyone else finding the {topic} assignment harder than expected?",
    "I summarized the key points from the last three sessions. Sharing below 👇",
    "Dropped a worked example in the files tab — check it out before the exam!",
    "Does anyone know if the {topic} final is cumulative this year?",
    "Hot take: {concept} is actually easier once you stop memorising and start deriving.",
    "I recorded our last session — who wants the link?",
    "Tagging everyone: please vote in the poll for our next meetup time.",
    "Finally cracked question {q} from problem set {num}. The key insight was {concept}.",
    "Thanks everyone for the help last week — I nailed that section on the midterm!",
    "Going through past exams tonight — anyone want to pair up on video?",
    "The professor dropped hints about {concept} being on the next quiz. Stay ready!",
    "I made a quick Anki deck for {topic}. DM me if you want a copy.",
    "Office hours tomorrow at 3 PM — would recommend going if you're lost on {concept}.",
    "Struggled with {topic} for weeks, but this one video finally made it click for me.",
    "Who else is still waiting for their {num} assignment grade? The suspense is real.",
    "Reminder: the study group meets every {day}. Bring your toughest questions!",
    "Posted a diagram explaining {concept} step by step. Check the attachments!",
    "Just realised I've been solving {concept} problems wrong for weeks. Key mistake below:",
    "Can someone sanity-check my derivation? I get a different answer each time.",
    "Week {num} recap: we covered {topic}, {concept}, and some edge cases. Summary pinned.",
]

TOPICS       = SUBJECTS
CONCEPTS     = [
    "Big-O notation", "dynamic programming", "eigenvalues", "Bayes' theorem",
    "recursion", "integration by parts", "NP-completeness", "normal distribution",
    "graph traversal", "partial derivatives", "reaction mechanisms", "context switching",
    "JOIN operations", "gradient descent", "Fourier transforms",
    "merge sort", "Dijkstra's algorithm", "Lagrange multipliers", "heap sort",
    "binary search trees",
]
DAYS         = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
PROBLEM_SNIP = [
    "Prove that the sum of the first n odd numbers equals n²",
    "Find the shortest path in a weighted DAG with negative edges",
    "Differentiate f(x) = e^(sin(x²)) with respect to x",
    "Normalise this dataset and justify your choice of scaler",
    "Design a schema for a multi-tenant SaaS application",
    "Implement LRU cache with O(1) get and put operations",
    "Show that every planar graph is 4-colourable",
]

ATTACHMENT_DATA = [
    {"name": "week4_notes.pdf",          "type": "document", "size": 204800},
    {"name": "practice_problems.pdf",    "type": "document", "size": 512000},
    {"name": "diagram_eigenvalues.png",  "type": "image",    "size": 98304},
    {"name": "lecture_slides.pdf",       "type": "document", "size": 1048576},
    {"name": "solution_walkthrough.mp4", "type": "video",    "size": 20971520},
    {"name": "cheatsheet_final.pdf",     "type": "document", "size": 153600},
    {"name": "lab_results.png",          "type": "image",    "size": 307200},
    {"name": "data_cleaned.csv",         "type": "document", "size": 81920},
]

ATTACHMENT_BASE_URL = "https://storage.studyhub.app/thread-attachments"

EMOJI_POOL = ["👍", "❤️", "🔥", "😂", "🙌", "💡", "👀", "🎯", "✅", "😮"]

AI_MESSAGE_TEMPLATES = [
    "Great question! {concept} refers to the idea that {explanation}. Here's a step-by-step breakdown...",
    "To solve this type of problem efficiently, consider using {concept}. The key insight is {explanation}.",
    "Here's a concise summary of {topic}: {explanation}. Let me know if you'd like more depth on any part.",
    "Common mistake alert: many students confuse {concept} with its variant. The difference is {explanation}.",
    "Hint (without spoiling it): think about what happens at the boundary. {explanation}.",
]

AI_EXPLANATIONS = [
    "the algorithm reduces the problem size by half at each step, giving O(log n) complexity",
    "you need to account for all edge cases before applying the recurrence relation",
    "the determinant of the matrix tells you whether the transformation preserves orientation",
    "Bayes' theorem lets you update your belief given new evidence — P(A|B) = P(B|A)P(A)/P(B)",
    "integration by parts mirrors the product rule for derivatives — choose u and dv carefully",
]


# ============================================================================
# HELPER UTILITIES
# ============================================================================

def random_past_datetime(max_days: int = config.MAX_DAYS_AGO,
                          min_days: int = config.MIN_DAYS_AGO) -> datetime.datetime:
    days    = random.randint(min_days, max_days)
    hours   = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        days=days, hours=hours, minutes=minutes
    )


def build_message_text() -> str:
    template = random.choice(MESSAGE_TEMPLATES)
    return template.format(
        num=random.randint(1, 10),
        q=random.randint(1, 8),
        topic=random.choice(TOPICS),
        concept=random.choice(CONCEPTS),
        day=random.choice(DAYS),
        problem_snippet=random.choice(PROBLEM_SNIP),
    )


def build_ai_message_text() -> str:
    template = random.choice(AI_MESSAGE_TEMPLATES)
    return template.format(
        concept=random.choice(CONCEPTS),
        topic=random.choice(TOPICS),
        explanation=random.choice(AI_EXPLANATIONS),
    )


def pick_message_status(sent_at: datetime.datetime) -> str:
    age_minutes = (datetime.datetime.now(datetime.timezone.utc) - sent_at).total_seconds() / 60
    if age_minutes < 5:
        weights = [0.50, 0.35, 0.15]
    elif age_minutes < 60:
        weights = [0.15, 0.40, 0.45]
    else:
        weights = config.MESSAGE_STATUS_WEIGHTS
    return random.choices(["sent", "delivered", "read"], weights=weights)[0]


def maybe_attachment() -> dict | None:
    if random.random() < 0.30:
        att       = random.choice(ATTACHMENT_DATA)
        fake_path = f"{ATTACHMENT_BASE_URL}/{random.randint(10000, 99999)}/{att['name']}"
        return {"url": fake_path, "name": att["name"], "type": att["type"], "size": att["size"]}
    return None


# ============================================================================
# PREREQUISITE CHECKS
# ============================================================================

def verify_primary_users() -> Tuple[Optional[User], Optional[User]]:
    user1 = User.query.filter_by(id=1).first()
    user2 = User.query.filter_by(id=2).first()
    if not user1:
        logger.error("User with ID=1 not found")
        print("❌  Error: User with ID=1 not found. Run user_seed.py first.")
    if not user2:
        logger.warning("User with ID=2 not found — only user 1 will be guaranteed present.")
    return user1, user2


def load_other_users(primary_ids: Set[int]) -> List[User]:
    users = User.query.filter(
        User.id.notin_(primary_ids),
        User.status == "approved"
    ).all()
    if len(users) < 3:
        logger.warning(f"Only {len(users)} other approved users found — seeding may be sparse.")
        print(f"⚠️  Only {len(users)} other approved users. Consider running user_seed.py first.")
    return users


# ============================================================================
# CLEAR EXISTING DATA  (auto-clears, no prompt)
# ============================================================================

def clear_existing_thread_data() -> bool:
    try:
        print("🗑️   Clearing all existing thread-related data...")

        counts = {}
        for model in (
            ThreadMessageReadReceipt,
            ThreadMessageReaction,
            ThreadMessage,
            ThreadJoinRequest,
            ThreadMember,
            Thread,
        ):
            result = model.query.delete(synchronize_session=False)
            counts[model.__tablename__] = result

        db.session.commit()

        for table, n in counts.items():
            print(f"   🗑️  {table}: {n} rows deleted")

        print("✅  Cleared existing thread data.")
        logger.info(f"Thread data cleared: {counts}")
        return True
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Failed to clear thread data: {e}")
        print(f"❌  Failed to clear data: {e}")
        return False


# ============================================================================
# THREAD CREATION
# ============================================================================

def create_thread(creator: User, index: int, created_at: datetime.datetime) -> Thread:
    idx    = index % len(THREAD_TITLES)
    thread = Thread(
        creator_id=creator.id,
        title=THREAD_TITLES[idx],
        description=THREAD_DESCRIPTIONS[idx % len(THREAD_DESCRIPTIONS)],
        department=random.choice(DEPARTMENTS),
        tags=TAGS_POOL[idx % len(TAGS_POOL)],
        is_open=random.choices([True, False], weights=[0.80, 0.20])[0],
        max_members=random.choice([10, 15, 20, 25]),
        requires_approval=random.choices([True, False], weights=[0.60, 0.40])[0],
        member_count=1,
        message_count=0,
        created_at=created_at,
        last_activity=created_at,
    )
    return thread


# ============================================================================
# MEMBER CREATION
# ============================================================================

def add_members_to_thread(
    thread: Thread,
    creator: User,
    candidate_users: List[User],
    forced_members: List[User],   # always user 1 & user 2 (if not the creator)
) -> List[User]:
    """
    Rules:
      • Creator → ThreadMember with role="creator"  (creator_id is already set on thread)
      • If user 1 is NOT the creator → role="moderator"
      • If user 2 is NOT the creator → role="moderator"
      This guarantees both primary users are in every thread as creator OR moderator.
      • Random additional members → role="member"
    Returns the full list of member User objects.
    """
    added_ids: Set[int] = set()

    # ── Creator — always creator ────────────────────────────────────────────
    db.session.add(ThreadMember(
        thread_id=thread.id,
        student_id=creator.id,
        role="creator",
        joined_at=thread.created_at,
        last_read_at=datetime.datetime.now(datetime.timezone.utc),
        messages_sent=0,
    ))
    added_ids.add(creator.id)
    all_members = [creator]

    # ── Forced members (user 1 & user 2) — always moderator if not creator ─
    for user in forced_members:
        if user.id in added_ids:
            continue  # already added as creator
        offset_hours = random.randint(1, 24)
        # Both primary users get "moderator" — satisfies the requirement that
        # every thread sees user 1 and user 2 as creator or moderator.
        db.session.add(ThreadMember(
            thread_id=thread.id,
            student_id=user.id,
            role="moderator",
            joined_at=thread.created_at + datetime.timedelta(hours=offset_hours),
            last_read_at=datetime.datetime.now(datetime.timezone.utc),
            messages_sent=0,
        ))
        added_ids.add(user.id)
        all_members.append(user)

    # ── Random additional members ───────────────────────────────────────────
    remaining = [u for u in candidate_users if u.id not in added_ids]
    num_extra  = min(
        random.randint(2, config.AVG_MEMBERS_PER_THREAD - 1),
        len(remaining),
    )
    for user in random.sample(remaining, num_extra):
        offset_hours = random.randint(1, 72)
        db.session.add(ThreadMember(
            thread_id=thread.id,
            student_id=user.id,
            role="member",
            joined_at=thread.created_at + datetime.timedelta(hours=offset_hours),
            last_read_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
                hours=random.randint(0, 48)
            ),
            messages_sent=0,
        ))
        added_ids.add(user.id)
        all_members.append(user)

    thread.member_count = len(all_members)
    logger.debug(f"Thread {thread.id} — {thread.member_count} members added.")
    return all_members


# ============================================================================
# JOIN REQUESTS
# ============================================================================

def seed_join_requests(
    threads: List[Thread],
    member_map: dict,
    all_users: List[User],
    count: int,
) -> int:
    created    = 0
    used_pairs: Set[Tuple[int, int]] = set()

    for _ in range(count * 3):
        if created >= count:
            break

        thread      = random.choice(threads)
        member_ids  = {u.id for u in member_map.get(thread.id, [])}
        non_members = [u for u in all_users if u.id not in member_ids]

        if not non_members:
            continue

        requester = random.choice(non_members)
        pair      = (thread.id, requester.id)
        if pair in used_pairs:
            continue
        used_pairs.add(pair)

        status         = random.choice(JOIN_REQUEST_STATUSES)
        requested_at   = random_past_datetime(max_days=60)
        reviewed_at    = None
        reviewed_by_id = None

        if status in ("accepted", "rejected"):
            reviewer       = random.choice(member_map.get(thread.id, [thread]))
            reviewed_at    = requested_at + datetime.timedelta(hours=random.randint(1, 48))
            reviewed_by_id = reviewer.id if hasattr(reviewer, "id") else None

        db.session.add(ThreadJoinRequest(
            thread_id=thread.id,
            requester_id=requester.id,
            message=random.choice(JOIN_REQUEST_MESSAGES) if random.random() < 0.75 else None,
            status=status,
            requested_at=requested_at,
            reviewed_at=reviewed_at,
            reviewed_by=reviewed_by_id,
        ))
        created += 1

    return created


# ============================================================================
# MESSAGE + REACTION CREATION
# ============================================================================

def seed_messages_for_thread(
    thread: Thread,
    members: List[User],
    learnora_bot_id: int,
    primary_users: List[User],   # user 1 & user 2 — get extra message weight
) -> int:
    num_messages = random.randint(
        config.MESSAGES_PER_THREAD_MIN,
        config.MESSAGES_PER_THREAD_MAX,
    )

    sent_messages: List[ThreadMessage]   = []
    reaction_pairs: Set[Tuple[int, int]] = set()
    member_send_count: dict              = {m.id: 0 for m in members}

    # Build a weighted sender pool: primary users appear 4× more often
    regular_members = [m for m in members if m.id not in {u.id for u in primary_users}]
    weighted_pool   = primary_users * 4 + regular_members
    if not weighted_pool:
        weighted_pool = members

    for i in range(num_messages):
        is_ai      = random.random() < config.AI_MESSAGE_CHANCE
        is_deleted = random.random() < config.DELETE_MESSAGE_CHANCE
        is_pinned  = (not is_deleted) and (random.random() < config.PIN_MESSAGE_CHANCE)
        is_reply   = (len(sent_messages) >= 3) and (random.random() < config.REPLY_CHANCE)
        is_edited  = (not is_deleted) and (random.random() < 0.10)

        # Sender selection
        if is_ai:
            sender_id = learnora_bot_id
        else:
            if random.random() < config.PRIMARY_USER_MESSAGE_BIAS and primary_users:
                sender = random.choice(primary_users)
            else:
                sender = random.choice(weighted_pool)
            sender_id = sender.id
            member_send_count[sender_id] = member_send_count.get(sender_id, 0) + 1

        # Timestamp — messages flow forward in time
        if sent_messages:
            last_sent   = sent_messages[-1].sent_at
            gap_minutes = random.randint(2, 120)
            sent_at     = last_sent + datetime.timedelta(minutes=gap_minutes)
        else:
            sent_at = thread.created_at + datetime.timedelta(minutes=random.randint(5, 60))

        text = build_ai_message_text() if is_ai else build_message_text()
        att  = None if is_deleted else maybe_attachment()

        reply_to_id = None
        if is_reply:
            eligible = [m for m in sent_messages if not m.is_deleted]
            if eligible:
                reply_to_id = random.choice(eligible[-20:]).id

        pinned_by_id = None
        if is_pinned and members:
            admins       = [m for m in members if m.id == thread.creator_id]
            pinned_by_id = admins[0].id if admins else members[0].id

        edited_at = None
        if is_edited:
            edited_at = sent_at + datetime.timedelta(minutes=random.randint(1, 30))

        status = "sent" if is_deleted else pick_message_status(sent_at)

        msg = ThreadMessage(
            thread_id=thread.id,
            sender_id=sender_id,
            text_content=text if not is_deleted else "[This message was deleted]",
            attachment_url=att["url"]   if att else None,
            attachment_name=att["name"] if att else None,
            attachment_type=att["type"] if att else None,
            attachment_size=att["size"] if att else None,
            reply_to_id=reply_to_id,
            is_pinned=is_pinned,
            pinned_by_id=pinned_by_id,
            is_ai_response=is_ai,
            is_edited=is_edited,
            is_deleted=is_deleted,
            status=status,
            sent_at=sent_at,
            edited_at=edited_at,
        )
        db.session.add(msg)
        db.session.flush()

        sent_messages.append(msg)

        # ---- Read receipts ----
        if not is_deleted and status != "sent":
            non_sender_members = [m for m in members if m.id != sender_id]
            if status == "read":
                receipt_targets = non_sender_members
            else:
                k = max(1, len(non_sender_members) // 2)
                receipt_targets = random.sample(non_sender_members, min(k, len(non_sender_members)))

            for reader in receipt_targets:
                db.session.add(ThreadMessageReadReceipt(
                    message_id=msg.id,
                    user_id=reader.id,
                    read_at=sent_at + datetime.timedelta(minutes=random.randint(1, 120)),
                ))

        # ---- Reactions ----
        if not is_deleted and random.random() < config.REACTIONS_PER_MESSAGE_CHANCE:
            num_reacts = random.randint(1, min(config.MAX_REACTIONS_PER_MESSAGE, len(members)))
            for reactor in random.sample(members, num_reacts):
                pair = (msg.id, reactor.id)
                if pair in reaction_pairs:
                    continue
                reaction_pairs.add(pair)
                db.session.add(ThreadMessageReaction(
                    message_id=msg.id,
                    user_id=reactor.id,
                    emoji=random.choice(EMOJI_POOL),
                    reacted_at=sent_at + datetime.timedelta(minutes=random.randint(1, 60)),
                ))

    # Update thread metadata
    if sent_messages:
        thread.message_count = len([m for m in sent_messages if not m.is_deleted])
        thread.last_activity = sent_messages[-1].sent_at

    # Update per-member messages_sent count
    for member in members:
        count = member_send_count.get(member.id, 0)
        if count > 0:
            ThreadMember.query.filter_by(
                thread_id=thread.id,
                student_id=member.id,
            ).update({"messages_sent": count})

    logger.debug(f"Thread {thread.id} — {len(sent_messages)} messages seeded.")
    return len(sent_messages)


# ============================================================================
# PHASE 5 — INVITE SCENARIOS
# ============================================================================

def _create_invite_thread(
    creator: User,
    title_index: int,
    other_users: List[User],
    learnora_bot_id: int,
) -> Tuple[Thread, List[User]]:
    """
    Create a thread that deliberately excludes User 1.
    Seeds members and messages so the thread looks active.
    Used for Scenarios A (invited) and B (pending request) so that
    those join-request records point at realistic, populated threads.

    Returns (thread, members).
    """
    created_at = random_past_datetime(max_days=30, min_days=3)
    idx        = title_index % len(THREAD_TITLES)
    thread     = Thread(
        creator_id=creator.id,
        title=THREAD_TITLES[idx],
        description=THREAD_DESCRIPTIONS[idx % len(THREAD_DESCRIPTIONS)],
        department=random.choice(DEPARTMENTS),
        tags=TAGS_POOL[idx % len(TAGS_POOL)],
        is_open=True,
        max_members=random.choice([10, 15, 20]),
        requires_approval=True,
        member_count=1,
        message_count=0,
        created_at=created_at,
        last_activity=created_at,
    )
    db.session.add(thread)
    db.session.flush()

    # Creator member
    db.session.add(ThreadMember(
        thread_id=thread.id,
        student_id=creator.id,
        role="creator",
        joined_at=created_at,
        last_read_at=datetime.datetime.now(datetime.timezone.utc),
        messages_sent=0,
    ))
    members: List[User]   = [creator]
    added_ids: Set[int]   = {creator.id}

    # Add 3–5 random other users — User 1 must NOT be in this pool
    candidates = [u for u in other_users if u.id not in added_ids]
    for u in random.sample(candidates, min(random.randint(3, 5), len(candidates))):
        db.session.add(ThreadMember(
            thread_id=thread.id,
            student_id=u.id,
            role="member",
            joined_at=created_at + datetime.timedelta(hours=random.randint(1, 48)),
            last_read_at=datetime.datetime.now(datetime.timezone.utc),
            messages_sent=0,
        ))
        members.append(u)
        added_ids.add(u.id)

    thread.member_count = len(members)

    # Seed messages. Pass only actual thread members as primary_users so
    # no message is accidentally attributed to User 1 (who is not a member).
    seed_messages_for_thread(
        thread=thread,
        members=members,
        learnora_bot_id=learnora_bot_id,
        primary_users=[creator],          # creator drives message weight; no user 1
    )

    logger.debug(
        f"Invite thread {thread.id} '{thread.title}' — "
        f"{len(members)} members, creator={creator.id}"
    )
    return thread, members


def seed_invite_scenarios(
    user1: User,
    other_users: List[User],
    all_threads: List[Thread],
    learnora_bot_id: int,
) -> dict:
    """
    Seeds three invite/request scenarios for User 1 so every UI form
    has realistic data:

    Scenario A — "Someone invited me (I'm not in the thread)"
        • Creates config.NUM_INVITE_THREADS new threads WITHOUT user 1 as member.
        • Adds ThreadJoinRequest(status='invited', requester_id=user1) for each.
        • The invite comes from each thread's creator.

    Scenario B — "I requested to join a thread (still pending)"
        • Creates config.NUM_REQUEST_THREADS new threads WITHOUT user 1 as member.
        • Adds ThreadJoinRequest(status='pending', requester_id=user1) for each.

    Scenario C — "Pending request on a thread I own or moderate"
        • Finds existing threads where user 1's role is 'creator' or 'moderator'.
        • Adds config.NUM_INBOUND_REQUESTS ThreadJoinRequest(status='pending')
          from non-member users, so user 1 can approve/reject them.
    """
    counts = {
        "invite_threads":    0,
        "invites_received":  0,
        "request_threads":   0,
        "requests_sent":     0,
        "requests_received": 0,
    }

    if len(other_users) < 3:
        logger.warning("Too few other users to seed invite scenarios — skipping Phase 5.")
        return counts

    # Title offset — continue numbering after Phases 1-3
    title_offset = (
        config.NUM_THREADS_AS_CREATOR +
        config.NUM_THREADS_AS_MEMBER  +
        config.NUM_EMPTY_THREADS
    )

    # ── Scenario A: "Someone invited me" ─────────────────────────────────────
    print(f"   📬  Scenario A — seeding {config.NUM_INVITE_THREADS} invite(s) for User 1...")
    for i in range(config.NUM_INVITE_THREADS):
        creator = random.choice(other_users)
        non_creator_others = [u for u in other_users if u.id != creator.id]

        thread, _ = _create_invite_thread(
            creator=creator,
            title_index=title_offset + i,
            other_users=non_creator_others,
            learnora_bot_id=learnora_bot_id,
        )
        all_threads.append(thread)
        counts["invite_threads"] += 1

        invited_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
            hours=random.randint(1, 72)
        )
        db.session.add(ThreadJoinRequest(
            thread_id    = thread.id,
            requester_id = user1.id,
            message      = random.choice(INVITE_MESSAGES),
            status       = "invited",
            requested_at = invited_at,
            reviewed_at  = invited_at,       # invite was sent (reviewed) at this time
            reviewed_by  = creator.id,
        ))
        counts["invites_received"] += 1
        logger.debug(f"  A: user1 invited to thread {thread.id} ('{thread.title}') by user {creator.id}")

    # ── Scenario B: "I requested to join" ────────────────────────────────────
    print(f"   📤  Scenario B — seeding {config.NUM_REQUEST_THREADS} pending request(s) from User 1...")
    for i in range(config.NUM_REQUEST_THREADS):
        creator = random.choice(other_users)
        non_creator_others = [u for u in other_users if u.id != creator.id]

        thread, _ = _create_invite_thread(
            creator=creator,
            title_index=title_offset + config.NUM_INVITE_THREADS + i,
            other_users=non_creator_others,
            learnora_bot_id=learnora_bot_id,
        )
        all_threads.append(thread)
        counts["request_threads"] += 1

        requested_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
            hours=random.randint(1, 96)
        )
        db.session.add(ThreadJoinRequest(
            thread_id    = thread.id,
            requester_id = user1.id,
            message      = random.choice(JOIN_REQUEST_MESSAGES),
            status       = "pending",
            requested_at = requested_at,
        ))
        counts["requests_sent"] += 1
        logger.debug(f"  B: user1 pending request on thread {thread.id} ('{thread.title}')")

    # ── Scenario C: "Inbound requests on threads I own/moderate" ─────────────
    print(f"   📥  Scenario C — seeding {config.NUM_INBOUND_REQUESTS} inbound request(s) for User 1...")

    # Threads where user 1 is creator OR moderator
    user1_elevated = ThreadMember.query.filter(
        ThreadMember.student_id == user1.id,
        ThreadMember.role.in_(["creator", "moderator"]),
    ).all()
    eligible_thread_ids = [m.thread_id for m in user1_elevated]

    if not eligible_thread_ids:
        logger.warning("No creator/moderator threads found for user 1 — Scenario C skipped.")
    else:
        selected_thread_ids = random.sample(
            eligible_thread_ids,
            min(config.NUM_INBOUND_REQUESTS, len(eligible_thread_ids)),
        )
        used_pairs: Set[Tuple[int, int]] = set()

        for thread_id in selected_thread_ids:
            existing_member_ids = {
                m.student_id
                for m in ThreadMember.query.filter_by(thread_id=thread_id).all()
            }
            candidates = [u for u in other_users if u.id not in existing_member_ids]
            if not candidates:
                logger.debug(f"  C: thread {thread_id} has no eligible non-members — skipping.")
                continue

            # Pick one non-member who hasn't already been paired with this thread
            for requester in random.sample(candidates, min(len(candidates), 10)):
                pair = (thread_id, requester.id)
                if pair in used_pairs:
                    continue
                used_pairs.add(pair)

                requested_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
                    hours=random.randint(1, 48)
                )
                db.session.add(ThreadJoinRequest(
                    thread_id    = thread_id,
                    requester_id = requester.id,
                    message      = random.choice(JOIN_REQUEST_MESSAGES),
                    status       = "pending",
                    requested_at = requested_at,
                ))
                counts["requests_received"] += 1
                logger.debug(
                    f"  C: user {requester.id} pending request on thread {thread_id} "
                    f"(user 1 is creator/mod)"
                )
                break  # one guaranteed inbound request per thread

    db.session.commit()
    return counts


# ============================================================================
# MAIN SEED FUNCTION
# ============================================================================

def seed_threads() -> bool:
    print("🌱  Starting thread seed script (Animal Edition)...")
    logger.info("Thread seed starting.")

    random.seed(config.SEED_RANDOM_STATE)

    # ---- Prerequisites ----
    user1, user2 = verify_primary_users()
    if not user1:
        return False

    primary_users  = [u for u in [user1, user2] if u is not None]
    primary_ids    = {u.id for u in primary_users}
    other_users    = load_other_users(primary_ids)
    all_users      = primary_users + other_users

    print(f"\n👤  Primary users confirmed:")
    for u in primary_users:
        print(f"     • ID {u.id} → username: {u.username}  |  name: {u.name}")

    learnora_bot_id = user1.id   # swap to a real bot ID if available

    if not clear_existing_thread_data():
        return False

    threads_created  = 0
    messages_created = 0
    member_map: dict = {}
    all_threads: List[Thread] = []

    try:
        # ================================================================
        # PHASE 1 — Threads where user 1 is the creator
        # ================================================================
        print(f"\n🧵  Phase 1: Creating {config.NUM_THREADS_AS_CREATOR} threads for User 1 as creator...")

        for i in range(config.NUM_THREADS_AS_CREATOR):
            created_at = random_past_datetime()
            thread     = create_thread(user1, i, created_at)
            db.session.add(thread)
            db.session.flush()

            # user1 is creator → user2 (and only user2) is a forced moderator
            candidates = list(other_users)
            forced     = [u for u in primary_users if u.id != user1.id]   # user2
            members    = add_members_to_thread(thread, user1, candidates, forced)

            member_map[thread.id] = members
            all_threads.append(thread)
            threads_created += 1

            msg_count = seed_messages_for_thread(thread, members, learnora_bot_id, primary_users)
            messages_created += msg_count

            if threads_created % 2 == 0:
                db.session.commit()
                print(f"   ✓ {threads_created} threads committed...")

        # ================================================================
        # PHASE 2 — Threads created by others; user 1 & 2 forced in as moderators
        # ================================================================
        print(f"\n🧵  Phase 2: Creating {config.NUM_THREADS_AS_MEMBER} threads by other users...")

        if len(other_users) >= 1:
            for i in range(config.NUM_THREADS_AS_MEMBER):
                creator    = random.choice(other_users)
                created_at = random_past_datetime()
                thread     = create_thread(creator, config.NUM_THREADS_AS_CREATOR + i, created_at)
                db.session.add(thread)
                db.session.flush()

                candidates = [u for u in other_users if u.id != creator.id]
                # Both user1 and user2 forced in — they will receive "moderator" role
                # because neither is the creator of this thread.
                forced     = list(primary_users)
                members    = add_members_to_thread(thread, creator, candidates, forced)

                member_map[thread.id] = members
                all_threads.append(thread)
                threads_created += 1

                msg_count = seed_messages_for_thread(thread, members, learnora_bot_id, primary_users)
                messages_created += msg_count

                if threads_created % 2 == 0:
                    db.session.commit()
                    print(f"   ✓ {threads_created} threads committed...")

        # ================================================================
        # PHASE 3 — Empty threads (members only, no messages)
        # ================================================================
        print(f"\n🧵  Phase 3: Creating {config.NUM_EMPTY_THREADS} empty threads (no messages)...")

        title_offset = config.NUM_THREADS_AS_CREATOR + config.NUM_THREADS_AS_MEMBER
        for i in range(config.NUM_EMPTY_THREADS):
            # Alternate the creator between user1 and a random other user
            creator    = user1 if i % 2 == 0 else random.choice(other_users or [user1])
            created_at = random_past_datetime()
            thread     = create_thread(creator, title_offset + i, created_at)
            db.session.add(thread)
            db.session.flush()

            candidates = [u for u in other_users if u.id != creator.id]
            forced     = [u for u in primary_users if u.id != creator.id]
            members    = add_members_to_thread(thread, creator, candidates, forced)

            member_map[thread.id] = members
            all_threads.append(thread)
            threads_created += 1

            # Intentionally skip seed_messages_for_thread — thread stays empty
            logger.debug(f"Empty thread {thread.id} created: '{thread.title}'")

        db.session.commit()
        print(f"   ✓ {config.NUM_EMPTY_THREADS} empty threads committed.")

        # ================================================================
        # PHASE 4 — Join requests
        # ================================================================
        print(f"\n📥  Phase 4: Creating {config.NUM_JOIN_REQUESTS} join requests...")

        join_reqs_created = seed_join_requests(
            all_threads, member_map, all_users, config.NUM_JOIN_REQUESTS
        )

        # ================================================================
        # PHASE 5 — Invite scenarios for User 1
        # ================================================================
        # Guarantees all three invite-related UI forms have realistic data:
        #   A) "Someone invited me"         → status='invited',  requester=user1, NOT a member
        #   B) "I requested to join"        → status='pending',  requester=user1, NOT a member
        #   C) "Request on my thread"       → status='pending',  from non-member,
        #                                     on a thread user1 owns or moderates
        # ================================================================
        print(f"\n📨  Phase 5: Seeding invite scenarios for User 1...")

        invite_counts = seed_invite_scenarios(
            user1=user1,
            other_users=other_users,
            all_threads=all_threads,
            learnora_bot_id=learnora_bot_id,
        )

        invite_threads_total = invite_counts["invite_threads"] + invite_counts["request_threads"]
        print(
            f"\n   ✅  Phase 5 complete:"
            f"\n      🧵  Extra threads created (no user 1):  {invite_threads_total}"
            f"\n      📬  Invites received by user 1:         {invite_counts['invites_received']}"
            f"\n      📤  Pending requests sent by user 1:    {invite_counts['requests_sent']}"
            f"\n      📥  Inbound requests user 1 can see:    {invite_counts['requests_received']}"
        )

        # ================================================================
        # FINAL COMMIT
        # ================================================================
        db.session.commit()
        logger.info(
            f"Final commit: {threads_created} threads, {messages_created} messages, "
            f"{join_reqs_created} join requests, {invite_threads_total} invite-scenario threads."
        )
        print(f"\n✅  All data committed successfully.")

        print_summary(all_threads, primary_users, messages_created, join_reqs_created)
        return True

    except Exception as e:
        db.session.rollback()
        logger.error(f"Unexpected error during thread seeding: {e}", exc_info=True)
        print(f"❌  Unexpected error: {e}")
        return False


# ============================================================================
# SUMMARY
# ============================================================================

def print_summary(
    threads: List[Thread],
    primary_users: List[User],
    messages_created: int,
    join_reqs_created: int,
) -> None:
    print("\n" + "=" * 60)
    print("📊  THREAD SEED SUMMARY  (Animal Edition)")
    print("=" * 60)

    total_threads   = Thread.query.count()
    total_messages  = ThreadMessage.query.count()
    total_deleted   = ThreadMessage.query.filter_by(is_deleted=True).count()
    total_pinned    = ThreadMessage.query.filter_by(is_pinned=True).count()
    total_ai        = ThreadMessage.query.filter_by(is_ai_response=True).count()
    total_replies   = ThreadMessage.query.filter(ThreadMessage.reply_to_id.isnot(None)).count()
    total_reactions = ThreadMessageReaction.query.count()
    total_members   = ThreadMember.query.count()
    total_join_reqs = ThreadJoinRequest.query.count()
    total_receipts  = ThreadMessageReadReceipt.query.count()

    total_empty = sum(
        1 for t in threads
        if ThreadMessage.query.filter_by(thread_id=t.id).count() == 0
    )

    print(f"\n🧵  Threads Created:        {total_threads}  ({total_empty} empty)")
    print(f"👥  Thread Members:         {total_members}")
    print(f"📥  Join Requests:          {total_join_reqs}")
    print(f"\n💬  Total Messages:         {total_messages}")
    print(f"   🔁  Replies:             {total_replies}")
    print(f"   📌  Pinned:              {total_pinned}")
    print(f"   🤖  AI (Learnora):       {total_ai}")
    print(f"   🗑️   Soft-deleted:        {total_deleted}")

    print(f"\n📨  Message Status Breakdown:")
    for status_val, icon in [("sent", "📤"), ("delivered", "✉️ "), ("read", "👁️ ")]:
        count = ThreadMessage.query.filter_by(status=status_val).count()
        print(f"   {icon}  {status_val.capitalize():10s}: {count}")

    print(f"\n🧾  Read Receipts:          {total_receipts}")
    print(f"\n😀  Total Reactions:        {total_reactions}")

    # Per-primary-user stats
    print(f"\n👤  Primary User Stats:")
    for u in primary_users:
        u_creator   = Thread.query.filter_by(creator_id=u.id).count()
        u_member    = ThreadMember.query.filter_by(student_id=u.id).count()
        u_msgs      = ThreadMessage.query.filter_by(sender_id=u.id).count()
        u_mod_count = ThreadMember.query.filter_by(student_id=u.id, role="moderator").count()
        print(f"\n   ── User ID {u.id}")
        print(f"      Username:                {u.username}")
        print(f"      Threads as creator:      {u_creator}")
        print(f"      Threads as member/mod:   {u_member}")
        print(f"      Threads as moderator:    {u_mod_count}")
        print(f"      Messages sent:           {u_msgs}")

    print("\n📋  Join Request Status Breakdown:")
    for status in ("pending", "accepted", "rejected", "invited"):
        count = ThreadJoinRequest.query.filter_by(status=status).count()
        icon  = {"pending": "⏳", "accepted": "✅", "rejected": "❌", "invited": "📬"}[status]
        print(f"   {icon}  {status.capitalize():10s}: {count}")

    # ── Phase 5 invite scenario breakdown for User 1 ─────────────────────────
    if primary_users:
        u1 = primary_users[0]
        print(f"\n📨  User 1 Invite Scenario Breakdown  (ID {u1.id} · {u1.username}):")

        # A — invites received: status='invited', requester_id=user1
        invited_count = ThreadJoinRequest.query.filter_by(
            requester_id=u1.id, status="invited"
        ).count()
        print(f"   📬  Invites received (not yet a member):   {invited_count}")

        # B — requests sent by user1 still pending: status='pending', requester_id=user1
        sent_count = ThreadJoinRequest.query.filter_by(
            requester_id=u1.id, status="pending"
        ).count()
        print(f"   📤  Pending requests sent by user 1:       {sent_count}")

        # C — inbound pending requests on threads user1 owns or moderates
        u1_mod_thread_ids = [
            m.thread_id
            for m in ThreadMember.query.filter(
                ThreadMember.student_id == u1.id,
                ThreadMember.role.in_(["creator", "moderator"]),
            ).all()
        ]
        inbound_count = (
            ThreadJoinRequest.query.filter(
                ThreadJoinRequest.thread_id.in_(u1_mod_thread_ids),
                ThreadJoinRequest.status == "pending",
                ThreadJoinRequest.requester_id != u1.id,   # exclude user1's own requests
            ).count()
            if u1_mod_thread_ids else 0
        )
        print(f"   📥  Inbound pending requests user 1 sees:  {inbound_count}")

    print("\n🗂️   Per-Thread Breakdown:")
    for t in Thread.query.all():
        msg_cnt   = ThreadMessage.query.filter_by(thread_id=t.id).count()
        mbr_cnt   = ThreadMember.query.filter_by(thread_id=t.id).count()
        empty_tag = "  💭 (empty)" if msg_cnt == 0 else ""
        print(f"   [{t.id:>2}] {t.title[:42]:<42}  {mbr_cnt} members  {msg_cnt} msgs{empty_tag}")

    print("\n" + "=" * 60)
    print("✨  Thread seed complete! Data is ready to use.")
    print("=" * 60 + "\n")

    logger.info("Summary statistics printed.")


# ============================================================================
# STANDALONE EXECUTION
# ============================================================================

if __name__ == "__main__":
    from app import app

    with app.app_context():
        success = seed_threads()

        if success:
            logger.info("Thread seed script completed successfully.")
            exit(0)
        else:
            logger.error("Thread seed script failed.")
            exit(1)
