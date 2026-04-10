from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
from backend.websocket_manager import ws_manager
from backend.scheduler import setup_scheduler, scheduler
from backend.routes import stocks, samples, alerts, notifications, export, schedules
import os


def _seed_default_schedules() -> None:
    """Insert the 3 default ET market schedules if the table is empty."""
    from backend.models import ScheduledJob
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        if db.query(ScheduledJob).count() == 0:
            defaults = [
                ScheduledJob(label="Market Open",  sample_type="open",  hour=13, minute=30),
                ScheduledJob(label="Midday",        sample_type="mid",   hour=16, minute=0),
                ScheduledJob(label="Market Close",  sample_type="close", hour=20, minute=0),
            ]
            db.add_all(defaults)
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_default_schedules()
    setup_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Stock Sampler Bot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(samples.router)
app.include_router(alerts.router)
app.include_router(notifications.router)
app.include_router(export.router)
app.include_router(schedules.router)


@app.websocket("/appws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
