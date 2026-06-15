"""
Feed System Seed Script
Creates a comprehensive, realistic feed: posts (with file attachments),
post views, comments (with nested replies + their own attachments),
comment likes, comment helpful marks, post reactions, post follows,
and @mentions.

Intentionally SKIPPED: Bookmark rows (per product decision). BookmarkFolder
rows are also skipped since they're meaningless without bookmarks.

Run this AFTER user_seed.py and connection_seed.py (mentions/follows read
more naturally when connections already exist, though it's not a hard
dependency).
"""

import random
import datetime
import logging
from typing import List, Dict, Set, Tuple, Optional
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from extensions import db
from models import (
    User, StudentProfile, Post, PostView, Comment, CommentLike,
    CommentHelpfulMark, PostReaction, PostFollow, Mention, PostEvent,
    Connection,
)

# ============================================================================
# CONFIGURATION
# ============================================================================

class SeedConfig:
    """Centralized configuration for feed seeding"""
    NUM_POSTS = 220                 # "at least 200" + buffer for safety
    SEED_RANDOM_STATE = 42
    BATCH_SIZE = 25

    # Post type distribution (realistic mix, weighted toward Q&A)
    POST_TYPE_DISTRIBUTION = {
        "question":     0.40,
        "discussion":   0.25,
        "resource":     0.15,
        "problem":      0.12,
        "announcement": 0.08,
    }

    # Of "question"/"problem" posts, how many end up solved
    SOLVED_RATE = 0.55

    # Fraction of posts that get at least one file attachment
    ATTACHMENT_RATE = 0.45
    MAX_ATTACHMENTS_PER_POST = 3

    # Fraction of comments that get an attachment
    COMMENT_ATTACHMENT_RATE = 0.12

    # Thread-collaboration toggle rate (separate thread system; just the flag)
    THREAD_ENABLED_RATE = 0.10

    # Pinned / locked are rare
    PINNED_RATE = 0.02
    LOCKED_RATE = 0.015

    # Comments per post (roughly realistic long-tail: many quiet posts, some hot ones)
    COMMENTS_PER_POST_WEIGHTS = {
        0: 0.15,
        1: 0.20,
        2: 0.18,
        3: 0.15,
        4: 0.10,
        5: 0.08,
        "6-10": 0.09,
        "11-20": 0.05,
    }

    # Of top-level comments, how many get at least one reply
    REPLY_RATE = 0.35
    MAX_REPLIES_PER_COMMENT = 4

    # Reaction rate: fraction of (user, post) pairs among "plausible reactors"
    # that actually react
    REACTION_RATE = 0.35
    REACTION_TYPES = ["like", "love", "helpful", "insightful", "fire", "wow", "celebrate"]
    REACTION_WEIGHTS = [0.35, 0.15, 0.20, 0.12, 0.08, 0.05, 0.05]

    # Comment-like rate among plausible likers
    COMMENT_LIKE_RATE = 0.30
    COMMENT_HELPFUL_RATE = 0.18  # only applies to comments on question/problem posts

    # View rate: how many distinct users view a given post (besides the author)
    MIN_VIEWS_PER_POST = 1
    MAX_VIEWS_PER_POST = 35

    # Follow rate: fraction of viewers who also follow the post
    FOLLOW_RATE = 0.12

    # Mention rate: fraction of posts/comments that contain a mention
    POST_MENTION_RATE = 0.10
    COMMENT_MENTION_RATE = 0.08

    # Date range for posts
    MAX_DAYS_AGO = 120
    MIN_DAYS_AGO = 0

