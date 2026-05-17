from sqlalchemy.orm import Session

from app.models.work_order import WorkOrderRepair


class RepairNotFoundError(Exception):
    pass


def update_status(db: Session, repair_id: int, status_code: str) -> WorkOrderRepair:
    """Update the status code of a repair. Raises RepairNotFoundError if not found."""
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
    if not repair:
        raise RepairNotFoundError(f"Repair {repair_id} not found")
    repair.wo_status_code = status_code
    if status_code.upper() in ("C", "X"):
        repair.is_open = False
    elif status_code.upper() == "A":
        repair.is_open = True
    db.commit()
    return repair


def set_reason(db: Session, repair_id: int, reason_id: int) -> WorkOrderRepair:
    """Set the repair reason on a work order repair. Raises RepairNotFoundError if not found."""
    repair = db.query(WorkOrderRepair).filter(WorkOrderRepair.id == repair_id).first()
    if not repair:
        raise RepairNotFoundError(f"Repair {repair_id} not found")
    repair.reason_id = reason_id
    db.commit()
    return repair
