"""
Invite Seed Script
Reads existing threads and users from the database and seeds
ThreadJoinRequest records with status="invited".

No threads, members, or messages are created.

Run this AFTER thread_seed.py (or any script that has already seeded threads).
"""

import random
import datetime
import logging
from typing import List, Set, Tuple
from sqlalchemy.exc import SQLAlchemyError
from extensions import db
from models import (
    User,
    Thread,
    ThreadMember,
    ThreadJoinRequest,
)


# ============================================================================
# CONFIGURATION
# ============================================================================

class InviteConfig:
    NUM_INVITES      = 30    # total invite records to create
    SEED_RANDOM_STATE = 99
    MAX_DAYS_AGO     = 60
    MIN_DAYS_AGO     = 1


config = InviteConfig()


# ============================================================================
# LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("seed_invites.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


# ============================================================================
# DATA POOLS
# ============================================================================

INVITE_MESSAGES = [
    "Hey! I think you'd be a great fit for this study group.",
    "We'd love to have you join — your background is exactly what we need.",
    "Spotted your profile and thought you might enjoy this thread.",
    "A mutual friend suggested I invite you. Hope you can join!",
    "We're looking for members who are strong in this area — interested?",
    "This group could really use your expertise. Come join us!",
    "We just started this thread and wanted to get the right people in early.",
    "You'd fit right in with this group. Hope to see you here!",
    None,  # some invites have no message
    None,
]


# ============================================================================
# HELPERS
# ============================================================================

def random_past_datetime(max_days: int = config.MAX_DAYS_AGO,
                          min_days: int = config.MIN_DAYS_AGO) -> datetime.datetime:
    days    = random.randint(min_days, max_days)
    hours   = random.randint(0, 23)
    minutes = random.randint(0, 59)
    return datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        days=days, hours=hours, minutes=minutes
    )


# ============================================================================
# MAIN SEED FUNCTION
# ============================================================================

def seed_invites() -> bool:
    print("🌱  Starting invite seed script...")
    logger.info("Invite seed starting.")

    random.seed(config.SEED_RANDOM_STATE)

    # ── Load existing threads ────────────────────────────────────────────────
    threads: List[Thread] = Thread.query.all()
    if not threads:
        print("❌  No threads found in the database. Run thread_seed.py first.")
        logger.error("No threads found — aborting.")
        return False

    print(f"✅  Found {len(threads)} existing threads.")

    # ── Load all users ───────────────────────────────────────────────────────
    all_users: List[User] = User.query.filter_by(status="approved").all()
    if not all_users:
        print("❌  No approved users found. Run user_seed.py first.")
        logger.error("No approved users found — aborting.")
        return False

    print(f"✅  Found {len(all_users)} approved users.")

    # ── Build member map: thread_id → set of user_ids already in thread ──────
    member_map: dict = {}
    for thread in threads:
        ids = {m.student_id for m in ThreadMember.query.filter_by(thread_id=thread.id).all()}
        member_map[thread.id] = ids

    # ── Clear existing invites ───────────────────────────────────────────────
    try:
        deleted = ThreadJoinRequest.query.filter_by(status="invited").delete(
            synchronize_session=False
        )
        db.session.commit()
        print(f"🗑️   Cleared {deleted} existing 'invited' records.")
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Failed to clear existing invites: {e}")
        print(f"❌  Failed to clear existing invites: {e}")
        return False

    # ── Seed invites ─────────────────────────────────────────────────────────
    try:
        created    = 0
        # Pre-load ALL existing (thread_id, requester_id) pairs regardless of status,
        # so we never attempt to insert a duplicate even when a non-'invited' row
        # survived the earlier delete (e.g. status='pending' or 'approved').
        existing = db.session.query(
            ThreadJoinRequest.thread_id,
            ThreadJoinRequest.requester_id,
        ).all()
        used_pairs: Set[Tuple[int, int]] = set(existing)

        for _ in range(config.NUM_INVITES * 5):   # extra attempts to hit the target
            if created >= config.NUM_INVITES:
                break

            thread      = random.choice(threads)
            member_ids  = member_map.get(thread.id, set())

            # Invite someone who is NOT already in the thread
            candidates  = [u for u in all_users if u.id not in member_ids]
            if not candidates:
                continue

            invitee = random.choice(candidates)
            pair    = (thread.id, invitee.id)
            if pair in used_pairs:
                continue
            used_pairs.add(pair)

            # The inviter is a current member (prefer creator/moderator)
            thread_members = ThreadMember.query.filter_by(thread_id=thread.id).all()
            privileged     = [m for m in thread_members if m.role in ("creator", "moderator")]
            inviter_member = random.choice(privileged if privileged else thread_members)

            requested_at = random_past_datetime()

            db.session.add(ThreadJoinRequest(
                thread_id=thread.id,
                requester_id=invitee.id,
                message=random.choice(INVITE_MESSAGES),
                status="invited",
                requested_at=requested_at,
                reviewed_at=None,
                reviewed_by=inviter_member.student_id,
            ))
            created += 1

            if created % 10 == 0:
                db.session.commit()
                print(f"   ✓ {created} invites committed...")

        db.session.commit()
        logger.info(f"Invite seed complete: {created} invites created.")
        print(f"\n✅  {created} invites seeded successfully.")
        print_summary()
        return True

    except Exception as e:
        db.session.rollback()
        logger.error(f"Unexpected error during invite seeding: {e}", exc_info=True)
        print(f"❌  Unexpected error: {e}")
        return False


# ============================================================================
# SUMMARY
# ============================================================================

def print_summary() -> None:
    total = ThreadJoinRequest.query.filter_by(status="invited").count()

    print("\n" + "=" * 50)
    print("📊  INVITE SEED SUMMARY")
    print("=" * 50)
    print(f"\n📨  Total 'invited' records:  {total}")

    print("\n🗂️   Per-Thread Breakdown:")
    for thread in Thread.query.all():
        count = ThreadJoinRequest.query.filter_by(
            thread_id=thread.id, status="invited"
        ).count()
        if count:
            print(f"   [{thread.id:>2}] {thread.title[:42]:<42}  {count} invite(s)")

    print("\n" + "=" * 50)
    print("✨  Invite seed complete!")
    print("=" * 50 + "\n")
    logger.info("Invite seed summary printed.")


# ============================================================================
# STANDALONE EXECUTION
# ============================================================================

if __name__ == "__main__":
    from app import app

    with app.app_context():
        success = seed_invites()

        if success:
            logger.info("Invite seed script completed successfully.")
            exit(0)
        else:
            logger.error("Invite seed script failed.")
            exit(1)
