"""
Connection System Seed Script — RECEIVER-HEAVY FOR USER 1
==========================================================
Key changes vs previous version
---------------------------------
1. User 1 is the RECEIVER on ~75 % of their connections (others send to them).
   Previously the requester/receiver choice was 50/50.

2. FORCE_CLEAR = True — no interactive confirmation prompt.

3. Total connections raised to 120 to give User 1 a richer network.

4. Connections that involve User 1 are seeded with realistic statuses:
      accepted  60 %   (these form mutual-count denominator for suggestions)
      pending   30 %   (incoming requests still showing)
      rejected   7 %
      blocked    3 %

5. Inter-user (non-User-1) connections give other users some accepted
   connections so mutual-count numbers are non-zero.

6. ISOLATION GUARANTEE — at least MIN_ISOLATED_USERS (default 20) users are
   carved out before any User-1 connections are created. Those users never
   appear as requester or receiver on any Connection row involving User 1,
   in any status — no accepted/pending/rejected/blocked, no history at all.
   They can still connect with each other in Phase 2.

Run AFTER user_seed.py
"""

import random
import datetime
import logging
from typing import List, Dict, Set, Tuple, Optional
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from extensions import db
from models import User, Connection, StudentProfile, OnboardingDetails


# ============================================================================
# CONFIGURATION
# ============================================================================

class SeedConfig:
    NUM_CONNECTIONS   = 120
    SEED_RANDOM_STATE = 42
    BATCH_SIZE        = 20
    FORCE_CLEAR       = True   # skip interactive confirmation

    # Fraction of total connections that involve User 1
    USER1_FRACTION    = 0.75   # 90 connections touch User 1

    # For User-1 connections: probability that User 1 is the RECEIVER
    USER1_AS_RECEIVER = 0.75   # 75 % incoming,  25 % outgoing

    # Guarantee that at least this many users have ZERO connection rows
    # touching User 1 (no requester/receiver relationship in any status,
    # ever). These users are carved out BEFORE Phase 1 runs so they can
    # never be picked as a User-1 connection partner.
    MIN_ISOLATED_USERS = 20

    # Status weights for User-1 connections
    USER1_STATUS = {
        "accepted": 0.60,
        "pending":  0.30,
        "rejected": 0.07,
        "blocked":  0.03,
    }

    # Status weights for inter-user connections
    OTHER_STATUS = {
        "accepted": 0.55,
        "pending":  0.25,
        "rejected": 0.12,
        "blocked":  0.08,
    }

    MAX_DAYS_AGO = 180
    MIN_DAYS_AGO = 1


config = SeedConfig()

# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("seed_connections.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


# ============================================================================
# DATA POOLS
# ============================================================================

CONNECTION_TYPES = [
    "study_partner", "mentor_mentee", "classmate",
    "project_partner", "tutoring",
]

SUBJECTS = [
    "Calculus", "Linear Algebra", "Physics", "Chemistry",
    "Data Structures", "Algorithms", "Database Systems",
    "Web Development", "Machine Learning", "Statistics",
    "Discrete Math", "Operating Systems", "Networks",
    "Software Engineering", "Computer Architecture",
    "Artificial Intelligence", "Signal Processing",
]

REQUESTER_NOTES = [
    "Hi! I saw you're also studying {subject}. Want to connect?",
    "Hey! Would love to be study partners this semester",
    "Hi! Our mutual friend suggested we connect",
    "Hello! I could use help with {subject}",
    "Hey! Let's collaborate on upcoming projects",
    "Really impressed by your posts on {subject}.",
    "Met in {subject} class. Would love to keep in touch.",
    "Connected through mutual friends. Excited to work together!",
    "Shared interest in {subject}. Looking forward to studying together.",
    "Really good at explaining {subject} concepts — hope you'll help me!",
    "Connected for {subject} project collaboration.",
    "Mutual connection suggested we link up for {subject}.",
    "Met during office hours. Very approachable!",
    "Active contributor in forums. Reached out to connect.",
    "Saw your profile and think we'd make great study partners.",
    "Your notes on {subject} are amazing — can we connect?",
    "Hope to learn a lot from you on {subject}.",
    "Looking for an accountability partner for {subject}.",
    "Heard great things about you from classmates!",
    "Want to form a study group for {subject} — interested?",
]

