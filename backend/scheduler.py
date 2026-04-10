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


async def _run_scheduled_sample(sample_type: str):
    logger.info(f"Running scheduled {sample_type} sample")
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
        logger.info(f"Completed {sample_type}: {len(samples)} stocks, {len(notifications)} alerts")
    except Exception as e:
        logger.error(f"Scheduled sample {sample_type} failed: {e}")
    finally:
        db.close()


def setup_scheduler():
    # 9:30 AM ET = 13:30 UTC
    scheduler.add_job(
        _run_scheduled_sample, CronTrigger(hour=13, minute=30, timezone="UTC"),
        args=["open"], id="sample_open", replace_existing=True,
    )
    # 12:00 PM ET = 16:00 UTC
    scheduler.add_job(
        _run_scheduled_sample, CronTrigger(hour=16, minute=0, timezone="UTC"),
        args=["mid"], id="sample_mid", replace_existing=True,
    )
    # 4:00 PM ET = 20:00 UTC
    scheduler.add_job(
        _run_scheduled_sample, CronTrigger(hour=20, minute=0, timezone="UTC"),
        args=["close"], id="sample_close", replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started with 3 daily sample jobs")