config = SeedConfig()

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('seed_feed.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# REALISTIC DATA POOLS
# ============================================================================

DEPARTMENTS = [
    "Computer Science", "Electrical Engineering", "Mechanical Engineering",
    "Civil Engineering", "Mathematics", "Physics", "Chemistry", "Biology",
    "Economics", "Accounting", "Business Administration", "Law",
    "Architecture", "Statistics", "Psychology",
]

SUBJECTS = [
    "Calculus", "Linear Algebra", "Physics I", "Organic Chemistry",
    "Data Structures", "Algorithms", "Database Systems", "Operating Systems",
    "Web Development", "Machine Learning", "Statistics", "Discrete Math",
    "Computer Networks", "Software Engineering", "Computer Architecture",
    "Thermodynamics", "Circuit Theory", "Microeconomics", "Financial Accounting",
    "Constitutional Law", "Structural Analysis", "Differential Equations",
]

TAG_POOL = [
    "exam-prep", "midterm", "finals", "assignment", "project", "lab-report",
    "study-group", "deadline", "tutorial", "notes", "past-questions",
    "group-work", "research", "internship", "career", "coding", "math-help",
    "urgent", "revision", "thesis", "presentation",
]

# ---- Post title/body templates by type -------------------------------------

QUESTION_TITLES = [
    "Can someone explain {subject} {topic}?",
    "Struggling with {subject} — {topic} doesn't make sense",
    "How do you approach {topic} problems in {subject}?",
    "Is this the right way to solve {topic} in {subject}?",
    "Quick question about {subject}: {topic}",
    "Anyone understand {topic} from today's {subject} lecture?",
    "What's the difference between {topic} and the related concept?",
    "Need help with {topic} before the {subject} deadline",
]

QUESTION_BODIES = [
    "I've been stuck on {topic} for {subject} for a couple of hours now. I went through the lecture slides twice but it's still not clicking. Could someone break it down with a simple example?",
    "Working through the {subject} problem set and got completely stuck on {topic}. My approach gives a different answer than the textbook. Where am I going wrong?",
    "Our professor moved really fast through {topic} today and I couldn't keep up. Does anyone have notes or a simpler explanation for {subject}?",
    "I understand the theory behind {topic} but can't apply it to actual {subject} problems. Any tips on practice strategy?",
    "Is there a trick to remembering how {topic} works in {subject}? I keep mixing it up with similar concepts during exams.",
    "Trying to finish my {subject} assignment but {topic} keeps tripping me up. Attached what I have so far — would appreciate a sanity check.",
]

DISCUSSION_TITLES = [
    "Thoughts on the new {subject} curriculum changes?",
    "Best resources for self-studying {subject}?",
    "How is everyone preparing for the {subject} finals?",
    "Unpopular opinion: {subject} is more useful than people think",
    "What's your study routine for {subject} like?",
    "Anyone else find {subject} harder than expected this semester?",
]

DISCUSSION_BODIES = [
    "Just wanted to start a conversation about {subject} this semester. The pace feels different from previous years — curious what others think.",
    "I've tried a few different resources for {subject} and wanted to compare notes with everyone else taking it.",
    "With {subject} finals coming up, I'm curious how people are structuring their revision. Sharing my plan below, would love feedback.",
    "Been reflecting on {subject} and how it connects to real-world problems. Anyone have interesting examples from internships or projects?",
]

RESOURCE_TITLES = [
    "Compiled notes for {subject} — {topic}",
    "Free {subject} practice questions ({topic})",
    "Cheat sheet: {topic} formulas for {subject}",
    "Step-by-step guide to {topic} in {subject}",
    "Past exam questions for {subject}, organized by topic",
]

RESOURCE_BODIES = [
    "Made these notes while revising {topic} for {subject} and figured I'd share in case they help anyone else. Includes worked examples and common pitfalls.",
    "Put together a small practice set covering {topic} for {subject}. Answers included at the end — feel free to check your work.",
    "Found this really useful while preparing for {subject}, sharing here so it doesn't just sit in my drive forever.",
    "Summarized the key {topic} formulas and when to use each one. Hope this saves someone a few hours before the {subject} exam.",
]

PROBLEM_TITLES = [
    "Can't get this {subject} problem to work out — {topic}",
    "Where's the error in my {topic} solution? ({subject})",
    "{subject} problem: {topic} — answer doesn't match expected",
    "Help debugging my approach to a {topic} question in {subject}",
]

PROBLEM_BODIES = [
    "Attempted this {topic} problem for {subject} three different ways and keep getting an answer that doesn't match the back of the book. Attaching my work — what am I missing?",
    "This {subject} problem on {topic} seems straightforward but my solution doesn't check out. Would appreciate a second pair of eyes.",
    "Posting my full working for this {topic} problem. Something's off in either my setup or my algebra, can't tell which.",
]

ANNOUNCEMENT_TITLES = [
    "Study group for {subject} starting this week",
    "Reminder: {subject} assignment deadline moved",
    "Organizing a {subject} review session before finals",
    "New {subject} resources added to the shared drive",
    "{subject} tutoring slots open for this week",
]

ANNOUNCEMENT_BODIES = [
    "Starting a small study group for {subject}, meeting twice a week. Open to anyone in the department who wants to join — drop a comment if interested.",
    "Heads up — the {subject} deadline has shifted. Double check the updated date so nobody gets caught out.",
    "Putting together a review session covering the full {subject} syllabus before finals. Will share the agenda once finalized.",
    "Added a bunch of new {subject} material to the shared resource pool. Worth a look before your next assignment.",
]

TOPICS = [
    "integration by parts", "eigenvalues", "Big-O notation", "normalization",
    "recursion", "binary trees", "SQL joins", "process scheduling",
    "gradient descent", "hypothesis testing", "Lagrange multipliers",
    "stress-strain curves", "Thevenin equivalents", "supply and demand",
    "balance sheets", "case briefs", "vector spaces", "Fourier series",
    "object-oriented design", "API design", "concurrency", "type systems",
]

# ---- Comment templates ------------------------------------------------------

COMMENT_TEMPLATES = [
    "This helped a lot, thank you!",
    "I was wondering the same thing — following for updates.",
    "Try breaking it down into smaller steps first, that's what worked for me.",
    "Pretty sure the issue is in how you're setting up the initial condition.",
    "Here's how I approached a similar problem: {topic} usually trips people up because of the sign convention.",
    "Can you share more of your working? Hard to tell without seeing the full steps.",
    "This is a great explanation, saving this for later.",
    "I think there's a small error around the second step — double check your substitution.",
    "We covered this in office hours last week, happy to share notes if useful.",
    "Same thing happened to me on the last assignment. Turned out to be a rounding issue.",
    "Not 100% sure but I believe the correct approach involves {topic}.",
    "Could you upload the full question? Might be missing some context.",
    "This is exactly what I needed before the exam, thanks for posting!",
    "I'd double check the assumptions you're making here.",
    "Great resource, bookmarking this for revision season.",
    "Have you tried approaching it from the other direction first?",
    "This matches what the professor said in lecture, good summary.",
    "Solid explanation. One thing I'd add — watch out for edge cases.",
    "Appreciate you sharing your work, makes it easier to spot the mistake.",
    "I ran into the exact same wall last semester, it gets easier with practice.",
]

REPLY_TEMPLATES = [
    "Thanks, that makes sense now!",
    "Oh I see it now, appreciate the catch.",
    "Good point, I'll redo that part.",
    "Makes sense, thank you for clarifying.",
    "That's helpful, will try it that way.",
    "Ah okay, I was overcomplicating it.",
    "Got it, thanks for taking the time to explain.",
    "That fixed it for me too, thanks!",
    "Appreciate the quick reply!",
    "Will do, thanks again.",
]

# ============================================================================
# HELPER FUNCTIONS — TEXT GENERATION
# ============================================================================

def fill_template(template: str, subject: str, topic: str) -> str:
    return template.format(subject=subject, topic=topic)


def generate_post_content(post_type: str) -> Tuple[str, str, List[str]]:
    """Returns (title, body, tags) for a post of the given type."""
    subject = random.choice(SUBJECTS)
    topic = random.choice(TOPICS)

    title_pool, body_pool = {
        "question":     (QUESTION_TITLES, QUESTION_BODIES),
        "discussion":   (DISCUSSION_TITLES, DISCUSSION_BODIES),
        "resource":     (RESOURCE_TITLES, RESOURCE_BODIES),
        "problem":      (PROBLEM_TITLES, PROBLEM_BODIES),
        "announcement": (ANNOUNCEMENT_TITLES, ANNOUNCEMENT_BODIES),
    }[post_type]

    title = fill_template(random.choice(title_pool), subject, topic)
    body  = fill_template(random.choice(body_pool), subject, topic)

    num_tags = random.choice([0, 1, 1, 2, 2, 3])
    tags = random.sample(TAG_POOL, num_tags) if num_tags else []

    return title, body, tags


def weighted_post_type() -> str:
    types = list(config.POST_TYPE_DISTRIBUTION.keys())
    weights = list(config.POST_TYPE_DISTRIBUTION.values())
    return random.choices(types, weights=weights)[0]


def generate_comment_text(is_reply: bool, topic_hint: Optional[str] = None) -> str:
    pool = REPLY_TEMPLATES if is_reply else COMMENT_TEMPLATES
    template = random.choice(pool)
    if "{topic}" in template:
        return template.format(topic=topic_hint or random.choice(TOPICS))
    return template


# ============================================================================
# HELPER FUNCTIONS — ATTACHMENTS
# ============================================================================

IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"]
DOCUMENT_EXTENSIONS = ["pdf", "docx", "pptx", "xlsx", "txt"]
VIDEO_EXTENSIONS = ["mp4", "mov"]

ATTACHMENT_FILENAME_STEMS = [
    "lecture_notes", "homework_scan", "practice_problems", "diagram",
    "worked_solution", "study_guide", "formula_sheet", "lab_report",
    "presentation_slides", "whiteboard_photo", "graph_output", "summary_notes",
    "exam_review", "code_snippet_screenshot", "data_table",
]

CLOUDINARY_BASE = "https://res.cloudinary.com/studyhub/upload/v1700000000"


def _ext_and_type() -> Tuple[str, str]:
    """Pick a file extension and a matching resource 'type' bucket."""
    roll = random.random()
    if roll < 0.55:
        return random.choice(IMAGE_EXTENSIONS), "image"
    elif roll < 0.90:
        return random.choice(DOCUMENT_EXTENSIONS), "document"
    else:
        return random.choice(VIDEO_EXTENSIONS), "video"


def generate_attachment(seed_tag: str) -> Dict[str, str]:
    """
    Build a single attachment dict matching the shape the app already
    validates against: {"url": ..., "type": ..., "filename": ...}
    """
    ext, res_type = _ext_and_type()
    stem = random.choice(ATTACHMENT_FILENAME_STEMS)
    unique = f"{seed_tag}_{random.randint(1000, 9999)}"
    filename = f"{stem}_{unique}.{ext}"
    folder = "images" if res_type == "image" else ("videos" if res_type == "video" else "documents")
    url = f"{CLOUDINARY_BASE}/{folder}/{filename}"

    return {
        "url": url,
        "type": res_type,
        "filename": filename,
    }


def generate_attachments(seed_tag: str, max_count: int) -> List[Dict[str, str]]:
    count = random.randint(1, max_count)
    return [generate_attachment(f"{seed_tag}_{i}") for i in range(count)]


# ============================================================================
# HELPER FUNCTIONS — DATES
# ============================================================================

def random_past_datetime(max_days_ago: int, min_days_ago: int = 0) -> datetime.datetime:
    days_ago = random.randint(min_days_ago, max_days_ago)
    seconds_offset = random.randint(0, 86399)
    return (
        datetime.datetime.utcnow()
        - datetime.timedelta(days=days_ago)
        + datetime.timedelta(seconds=seconds_offset)
    )


def random_datetime_after(start: datetime.datetime, max_hours_later: int) -> datetime.datetime:
    hours_later = random.randint(0, max(1, max_hours_later))
    minutes_jitter = random.randint(0, 59)
    candidate = start + datetime.timedelta(hours=hours_later, minutes=minutes_jitter)
    now = datetime.datetime.utcnow()
    return min(candidate, now)


def weighted_comment_count() -> int:
    """Pick a comment count using the configured long-tail distribution."""
    buckets = list(config.COMMENTS_PER_POST_WEIGHTS.keys())
    weights = list(config.COMMENTS_PER_POST_WEIGHTS.values())
    bucket = random.choices(buckets, weights=weights)[0]

    if bucket == "6-10":
        return random.randint(6, 10)
    if bucket == "11-20":
        return random.randint(11, 20)
    return int(bucket)


# ============================================================================
# DATABASE PREREQUISITES
# ============================================================================

def verify_database_connection() -> bool:
    return True


def check_user_prerequisites() -> Tuple[bool, List[User]]:
    all_users = User.query.filter_by(status="approved").all()

    if len(all_users) < 3:
        logger.error(f"Insufficient users: found {len(all_users)}, need at least 3")
        print("❌ Error: Need at least 3 approved users to seed a feed")
        print("💡 Tip: Run user_seed.py first")
        return False, []

    logger.info(f"Found {len(all_users)} approved users")
    print(f"✅ Found {len(all_users)} approved users")
    return True, all_users


def clear_existing_feed_data() -> bool:
    """Clear existing feed data with confirmation. Bookmarks are NOT touched."""
    try:
        existing_count = Post.query.count()

        if existing_count > 0:
            logger.warning(f"Found {existing_count} existing posts")
            print(f"\n⚠️  Warning: {existing_count} posts already exist")
            response = input("Clear all existing feed data (posts, comments, reactions, views, follows, mentions)? (yes/no): ")

            if response.lower() != 'yes':
                logger.info("Seed aborted by user")
                print("❌ Seed aborted")
                return False

        print("🗑️  Clearing existing feed data...")
        logger.info("Clearing existing feed data...")

        # Order matters for FK safety even though most relationships cascade.
        PostEvent.query.delete()
        Mention.query.filter(Mention.mentioned_in_type.in_(["post", "comment"])).delete(synchronize_session=False)
        PostFollow.query.delete()
        CommentHelpfulMark.query.delete()
        CommentLike.query.delete()
        PostReaction.query.delete()
        PostView.query.delete()
        Comment.query.delete()
        Post.query.delete()

        db.session.commit()
        logger.info("Existing feed data cleared successfully")
        print("✅ Cleared existing data")
        return True

    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Failed to clear existing data: {e}")
        print(f"❌ Failed to clear data: {e}")
        return False


# ============================================================================
# POST CREATION
# ============================================================================

def create_post_record(author: User, index: int) -> Post:
    post_type = weighted_post_type()
    title, body, tags = generate_post_content(post_type)

    profile = StudentProfile.query.filter_by(user_id=author.id).first()
    department = profile.department if profile and profile.department else random.choice(DEPARTMENTS)

    posted_at = random_past_datetime(config.MAX_DAYS_AGO, config.MIN_DAYS_AGO)

    resources = []
    if random.random() < config.ATTACHMENT_RATE:
        resources = generate_attachments(f"post{index}", config.MAX_ATTACHMENTS_PER_POST)

    thread_enabled = random.random() < config.THREAD_ENABLED_RATE
    is_pinned = random.random() < config.PINNED_RATE
    is_locked = random.random() < config.LOCKED_RATE

    is_solvable = post_type in ("question", "problem")
    is_solved = is_solvable and random.random() < config.SOLVED_RATE
    solved_at = None
    if is_solved:
        solved_at = random_datetime_after(posted_at, max_hours_later=240)

    # Slight chance of an edit timestamp after posting
    edited_at = None
    if random.random() < 0.10:
        edited_at = random_datetime_after(posted_at, max_hours_later=72)

    post = Post(
        student_id=author.id,
        title=title,
        text_content=body,
        post_type=post_type,
        resources=resources,
        department=department,
        tags=tags,
        positive_reactions_count=0,   # filled in once reactions are seeded
        dislikes_count=0,
        views_count=0,                # filled in once views are seeded
        comments_count=0,             # filled in once comments are seeded
        bookmark_count=0,             # bookmarks intentionally skipped
        helpful_reactions_count=0,
        thread_enabled=thread_enabled,
        is_solved=is_solved,
        is_pinned=is_pinned,
        is_locked=is_locked,
        posted_at=posted_at,
        edited_at=edited_at,
        solved_at=solved_at,
    )

    logger.debug(f"Created post draft: '{title[:40]}...' by User {author.id} ({post_type})")
    return post


# ============================================================================
# MENTIONS
# ============================================================================

def maybe_create_mention(
    mentioned_in_type: str,
    mentioned_in_id: int,
    author: User,
    candidate_users: List[User],
    rate: float,
) -> Optional[Mention]:
    """Randomly mention a connected (or any) other user."""
    if random.random() >= rate or not candidate_users:
        return None

    others = [u for u in candidate_users if u.id != author.id]
    if not others:
        return None

    mentioned_user = random.choice(others)

    return Mention(
        mentioned_in_type=mentioned_in_type,
        mentioned_in_id=mentioned_in_id,
        mentioned_user_id=mentioned_user.id,
        mentioned_by_user_id=author.id,
        is_read=random.choice([True, False]),
        mentioned_at=datetime.datetime.utcnow(),
    )


# ============================================================================
# COMMENT CREATION
# ============================================================================

def create_comment_record(
    post: Post,
    author: User,
    posted_at: datetime.datetime,
    parent: Optional[Comment] = None,
) -> Comment:
    is_reply = parent is not None
    text = generate_comment_text(is_reply=is_reply)

    resources = []
    if random.random() < config.COMMENT_ATTACHMENT_RATE:
        tag = f"comment{post.id}_{author.id}_{random.randint(1, 99999)}"
        resources = generate_attachments(tag, max_count=1)

    # Top-level comments on solvable posts have a small chance of being THE solution
    is_solution = False
    if not is_reply and post.is_solved and post.post_type in ("question", "problem"):
        is_solution = random.random() < 0.15  # only a few candidate comments will actually be marked below

    comment = Comment(
        post_id=post.id,
        student_id=author.id,
        parent_id=parent.id if parent else None,
        text_content=text,
        resources=resources,
        likes_count=0,
        helpful_count=0,
        replies_count=0,
        depth_level=1 if is_reply else 0,
        is_solution=is_solution,
        is_deleted=False,
        posted_at=posted_at,
    )
    return comment


# ============================================================================
# MAIN SEED FUNCTION
# ============================================================================

def seed_feed() -> bool:
    print("🌱 Starting feed seed script...")
    logger.info(f"Starting seed process for {config.NUM_POSTS} posts")

    random.seed(config.SEED_RANDOM_STATE)

    if not verify_database_connection():
        return False

    success, all_users = check_user_prerequisites()
    if not success:
        return False

    if not clear_existing_feed_data():
        return False

    user_by_id = {u.id: u for u in all_users}

    print(f"\n📝 Creating {config.NUM_POSTS} posts...")
    logger.info(f"Creating {config.NUM_POSTS} posts")

    posts_created = 0
    posts_failed = 0
    created_posts: List[Post] = []

    # ---- PHASE 1: POSTS -----------------------------------------------
    for i in range(config.NUM_POSTS):
        try:
            author = random.choice(all_users)
            post = create_post_record(author, i)
            db.session.add(post)
            db.session.flush()  # need post.id for resources tagging consistency / mentions
            created_posts.append(post)
            posts_created += 1

            # Post-level mention (e.g. "tagging @username for visibility")
            mention = maybe_create_mention(
                mentioned_in_type="post",
                mentioned_in_id=post.id,
                author=author,
                candidate_users=all_users,
                rate=config.POST_MENTION_RATE,
            )
            if mention:
                db.session.add(mention)

            if posts_created % config.BATCH_SIZE == 0:
                db.session.commit()
                print(f"   ✓ Created {posts_created}/{config.NUM_POSTS} posts...")
                logger.info(f"Committed batch: {posts_created}/{config.NUM_POSTS} posts")

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating post {i}: {e}")
            posts_failed += 1
            continue

    db.session.commit()
    print(f"✅ Created {posts_created} posts ({posts_failed} failed)")
    logger.info(f"Posts phase complete: {posts_created} created, {posts_failed} failed")

    # ---- PHASE 2: VIEWS -------------------------------------------------
    print(f"\n👀 Seeding post views...")
    views_created = 0

    for post in created_posts:
        try:
            num_viewers = random.randint(config.MIN_VIEWS_PER_POST, config.MAX_VIEWS_PER_POST)
            candidate_viewers = [u for u in all_users if u.id != post.student_id]
            if not candidate_viewers:
                continue

            num_viewers = min(num_viewers, len(candidate_viewers))
            viewers = random.sample(candidate_viewers, num_viewers)

            seen_pairs: Set[int] = set()
            for viewer in viewers:
                if viewer.id in seen_pairs:
                    continue
                seen_pairs.add(viewer.id)

                viewed_at = random_datetime_after(
                    post.posted_at,
                    max_hours_later=config.MAX_DAYS_AGO * 24,
                )
                db.session.add(PostView(
                    user_id=viewer.id,
                    post_id=post.id,
                    viewed_at=viewed_at,
                ))
                views_created += 1

                # Occasionally the post's own author re-views it too (not counted toward dedup logic)

            post.views_count = len(seen_pairs)

            # Random follow among viewers
            for viewer_id in seen_pairs:
                if random.random() < config.FOLLOW_RATE:
                    db.session.add(PostFollow(
                        post_id=post.id,
                        student_id=viewer_id,
                        followed_at=datetime.datetime.utcnow(),
                        notify_on_comment=random.choice([True, True, False]),
                        notify_on_solution=random.choice([True, True, False]),
                    ))

            if views_created % (config.BATCH_SIZE * 10) == 0:
                db.session.commit()

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error seeding views for post {post.id}: {e}")
            continue

    db.session.commit()
    print(f"✅ Created {views_created} post views (+ follows)")
    logger.info(f"Views phase complete: {views_created} views created")

    # ---- PHASE 3: REACTIONS ---------------------------------------------
    print(f"\n❤️  Seeding post reactions...")
    reactions_created = 0

    for post in created_posts:
        try:
            candidate_reactors = [u for u in all_users if u.id != post.student_id]
            if not candidate_reactors:
                continue

            num_reactors = int(len(candidate_reactors) * config.REACTION_RATE * random.uniform(0.3, 1.4))
            num_reactors = max(0, min(num_reactors, len(candidate_reactors)))
            reactors = random.sample(candidate_reactors, num_reactors)

            positive_count = 0
            helpful_count = 0

            for reactor in reactors:
                reaction_type = random.choices(
                    config.REACTION_TYPES, weights=config.REACTION_WEIGHTS
                )[0]

                db.session.add(PostReaction(
                    post_id=post.id,
                    student_id=reactor.id,
                    reaction_type=reaction_type,
                    reacted_at=random_datetime_after(post.posted_at, max_hours_later=config.MAX_DAYS_AGO * 24),
                ))
                reactions_created += 1
                positive_count += 1
                if reaction_type == "helpful":
                    helpful_count += 1

            post.positive_reactions_count = positive_count
            post.helpful_reactions_count = helpful_count

            if reactions_created % (config.BATCH_SIZE * 10) == 0:
                db.session.commit()

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error seeding reactions for post {post.id}: {e}")
            continue

    db.session.commit()
    print(f"✅ Created {reactions_created} post reactions")
    logger.info(f"Reactions phase complete: {reactions_created} reactions created")

    # ---- PHASE 4: COMMENTS (+ replies, likes, helpful marks, mentions) ---
    print(f"\n💬 Seeding comments and replies...")
    comments_created = 0
    replies_created = 0
    comment_likes_created = 0
    comment_helpful_created = 0

    for post in created_posts:
        try:
            num_top_level = weighted_comment_count()
            if num_top_level == 0:
                continue

            candidate_commenters = [u for u in all_users if u.id != post.student_id] or all_users
            top_level_comments: List[Comment] = []
            solution_assigned = False

            for _ in range(num_top_level):
                commenter = random.choice(candidate_commenters)
                commented_at = random_datetime_after(
                    post.posted_at, max_hours_later=config.MAX_DAYS_AGO * 24
                )

                comment = create_comment_record(post, commenter, commented_at)

                # Ensure at most ONE solution comment per post
                if comment.is_solution:
                    if solution_assigned:
                        comment.is_solution = False
                    else:
                        solution_assigned = True

                db.session.add(comment)
                db.session.flush()
                top_level_comments.append(comment)
                comments_created += 1

                # Comment-level mention
                mention = maybe_create_mention(
                    mentioned_in_type="comment",
                    mentioned_in_id=comment.id,
                    author=commenter,
                    candidate_users=all_users,
                    rate=config.COMMENT_MENTION_RATE,
                )
                if mention:
                    db.session.add(mention)

                # Likes on this comment
                like_candidates = [u for u in all_users if u.id != commenter.id]
                num_likers = int(len(like_candidates) * config.COMMENT_LIKE_RATE * random.uniform(0.2, 1.5))
                num_likers = max(0, min(num_likers, len(like_candidates)))
                likers = random.sample(like_candidates, num_likers) if num_likers else []

                for liker in likers:
                    db.session.add(CommentLike(
                        comment_id=comment.id,
                        student_id=liker.id,
                        liked_at=random_datetime_after(commented_at, max_hours_later=72),
                    ))
                    comment_likes_created += 1
                comment.likes_count = len(likers)

                # Helpful marks (only meaningful on question/problem posts)
                helpful_count_for_comment = 0
                if post.post_type in ("question", "problem") and random.random() < config.COMMENT_HELPFUL_RATE:
                    helpful_candidates = [u for u in all_users if u.id != commenter.id]
                    num_helpful = random.randint(1, min(4, len(helpful_candidates))) if helpful_candidates else 0
                    helpful_markers = random.sample(helpful_candidates, num_helpful) if num_helpful else []

                    for marker in helpful_markers:
                        db.session.add(CommentHelpfulMark(
                            comment_id=comment.id,
                            user_id=marker.id,
                            marked_at=random_datetime_after(commented_at, max_hours_later=72),
                        ))
                        comment_helpful_created += 1
                    helpful_count_for_comment = len(helpful_markers)
                comment.helpful_count = helpful_count_for_comment

                # Replies (depth_level = 1 only, per app's enforced max depth)
                num_replies = 0
                if random.random() < config.REPLY_RATE:
                    num_replies = random.randint(1, config.MAX_REPLIES_PER_COMMENT)

                for _ in range(num_replies):
                    replier = random.choice(candidate_commenters)
                    replied_at = random_datetime_after(commented_at, max_hours_later=96)

                    reply = create_comment_record(post, replier, replied_at, parent=comment)
                    reply.is_solution = False  # only top-level comments can be marked solution here
                    db.session.add(reply)
                    db.session.flush()
                    replies_created += 1

                    reply_like_candidates = [u for u in all_users if u.id != replier.id]
                    num_reply_likers = int(len(reply_like_candidates) * config.COMMENT_LIKE_RATE * random.uniform(0.1, 1.0))
                    num_reply_likers = max(0, min(num_reply_likers, len(reply_like_candidates)))
                    reply_likers = random.sample(reply_like_candidates, num_reply_likers) if num_reply_likers else []

                    for liker in reply_likers:
                        db.session.add(CommentLike(
                            comment_id=reply.id,
                            student_id=liker.id,
                            liked_at=random_datetime_after(replied_at, max_hours_later=48),
                        ))
                        comment_likes_created += 1
                    reply.likes_count = len(reply_likers)

                comment.replies_count = num_replies

            post.comments_count = len(top_level_comments) + sum(c.replies_count for c in top_level_comments)

            if comments_created % (config.BATCH_SIZE * 5) == 0:
                db.session.commit()
                print(f"   ✓ {comments_created} comments / {replies_created} replies so far...")

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error seeding comments for post {post.id}: {e}")
            continue

    db.session.commit()
    print(f"✅ Created {comments_created} top-level comments + {replies_created} replies")
    print(f"✅ Created {comment_likes_created} comment likes, {comment_helpful_created} helpful marks")
    logger.info(
        f"Comments phase complete: {comments_created} comments, {replies_created} replies, "
        f"{comment_likes_created} likes, {comment_helpful_created} helpful marks"
    )

    # ---- FINAL COMMIT -----------------------------------------------------
    try:
        db.session.commit()
        logger.info("Final commit successful")
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Final commit failed: {e}")
        print(f"❌ Final commit failed: {e}")
        return False

    print_summary_statistics()
    return True


# ============================================================================
# SUMMARY
# ============================================================================

def print_summary_statistics():
    print("\n" + "=" * 60)
    print("📊 FEED SEED SUMMARY")
    print("=" * 60)

    total_posts = Post.query.count()
    total_comments = Comment.query.filter(Comment.depth_level == 0).count()
    total_replies = Comment.query.filter(Comment.depth_level == 1).count()
    total_views = PostView.query.count()
    total_reactions = PostReaction.query.count()
    total_comment_likes = CommentLike.query.count()
    total_helpful_marks = CommentHelpfulMark.query.count()
    total_follows = PostFollow.query.count()
    total_mentions = Mention.query.count()

    posts_with_attachments = Post.query.filter(Post.resources.isnot(None)).count()
    # Note: resources defaults to None/empty list; count posts where the list is non-empty
    posts_with_attachments = sum(1 for p in Post.query.all() if p.resources)

    print(f"Total Posts:          {total_posts}")
    print(f"  ├─ with attachments: {posts_with_attachments} ({(posts_with_attachments/total_posts*100 if total_posts else 0):.1f}%)")
    print(f"  ├─ solved:           {Post.query.filter_by(is_solved=True).count()}")
    print(f"  ├─ pinned:           {Post.query.filter_by(is_pinned=True).count()}")
    print(f"  └─ locked:           {Post.query.filter_by(is_locked=True).count()}")

    print(f"\nTotal Comments (top-level): {total_comments}")
    print(f"Total Replies (depth 1):    {total_replies}")
    print(f"Total Post Views:           {total_views}")
    print(f"Total Post Reactions:       {total_reactions}")
    print(f"Total Comment Likes:        {total_comment_likes}")
    print(f"Total Helpful Marks:        {total_helpful_marks}")
    print(f"Total Post Follows:         {total_follows}")
    print(f"Total Mentions:             {total_mentions}")

    print(f"\n📋 Post Type Distribution:")
    for ptype in config.POST_TYPE_DISTRIBUTION.keys():
        count = Post.query.filter_by(post_type=ptype).count()
        pct = (count / total_posts * 100) if total_posts else 0
        print(f"  {ptype.capitalize():14s}: {count} ({pct:.1f}%)")

    print(f"\n📂 Department Distribution (top 5):")
    dept_counts: Dict[str, int] = {}
    for p in Post.query.all():
        dept_counts[p.department] = dept_counts.get(p.department, 0) + 1
    for dept, count in sorted(dept_counts.items(), key=lambda x: -x[1])[:5]:
        print(f"  {dept:25s}: {count}")

    print("\n" + "=" * 60)
    print("✨ Feed seed complete! (Bookmarks intentionally skipped)")
    print("=" * 60 + "\n")

    logger.info("Summary statistics printed successfully")


# ============================================================================
# STANDALONE EXECUTION
# ============================================================================

if __name__ == "__main__":
    from app import app

    with app.app_context():
        success = seed_feed()

        if success:
            logger.info("Feed seed script completed successfully")
            exit(0)
        else:
            logger.error("Feed seed script failed")
            exit(1)