RECEIVER_NOTES = [
    "Seems motivated. Happy to help with {subject}.",
    "New connection. Will see how collaboration goes.",
    "Accepted because we're in the same {subject} class.",
    "Could use my help with {subject}. Willing to assist.",
    "Mutual friends vouched for them. Gave it a shot.",
    "Same department. Networking for future projects.",
    "Seems genuine. Looking forward to working together.",
    "Connection requested help. Happy to share knowledge.",
    "Reached out politely. Seems like a good fit.",
    "Part of {subject} group project. Added for coordination.",
    "Needs support in {subject}. I can help with that.",
    "Active in same threads. Good to have in network.",
    "Similar study style. Could work well together.",
    "Accepted to build stronger class connections.",
    "Looking for {subject} study partner. This could work.",
    "Mutual interest in {subject} topics.",
    "Added during study group formation.",
    "Seems responsible and committed to learning.",
    "Happy to mentor on {subject}.",
    "Great energy — looking forward to our sessions.",
]


# ============================================================================
# HELPERS
# ============================================================================

def gen_note(templates: List[str]) -> str:
    t = random.choice(templates)
    if "{subject}" in t:
        return t.format(subject=random.choice(SUBJECTS)) if random.random() < 0.75 \
               else t.replace("{subject}", "various topics")
    return t


def pick_status(weights: Dict[str, float]) -> str:
    return random.choices(list(weights.keys()), weights=list(weights.values()))[0]


def response_timedelta(status: str) -> Optional[datetime.timedelta]:
    if status == "accepted":
        return datetime.timedelta(hours=random.randint(1, 24)) \
               if random.random() < 0.70 else \
               datetime.timedelta(days=random.randint(1, 7))
    if status == "rejected":
        return datetime.timedelta(days=random.randint(1, 14))
    if status == "blocked":
        return datetime.timedelta(hours=random.randint(0, 3))
    return None


def make_connection(
    requester: User,
    receiver:  User,
    status:    str,
    requested_at: datetime.datetime,
) -> Connection:
    td = response_timedelta(status)
    return Connection(
        requester_id=requester.id,
        receiver_id=receiver.id,
        status=status,
        requested_at=requested_at,
        responded_at=(requested_at + td) if td else None,
        connection_type=random.choice(CONNECTION_TYPES),
        requester_notes=gen_note(REQUESTER_NOTES) if random.random() < 0.80 else None,
        receiver_notes=(gen_note(RECEIVER_NOTES)
                        if status == "accepted" and random.random() < 0.80 else None),
        is_seen=random.choice([True, False]) if status == "pending" else True,
    )


# ============================================================================
# DATABASE
# ============================================================================

def clear_existing_connections() -> bool:
    try:
        cnt = Connection.query.count()
        if cnt:
            print(f"🗑️  Auto-clearing {cnt} existing connections (FORCE_CLEAR=True)...")
        Connection.query.delete()
        db.session.commit()
        print("✅ Connections cleared")
        return True
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Clear failed: {e}")
        print(f"❌ Clear failed: {e}")
        return False


def check_prerequisites() -> Tuple[bool, List[User]]:
    users = User.query.filter_by(status="approved").all()
    if len(users) < 2:
        print("❌ Need at least 2 approved users. Run user_seed.py first.")
        return False, []
    print(f"✅ Found {len(users)} approved users")

    # The isolation guarantee needs MIN_ISOLATED_USERS reserved PLUS enough
    # left over to actually build User 1's network.
    min_needed = config.MIN_ISOLATED_USERS + 2
    if len(users) - 1 < min_needed:
        print(f"⚠️  Only {len(users) - 1} non-primary users exist; the "
              f"{config.MIN_ISOLATED_USERS}-user isolation guarantee will be "
              f"reduced automatically (see Phase 1 output).")
    return True, users


