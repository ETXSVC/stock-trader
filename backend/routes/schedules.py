from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import ScheduledJob
from backend.schemas import ScheduledJobCreate, ScheduledJobUpdate, ScheduledJobResponse
import backend.scheduler as sched

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduledJobResponse])
def list_jobs(db: Session = Depends(get_db)):
    return db.query(ScheduledJob).order_by(ScheduledJob.hour, ScheduledJob.minute).all()


@router.post("", response_model=ScheduledJobResponse)
def create_job(body: ScheduledJobCreate, db: Session = Depends(get_db)):
    if not (0 <= body.hour <= 23):
        raise HTTPException(status_code=400, detail="hour must be 0-23")
    if not (0 <= body.minute <= 59):
        raise HTTPException(status_code=400, detail="minute must be 0-59")
    job = ScheduledJob(
        label=body.label,
        sample_type=body.sample_type,
        hour=body.hour,
        minute=body.minute,
        enabled=True,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    sched.add_job(job.id, job.hour, job.minute, job.sample_type)
    return job


@router.put("/{job_id}", response_model=ScheduledJobResponse)
def update_job(job_id: int, body: ScheduledJobUpdate, db: Session = Depends(get_db)):
    job = db.get(ScheduledJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    if job.enabled:
        sched.add_job(job.id, job.hour, job.minute, job.sample_type)
    else:
        sched.remove_job(job.id)
    return job


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(ScheduledJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    sched.remove_job(job.id)
    db.delete(job)
    db.commit()
    return {"detail": "deleted"}
