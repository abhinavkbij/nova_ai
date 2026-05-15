from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.lookup import WorkOrderStatus, RepairReason
from app.schemas.lookup import WorkOrderStatusOut, RepairReasonOut

router = APIRouter(prefix="/LookUps", tags=["lookups"])


@router.get("/WorkOrderStatus", response_model=List[WorkOrderStatusOut])
def get_wo_statuses(db: Session = Depends(get_db)):
    return db.query(WorkOrderStatus).order_by(WorkOrderStatus.id).all()


@router.get("/RepairReasons", response_model=List[RepairReasonOut])
def get_repair_reasons(db: Session = Depends(get_db)):
    return db.query(RepairReason).order_by(RepairReason.id).all()
