from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.database import SessionLocal
from backend.sampler import run_sample
from backend.alert_engine import evaluate_alerts
from backend.websocket_manager import ws_manager
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _run_scheduled_sample(sample_type: str) -> None:
    logger.info(f"Running scheduled '{sample_type}' sample")
    db = SessionLocal()
    try:
        samples = run_sample(db, sample_type)
        notifications = evaluate_alerts(db, samples)
        await ws_manager.broadcast("sample_complete", {
            "sample_type": sample_type,
            "count": len(samples),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        for n in notifications:
            await ws_manager.broadcast("alert_triggered", {
                "message": n.message,
                "stock_id": n.stock_id,
                "triggered_at": n.triggered_at.isoformat() if n.triggered_at else None,
            })
        logger.info(f"Completed '{sample_type}': {len(samples)} stocks, {len(notifications)} alerts")
    except Exception as e:
        logger.error(f"Scheduled sample '{sample_type}' failed: {e}")
    finally:
        db.close()


def _job_id(db_id: int) -> str:
    return f"scheduled_job_{db_id}"


def add_job(db_id: int, hour: int, minute: int, sample_type: str) -> None:
    jid = _job_id(db_id)
    if scheduler.get_job(jid):
        scheduler.remove_job(jid)
    scheduler.add_job(
        _run_scheduled_sample,
        CronTrigger(hour=hour, minute=minute, timezone="UTC"),
        args=[sample_type],
        id=jid,
        replace_existing=True,
    )
    logger.info(f"Scheduled job {jid}: {sample_type} at {hour:02d}:{minute:02d} UTC")


def remove_job(db_id: int) -> None:
    jid = _job_id(db_id)
    if scheduler.get_job(jid):
        scheduler.remove_job(jid)
        logger.info(f"Removed job {jid}")


def setup_scheduler() -> None:
    """Load all enabled jobs from DB and start the scheduler."""
    from backend.models import ScheduledJob
    db = SessionLocal()
    try:
        jobs = db.query(ScheduledJob).filter(ScheduledJob.enabled == True).all()
        for job in jobs:
            add_job(job.id, job.hour, job.minute, job.sample_type)
        logger.info(f"Scheduler started with {len(jobs)} job(s)")
    finally:
        db.close()
    scheduler.start()
