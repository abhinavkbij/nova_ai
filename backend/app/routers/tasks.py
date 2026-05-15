from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.work_order import Task
from app.schemas.work_order import TaskOut, TaskUpdateIn

router = APIRouter(prefix="/task", tags=["tasks"])


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskOut(
        id=task.id,
        repairId=task.repair_id,
        stepNumber=task.step_number,
        resultId=task.result_id,
        comment=task.comment,
        title=task.title,
    )


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdateIn, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if payload.stepNumber is not None:
        task.step_number = payload.stepNumber
    if payload.resultId is not None:
        task.result_id = payload.resultId
    if payload.comment is not None:
        task.comment = payload.comment
    db.commit()
    db.refresh(task)
    return TaskOut(
        id=task.id,
        repairId=task.repair_id,
        stepNumber=task.step_number,
        resultId=task.result_id,
        comment=task.comment,
        title=task.title,
    )