# ============================================================================
# MAIN SEED
# ============================================================================

def seed_connections() -> bool:
    print("🌱 Starting connection seed (RECEIVER-HEAVY for User 1)...")
    random.seed(config.SEED_RANDOM_STATE)

    ok, all_users = check_prerequisites()
    if not ok:
        return False

    if not clear_existing_connections():
        return False

    primary = User.query.filter_by(id=1).first()
    if not primary:
        print("❌ User with ID=1 not found. Run user_seed.py first.")
        return False

    print(f"🎯 Primary user: {primary.name} (ID={primary.id})")

    others = [u for u in all_users if u.id != primary.id]
    random.shuffle(others)          # fresh order each run

    # ── Carve out a guaranteed-isolated pool BEFORE any targets are set ──────
    # These users will never be given a connection to/from User 1, in any
    # status, so they end up with zero shared history with the primary user.
    total_others    = len(others)
    isolated_target = config.MIN_ISOLATED_USERS

    if total_others < isolated_target + 2:
        # Not enough users to both isolate 20 and still build a network —
        # leave at least 2 users available for User-1 connections.
        isolated_target = max(total_others - 2, 0)
        print(f"⚠️  Only {total_others} other users available; reducing isolated "
              f"pool to {isolated_target} so User 1 still has connection partners.")

    isolated_users      = others[:isolated_target]
    eligible_for_user1  = others[isolated_target:]
    isolated_ids        = {u.id for u in isolated_users}

    print(f"🔒 Reserved {len(isolated_users)} users with NO connection/history to "
          f"User 1 (ids: {sorted(isolated_ids)})")

    # User-1 target can't exceed the number of users actually eligible to
    # connect with User 1 (each pair is only used once in Phase 1).
    desired_user1_target = int(config.NUM_CONNECTIONS * config.USER1_FRACTION)
    user1_conn_target     = min(desired_user1_target, len(eligible_for_user1))
    other_conn_target     = config.NUM_CONNECTIONS - user1_conn_target

    if user1_conn_target < desired_user1_target:
        print(f"⚠️  Eligible pool ({len(eligible_for_user1)}) is smaller than the "
              f"desired User-1 target ({desired_user1_target}); capping at "
              f"{user1_conn_target}.")

    print(f"📊 Plan: {user1_conn_target} with User 1  |  {other_conn_target} inter-user")

    used_pairs: Set[Tuple[int, int]] = set()
    created = failed = 0
    now = datetime.datetime.utcnow()

    # ── Phase 1: User-1 connections (receiver-heavy) ─────────────────────────
    print(f"\n🔗 Phase 1: User-1 connections ({user1_conn_target} total)...")

    # Only draw from the eligible (non-isolated) pool.
    pool = list(eligible_for_user1)
    random.shuffle(pool)

    for other in pool:
        if created >= user1_conn_target:
            break

        pair = tuple(sorted([primary.id, other.id]))
        if pair in used_pairs:
            continue
        used_pairs.add(pair)

        # Decide direction: receiver 75 %, requester 25 %
        if random.random() < config.USER1_AS_RECEIVER:
            requester, receiver = other, primary      # other → User 1 (incoming)
        else:
            requester, receiver = primary, other      # User 1 → other (outgoing)

        status       = pick_status(config.USER1_STATUS)
        days_ago     = random.randint(config.MIN_DAYS_AGO, config.MAX_DAYS_AGO)
        requested_at = now - datetime.timedelta(days=days_ago)

        try:
            conn = make_connection(requester, receiver, status, requested_at)
            db.session.add(conn)
            created += 1

            if created % config.BATCH_SIZE == 0:
                db.session.commit()
                print(f"   ✓ {created}/{config.NUM_CONNECTIONS} connections...")

        except Exception as e:
            logger.error(f"Phase-1 error: {e}")
            failed += 1

    # ── Phase 2: Inter-user connections ──────────────────────────────────────
    print(f"\n🔗 Phase 2: Inter-user connections ({other_conn_target} total)...")

    attempts = 0
    max_attempts = other_conn_target * 5

    while (created - user1_conn_target) < other_conn_target:
        attempts += 1
        if attempts > max_attempts or len(others) < 2:
            break

        req, rec = random.sample(others, 2)
        pair = tuple(sorted([req.id, rec.id]))
        if pair in used_pairs:
            continue
        used_pairs.add(pair)

        status       = pick_status(config.OTHER_STATUS)
        days_ago     = random.randint(config.MIN_DAYS_AGO, config.MAX_DAYS_AGO)
        requested_at = now - datetime.timedelta(days=days_ago)

        try:
            conn = make_connection(req, rec, status, requested_at)
            db.session.add(conn)
            created += 1

            if created % config.BATCH_SIZE == 0:
                db.session.commit()
                print(f"   ✓ {created}/{config.NUM_CONNECTIONS} connections...")

        except Exception as e:
            logger.error(f"Phase-2 error: {e}")
            failed += 1

    # Final commit
    try:
        db.session.commit()
        print(f"\n✅ {created} connections created  |  {failed} failed")
    except SQLAlchemyError as e:
        db.session.rollback()
        print(f"❌ Final commit failed: {e}")
        return False

    print_summary()
    return True


