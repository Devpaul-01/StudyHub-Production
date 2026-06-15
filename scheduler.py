"""
StudyHub – Background Scheduler
════════════════════════════════════════════════════════════════════════════════

Uses APScheduler's BackgroundScheduler.

⚠️  EVENTLET COMPATIBILITY NOTE:
     This app runs socketio with eventlet, which monkey-patches the stdlib
     (including threading). BackgroundScheduler uses ThreadPoolExecutor which
     runs on eventlet green threads after monkey-patching — this is safe and
     intentional. Do NOT use GeventScheduler or AsyncIOScheduler here.

     use_reloader=False is already set in socketio.run(), so the scheduler
     will never double-start. atexit handles clean shutdown.

Install dependency:
    pip install apscheduler

Jobs registered here:
    • weekly_leaderboard_snapshot  – every Sunday 00:05 UTC
    • monthly_leaderboard_snapshot – 1st of every month 00:10 UTC
"""

import atexit
import datetime
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

logger = logging.getLogger(__name__)

# Module-level scheduler instance (single shared instance across the app)
scheduler = BackgroundScheduler(
    job_defaults={
        "coalesce":           True,   # merge missed runs into one
        "max_instances":      1,      # never run the same job twice concurrently
        "misfire_grace_time": 3600,   # fire up to 1h late if server was down
    },
    timezone="UTC",
)


# ─────────────────────────────────────────────────────────────────────────────
# CORE JOB: Leaderboard Snapshot
# ─────────────────────────────────────────────────────────────────────────────

def _take_snapshot(app, snapshot_type: str = "weekly") -> dict:
    """
    Core snapshot logic — called by both scheduled jobs and the manual
    POST /leaderboard/snapshot admin endpoint.

    Runs inside an explicit app context so SQLAlchemy works correctly from
    a background thread.

    Returns a summary dict: {"created": N, "skipped": bool, "users_ranked": N}
    """
    with app.app_context():
        from extensions import db
        from models import User, StudentProfile, LeaderboardSnapshot
        from sqlalchemy import desc, asc, func

        now = datetime.datetime.utcnow()

        # ── Guard: one snapshot per type per day ──────────────────────────────
        already_ran = (
            db.session.query(LeaderboardSnapshot)
            .filter(
                LeaderboardSnapshot.snapshot_type == snapshot_type,
                func.date(LeaderboardSnapshot.created_at) == now.date(),
            )
            .first()
        )
        if already_ran:
            logger.info(
                "[Scheduler] %s snapshot already exists for %s — skipping",
                snapshot_type, now.date(),
            )
            return {"created": 0, "skipped": True, "users_ranked": 0}

        try:
            # ── 1. Global all-time rankings (order by reputation DESC) ─────────
            ranked = (
                db.session.query(User.id, User.reputation)
                .filter(User.status == "approved")
                .order_by(desc(User.reputation), asc(User.id))
                .all()
            )

            if not ranked:
                logger.warning("[Scheduler] No approved users found — snapshot skipped")
                return {"created": 0, "skipped": True, "users_ranked": 0}

            # ── 2. Department ranks in a single pass ──────────────────────────
            dept_rows = (
                db.session.query(User.id, StudentProfile.department)
                .join(StudentProfile, StudentProfile.user_id == User.id)
                .filter(
                    User.status == "approved",
                    StudentProfile.department.isnot(None),
                )
                .order_by(
                    StudentProfile.department,
                    desc(User.reputation),
                    asc(User.id),
                )
                .all()
            )

            dept_rank_map: dict[int, int] = {}
            dept_counters: dict[str, int] = {}
            for uid, dept in dept_rows:
                dept_counters[dept] = dept_counters.get(dept, 0) + 1
                dept_rank_map[uid] = dept_counters[dept]

            # ── 3. Bulk-insert snapshots ──────────────────────────────────────
            snapshots = [
                LeaderboardSnapshot(
                    user_id=uid,
                    snapshot_type=snapshot_type,
                    global_rank=global_rank,
                    department_rank=dept_rank_map.get(uid),
                    score=reputation,
                    created_at=now,
                )
                for global_rank, (uid, reputation) in enumerate(ranked, start=1)
            ]

            db.session.bulk_save_objects(snapshots)
            db.session.commit()

            n = len(snapshots)
            logger.info(
                "[Scheduler] ✅ %s snapshot done — %d users ranked at %s",
                snapshot_type, n, now.isoformat(),
            )
            return {"created": n, "skipped": False, "users_ranked": n}

        except Exception as exc:
            db.session.rollback()
            logger.error("[Scheduler] ❌ %s snapshot failed: %s", snapshot_type, exc)
            raise  # re-raise so APScheduler marks the job as errored


