"""
Connection System Seed Script
Creates realistic connections with separate requester/receiver notes.
Run this AFTER user_seed.py
"""

import random
import datetime
import logging
from typing import List, Dict, Set, Tuple, Optional
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from extensions import db
from models import (
    User, Connection,
    StudentProfile, OnboardingDetails
)

# ============================================================================
# CONFIGURATION
# ============================================================================

class SeedConfig:
    """Centralized configuration for connection seeding"""
    NUM_CONNECTIONS = 100
    SEED_RANDOM_STATE = 42
    BATCH_SIZE = 20

    # Status distribution (realistic percentages)
    STATUS_DISTRIBUTION = {
        "accepted": 0.60,
        "pending": 0.25,
        "rejected": 0.10,
        "blocked": 0.05
    }

    # Date ranges
    MAX_DAYS_AGO = 180
    MIN_DAYS_AGO = 1

config = SeedConfig()

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('seed_connections.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# REALISTIC DATA POOLS
# ============================================================================

CONNECTION_TYPES = [
    "study_partner",
    "mentor_mentee",
    "classmate",
    "project_partner",
    "tutoring"
]

SUBJECTS = [
    "Calculus", "Linear Algebra", "Physics", "Chemistry",
    "Data Structures", "Algorithms", "Database Systems",
    "Web Development", "Machine Learning", "Statistics",
    "Discrete Math", "Operating Systems", "Networks",
    "Software Engineering", "Computer Architecture"
]

REQUESTER_NOTES_TEMPLATES = [
    "Hi! I saw you're also studying {subject}. Want to connect?",
    "Hey! Would love to be study partners this semester",
    "Hi! Our mutual friend suggested we connect",
    "Hello! I could use help with {subject}",
    "Hey! Let's collaborate on upcoming projects",
    "Great study partner! Really helps with {subject}.",
    "Met in {subject} class. Very knowledgeable.",
    "Connected through mutual friends. Seems helpful.",
    "Reached out for help with {subject}. Super patient!",
    "Active in study groups. Good resource for {subject}.",
    "Classmate from {subject}. Always willing to collaborate.",
    "Found through recommendations. Excited to work together!",
    "Shared interest in {subject}. Looking forward to studying together.",
    "Really good at explaining {subject} concepts.",
    "Helpful and friendly. Great addition to my network.",
    "Connected for {subject} project collaboration.",
    "Seems very organized and dedicated to studies.",
    "Mutual connection suggested we link up for {subject}.",
    "Met during office hours. Very approachable.",
    "Active contributor in forums. Reached out to connect."
]

RECEIVER_NOTES_TEMPLATES = [
    "Seems motivated. Happy to help with {subject}.",
    "New connection. Will see how collaboration goes.",
    "Accepted because we're in the same {subject} class.",
    "Could use my help with {subject}. Willing to assist.",
    "Mutual friends vouched for them. Gave it a shot.",
    "Added to expand my study network in {subject}.",
    "Seems genuine. Looking forward to working together.",
    "Connection requested help. Happy to share knowledge.",
    "Same department. Networking for future projects.",
    "Reached out politely. Seems like good fit for study sessions.",
    "Part of {subject} group project. Added for coordination.",
    "Recommended by classmate. Hoping for good collaboration.",
    "Needs support in {subject}. I can help with that.",
    "Active in same threads. Good to have in network.",
    "Similar study style. Could work well together.",
    "Accepted to build stronger class connections.",
    "Looking for {subject} study partner. This could work.",
    "Mutual interest in {subject} topics.",
    "Added during study group formation.",
    "Seems responsible and committed to learning."
]

# ============================================================================
# HELPER FUNCTIONS - NOTES
# ============================================================================

def generate_note(template_list: List[str]) -> str:
    """Generate a note from template with optional subject substitution"""
    template = random.choice(template_list)

    if "{subject}" in template and random.random() < 0.7:
        return template.format(subject=random.choice(SUBJECTS))
    elif "{subject}" in template:
        return template.replace("{subject}", "various topics")
    return template


def should_have_notes() -> bool:
    """Determine if a user should have notes (80% chance)"""
    return random.random() < 0.8


# ============================================================================
# HELPER FUNCTIONS - DATE & TIME
# ============================================================================

def generate_response_time(status: str) -> Optional[datetime.timedelta]:
    """Generate realistic response time based on status"""
    if status == "accepted":
        if random.random() < 0.70:
            return datetime.timedelta(hours=random.randint(1, 24))
        else:
            return datetime.timedelta(days=random.randint(1, 7))
    elif status == "rejected":
        if random.random() < 0.50:
            return datetime.timedelta(days=random.randint(1, 3))
        else:
            return datetime.timedelta(days=random.randint(7, 30))
    elif status == "blocked":
        return datetime.timedelta(hours=random.randint(0, 2))
    return None


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

def verify_database_connection() -> bool:
    """Verify database is accessible"""
    return True


def check_user_prerequisites() -> Tuple[bool, List[User]]:
    """Check if enough users exist for seeding"""
    all_users = User.query.filter_by(status="approved").all()

    if len(all_users) < 2:
        logger.error(f"Insufficient users: found {len(all_users)}, need at least 2")
        print("❌ Error: Need at least 2 approved users to create connections")
        print("💡 Tip: Run user_seed.py first")
        return False, []

    logger.info(f"Found {len(all_users)} approved users")
    print(f"✅ Found {len(all_users)} approved users")
    return True, all_users


def clear_existing_connections() -> bool:
    """Clear existing connection data with confirmation"""
    try:
        existing_count = Connection.query.count()

        if existing_count > 0:
            logger.warning(f"Found {existing_count} existing connections")
            print(f"\n⚠️  Warning: {existing_count} connections already exist")
            response = input("Clear all existing connection data? (yes/no): ")

            if response.lower() != 'yes':
                logger.info("Seed aborted by user")
                print("❌ Seed aborted")
                return False

        print("🗑️  Clearing existing connection data...")
        logger.info("Clearing existing connection data...")

        Connection.query.delete()

        db.session.commit()
        logger.info("Existing data cleared successfully")
        print("✅ Cleared existing data")
        return True

    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Failed to clear existing data: {e}")
        print(f"❌ Failed to clear data: {e}")
        return False


# ============================================================================
# CONNECTION CREATION
# ============================================================================

def create_connection_record(
    requester: User,
    receiver: User,
    status: str,
    requested_at: datetime.datetime
) -> Connection:
    """Create a single connection record with separate requester/receiver notes"""

    response_time = generate_response_time(status)
    responded_at = requested_at + response_time if response_time else None
    conn_type = random.choice(CONNECTION_TYPES)

    requester_notes = generate_note(REQUESTER_NOTES_TEMPLATES) if should_have_notes() else None
    receiver_notes = generate_note(RECEIVER_NOTES_TEMPLATES) if (status == "accepted" and should_have_notes()) else None

    connection = Connection(
        requester_id=requester.id,
        receiver_id=receiver.id,
        status=status,
        requested_at=requested_at,
        responded_at=responded_at,
        connection_type=conn_type,
        requester_notes=requester_notes,
        receiver_notes=receiver_notes,
        is_seen=random.choice([True, False]) if status == "pending" else True
    )

    logger.debug(f"Created connection: {requester.id} -> {receiver.id} ({status})")
    return connection


# ============================================================================
# MAIN SEED FUNCTION
# ============================================================================

def seed_connections() -> bool:
    """
    Main seeding function - creates connection records.
    Returns True if successful, False otherwise.
    """
    print("🌱 Starting connection seed script...")
    logger.info(f"Starting seed process for {config.NUM_CONNECTIONS} connections")

    random.seed(config.SEED_RANDOM_STATE)

    if not verify_database_connection():
        return False

    success, all_users = check_user_prerequisites()
    if not success:
        return False

    if not clear_existing_connections():
        return False

    print(f"🔗 Creating {config.NUM_CONNECTIONS} connections...")
    logger.info(f"Creating {config.NUM_CONNECTIONS} connections")

    connections_created = 0
    connections_failed = 0
    used_pairs: Set[Tuple[int, int]] = set()
    now = datetime.datetime.utcnow()

    # Get first user (ID=1) as the primary hub
    primary_user = User.query.filter_by(id=1).first()
    if not primary_user:
        logger.error("User with ID=1 not found")
        print("❌ Error: User with ID=1 not found. Please ensure user seeding creates user with ID=1")
        return False

    print(f"🎯 Primary user: {primary_user.name} (ID: {primary_user.id})")
    logger.info(f"Using primary user: {primary_user.name} (ID: {primary_user.id})")

    primary_user_connections = int(config.NUM_CONNECTIONS * 0.90)
    other_connections = config.NUM_CONNECTIONS - primary_user_connections

    print(f"📊 Distribution: {primary_user_connections} with User 1, {other_connections} random")
    logger.info(f"Connection distribution: {primary_user_connections} primary, {other_connections} random")

    try:
        # Phase 1: Connections with primary user (User ID=1)
        print(f"\n🔗 Phase 1: Creating {primary_user_connections} connections with User 1...")
        other_users = [u for u in all_users if u.id != primary_user.id]

        for i in range(primary_user_connections):
            if connections_created >= config.NUM_CONNECTIONS:
                break

            try:
                if not other_users:
                    logger.warning("Ran out of other users for primary connections")
                    break

                other_user = random.choice(other_users)
                other_users.remove(other_user)

                if random.choice([True, False]):
                    requester, receiver = primary_user, other_user
                else:
                    requester, receiver = other_user, primary_user

                pair_key = tuple(sorted([requester.id, receiver.id]))

                if pair_key in used_pairs:
                    continue

                used_pairs.add(pair_key)

                status = random.choices(
                    list(config.STATUS_DISTRIBUTION.keys()),
                    weights=list(config.STATUS_DISTRIBUTION.values())
                )[0]

                days_ago = random.randint(config.MIN_DAYS_AGO, config.MAX_DAYS_AGO)
                requested_at = now - datetime.timedelta(days=days_ago)

                connection = create_connection_record(requester, receiver, status, requested_at)
                db.session.add(connection)

                connections_created += 1

                if connections_created % config.BATCH_SIZE == 0:
                    try:
                        db.session.commit()
                        logger.info(f"Committed batch: {connections_created}/{config.NUM_CONNECTIONS}")
                        print(f"   ✓ Created {connections_created}/{config.NUM_CONNECTIONS} connections...")
                    except IntegrityError as e:
                        db.session.rollback()
                        logger.error(f"Integrity error in batch at {connections_created}: {e}")
                        connections_failed += 1

            except Exception as e:
                logger.error(f"Error creating connection {connections_created}: {e}")
                connections_failed += 1
                continue

        # Phase 2: Random connections between other users
        print(f"\n🔗 Phase 2: Creating {other_connections} random connections...")
        remaining_users = [u for u in all_users if u.id != primary_user.id]

        for _ in range(other_connections):
            if connections_created >= config.NUM_CONNECTIONS:
                break

            try:
                if len(remaining_users) < 2:
                    break

                requester, receiver = random.sample(remaining_users, 2)
                pair_key = tuple(sorted([requester.id, receiver.id]))

                if pair_key in used_pairs:
                    continue

                used_pairs.add(pair_key)

                status = random.choices(
                    list(config.STATUS_DISTRIBUTION.keys()),
                    weights=list(config.STATUS_DISTRIBUTION.values())
                )[0]

                days_ago = random.randint(config.MIN_DAYS_AGO, config.MAX_DAYS_AGO)
                requested_at = now - datetime.timedelta(days=days_ago)

                connection = create_connection_record(requester, receiver, status, requested_at)
                db.session.add(connection)

                connections_created += 1

                if connections_created % config.BATCH_SIZE == 0:
                    try:
                        db.session.commit()
                        logger.info(f"Committed batch: {connections_created}/{config.NUM_CONNECTIONS}")
                        print(f"   ✓ Created {connections_created}/{config.NUM_CONNECTIONS} connections...")
                    except IntegrityError as e:
                        db.session.rollback()
                        logger.error(f"Integrity error in batch at {connections_created}: {e}")
                        connections_failed += 1

            except Exception as e:
                logger.error(f"Error creating connection {connections_created}: {e}")
                connections_failed += 1
                continue

        # Final commit
        try:
            db.session.commit()
            logger.info(f"Final commit successful: {connections_created} connections created")
            print(f"✅ Created {connections_created} connections successfully!")

            if connections_failed > 0:
                logger.warning(f"{connections_failed} connections failed")
                print(f"⚠️  {connections_failed} connections failed to create")

        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Final commit failed: {e}")
            print(f"❌ Final commit failed: {e}")
            return False

        print_summary_statistics()
        return True

    except Exception as e:
        logger.error(f"Unexpected error during seeding: {e}", exc_info=True)
        db.session.rollback()
        print(f"❌ Unexpected error: {e}")
        return False


def print_summary_statistics():
    """Print summary of seeded connection data"""
    print("\n" + "=" * 60)
    print("📊 SEED SUMMARY")
    print("=" * 60)

    total_connections = Connection.query.count()
    print(f"Total Connections: {total_connections}")

    # Notes statistics
    print(f"\n📝 Notes Statistics:")
    requester_notes_count = Connection.query.filter(
        Connection.requester_notes.isnot(None),
        Connection.requester_notes != ""
    ).count()
    receiver_notes_count = Connection.query.filter(
        Connection.receiver_notes.isnot(None),
        Connection.receiver_notes != ""
    ).count()
    both_notes_count = Connection.query.filter(
        Connection.requester_notes.isnot(None),
        Connection.requester_notes != "",
        Connection.receiver_notes.isnot(None),
        Connection.receiver_notes != ""
    ).count()

    if total_connections > 0:
        print(f"  Connections with requester notes: {requester_notes_count} ({requester_notes_count / total_connections * 100:.1f}%)")
        print(f"  Connections with receiver notes:  {receiver_notes_count} ({receiver_notes_count / total_connections * 100:.1f}%)")
        print(f"  Connections with both notes:      {both_notes_count} ({both_notes_count / total_connections * 100:.1f}%)")

    # User 1 breakdown
    primary_user = User.query.filter_by(id=1).first()
    if primary_user:
        primary_connections = Connection.query.filter(
            db.or_(
                Connection.requester_id == 1,
                Connection.receiver_id == 1
            )
        ).count()
        primary_pct = (primary_connections / total_connections * 100) if total_connections > 0 else 0

        print(f"\n👤 User 1 ({primary_user.name}):")
        print(f"  Connections: {primary_connections} ({primary_pct:.1f}% of total)")
        print(f"  As Requester: {Connection.query.filter_by(requester_id=1).count()}")
        print(f"  As Receiver:  {Connection.query.filter_by(receiver_id=1).count()}")

    # Status distribution
    print(f"\n📋 Connection Status:")
    icons = {"accepted": "✅", "pending": "⏳", "rejected": "❌", "blocked": "🚫"}
    for status in ["accepted", "pending", "rejected", "blocked"]:
        count = Connection.query.filter_by(status=status).count()
        pct = (count / total_connections * 100) if total_connections > 0 else 0
        print(f"  {icons[status]} {status.capitalize()}: {count} ({pct:.1f}%)")

    print("\n" + "=" * 60)
    print("✨ Connection seed complete! Your data is ready to use.")
    print("=" * 60 + "\n")

    logger.info("Summary statistics printed successfully")


# ============================================================================
# STANDALONE EXECUTION
# ============================================================================

if __name__ == "__main__":
    from app import app

    with app.app_context():
        success = seed_connections()

        if success:
            logger.info("Connection seed script completed successfully")
            exit(0)
        else:
            logger.error("Connection seed script failed")
            exit(1)