# ============================================================================
# SUMMARY
# ============================================================================

def print_summary():
    print("\n" + "=" * 60)
    print("📊 CONNECTION SEED SUMMARY")
    print("=" * 60)

    total = Connection.query.count()
    print(f"Total connections: {total}")

    # User 1 breakdown
    user1 = User.query.filter_by(id=1).first()
    if user1:
        as_req = Connection.query.filter_by(requester_id=1).count()
        as_rec = Connection.query.filter_by(receiver_id=1).count()
        u1_total = as_req + as_rec
        print(f"\n👤 User 1 ({user1.name}):")
        print(f"   Total connections : {u1_total}  ({u1_total/total*100:.1f}% of all)")
        print(f"   As REQUESTER (sent)    : {as_req}")
        print(f"   As RECEIVER (received) : {as_rec}")
        recv_pct = as_rec / u1_total * 100 if u1_total else 0
        print(f"   Receiver share    : {recv_pct:.0f}%  "
              f"{'✅' if recv_pct >= 60 else '⚠️  below target'}")

    # Isolation check — users with NO connection row touching User 1 at all
    touching_user1 = Connection.query.filter(
        (Connection.requester_id == 1) | (Connection.receiver_id == 1)
    ).all()
    connected_ids = {c.requester_id for c in touching_user1} | \
                    {c.receiver_id for c in touching_user1}
    connected_ids.discard(1)

    all_other_ids = {u.id for u in User.query.filter(User.id != 1).all()}
    isolated_ids  = all_other_ids - connected_ids

    print(f"\n🔒 Users with NO connection/history to User 1: {len(isolated_ids)}  "
          f"{'✅' if len(isolated_ids) >= 20 else '⚠️  below target of 20'}")
    if isolated_ids:
        print(f"   ids: {sorted(isolated_ids)}")

    # Status breakdown
    print(f"\n📋 Status breakdown:")
    icons = {"accepted": "✅", "pending": "⏳", "rejected": "❌", "blocked": "🚫"}
    for st in ["accepted", "pending", "rejected", "blocked"]:
        cnt = Connection.query.filter_by(status=st).count()
        pct = cnt / total * 100 if total else 0
        print(f"   {icons[st]} {st.capitalize()}: {cnt} ({pct:.1f}%)")

    # Notes stats
    rn = Connection.query.filter(Connection.requester_notes.isnot(None)).count()
    rcn = Connection.query.filter(Connection.receiver_notes.isnot(None)).count()
    print(f"\n📝 Notes: requester={rn}, receiver={rcn}")

    print("\n" + "=" * 60)
    print("✨ Connection seed complete!")
    print("=" * 60 + "\n")


# ============================================================================
# STANDALONE
# ============================================================================

if __name__ == "__main__":
    from app import app

    with app.app_context():
        success = seed_connections()
        exit(0 if success else 1)
