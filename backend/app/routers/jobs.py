from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app.database import get_db
from app.models.job import Job, JobStatus
from app.models.technician import Technician
from app.schemas.job import JobCreate, JobUpdate, JobOut

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/", response_model=List[JobOut])
def list_jobs(
    status: Optional[JobStatus] = Query(None),
    technician_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Job).options(joinedload(Job.technician))
    if status:
        query = query.filter(Job.status == status)
    if technician_id:
        query = query.filter(Job.technician_id == technician_id)
    return query.order_by(Job.created_at.desc()).all()


@router.post("/", response_model=JobOut, status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    if payload.technician_id:
        tech = db.query(Technician).filter(Technician.id == payload.technician_id).first()
        if not tech:
            raise HTTPException(status_code=404, detail="Technician not found")
    job = Job(**payload.model_dump())
    if payload.technician_id:
        job.status = JobStatus.ASSIGNED
    db.add(job)
    db.commit()
    db.refresh(job)
    return db.query(Job).options(joinedload(Job.technician)).filter(Job.id == job.id).first()


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).options(joinedload(Job.technician)).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=JobOut)
def update_job(job_id: int, payload: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    updates = payload.model_dump(exclude_unset=True)
    if "technician_id" in updates and updates["technician_id"]:
        tech = db.query(Technician).filter(Technician.id == updates["technician_id"]).first()
        if not tech:
            raise HTTPException(status_code=404, detail="Technician not found")
        if job.status == JobStatus.PENDING:
            job.status = JobStatus.ASSIGNED
    for field, value in updates.items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return db.query(Job).options(joinedload(Job.technician)).filter(Job.id == job_id).first()


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