# ─────────────────────────────────────────────────────────────────────────────
# JOB WRAPPERS  (APScheduler calls these — they receive the app via closure)
# ─────────────────────────────────────────────────────────────────────────────

def _job_weekly(app):
    logger.info("[Scheduler] ▶ Running weekly leaderboard snapshot job")
    _take_snapshot(app, "weekly")


def _job_monthly(app):
    logger.info("[Scheduler] ▶ Running monthly leaderboard snapshot job")
    _take_snapshot(app, "monthly")


# ─────────────────────────────────────────────────────────────────────────────
# EVENT LISTENER  (logs job outcomes to your existing logger)
# ─────────────────────────────────────────────────────────────────────────────

def _job_listener(event):
    if event.exception:
        logger.error(
            "[Scheduler] Job '%s' raised an exception: %s",
            event.job_id, event.exception,
        )
    else:
        logger.info(
            "[Scheduler] Job '%s' completed successfully (retval=%s)",
            event.job_id, event.retval,
        )


# ─────────────────────────────────────────────────────────────────────────────
# INIT  (called from create_app())
# ─────────────────────────────────────────────────────────────────────────────

def init_scheduler(app) -> None:
    """
    Wire APScheduler into the Flask app.

    Call this ONCE at the end of create_app(), after all extensions and
    blueprints are registered.  Safe to call in production and dev alike
    because use_reloader=False prevents double-invocation.

    Schedule (UTC):
        Weekly snapshot  – every Sunday at 00:05
        Monthly snapshot – 1st of every month at 00:10
    """
    if scheduler.running:
        logger.warning("[Scheduler] Already running — init_scheduler called twice, skipping")
        return

    # Register event listener
    scheduler.add_listener(_job_listener, EVENT_JOB_ERROR | EVENT_JOB_EXECUTED)

    # ── Weekly job: every Sunday at 00:05 UTC ─────────────────────────────────
    scheduler.add_job(
        func=_job_weekly,
        args=[app],
        trigger=CronTrigger(day_of_week="sun", hour=0, minute=5, timezone="UTC"),
        id="weekly_leaderboard_snapshot",
        name="Weekly Leaderboard Snapshot",
        replace_existing=True,
    )

    # ── Monthly job: 1st of month at 00:10 UTC ────────────────────────────────
    scheduler.add_job(
        func=_job_monthly,
        args=[app],
        trigger=CronTrigger(day=1, hour=0, minute=10, timezone="UTC"),
        id="monthly_leaderboard_snapshot",
        name="Monthly Leaderboard Snapshot",
        replace_existing=True,
    )

    scheduler.start()

    # Graceful shutdown when the Python process exits (Gunicorn SIGTERM, etc.)
    atexit.register(lambda: _shutdown_scheduler())

    # Log next run times for confirmation
    for job in scheduler.get_jobs():
        logger.info(
            "[Scheduler] ✅ Registered '%s' — next run: %s",
            job.name,
            job.next_run_time,
        )

    app.logger.info("[Scheduler] APScheduler started with %d job(s)", len(scheduler.get_jobs()))


def _shutdown_scheduler() -> None:
    """Gracefully stop the scheduler on process exit."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Shut down cleanly")
