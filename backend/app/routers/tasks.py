from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.work_order import Task
from app.schemas.work_order import TaskListResponse, TaskStepOut, TaskUpdateIn

router = APIRouter(tags=["tasks"])

RESULT_NAMES_BY_ID = {
    1: "Replace",
    2: "Adjusted",
    3: "Completed",
    4: "N/A",
}

RESULT_NAME_ALIASES = {
    "replace": "Replace",
    "replaced": "Replace",
    "adjust": "Adjusted",
    "adjusted": "Adjusted",
    "complete": "Completed",
    "completed": "Completed",
    "na": "N/A",
    "n/a": "N/A",
    "not applicable": "N/A",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolution_name(result_id: int | None, result_name: str | None) -> str | None:
    if result_name:
        normalized = result_name.strip().lower().replace(".", "")
        return RESULT_NAME_ALIASES.get(normalized, result_name)
    if result_id is not None:
        return RESULT_NAMES_BY_ID.get(result_id)
    return None


def _task_to_step(task: Task) -> TaskStepOut:
    return TaskStepOut(
        stepNumber=task.step_number,
        taskName=task.task_name,
        resultName=_resolution_name(task.result_id, task.result_name),
        comment=task.comment or "",
        instruction=task.instruction,
        repairTaskID=task.id,
        hasInstruction=bool(task.has_instruction),
    )


@router.get("/tasks/{repair_id}", response_model=TaskListResponse)
def get_tasks_for_repair(repair_id: int, db: Session = Depends(get_db)):
    tasks = (
        db.query(Task)
        .filter(Task.repair_id == repair_id)
        .order_by(Task.step_number)
        .all()
    )
    return TaskListResponse(
        success=True,
        data=[_task_to_step(t) for t in tasks],
        message=None,
        errors=None,
        timestamp=_now_iso(),
    )


@router.put("/task/{task_id}", response_model=TaskListResponse)
def update_task(task_id: int, payload: TaskUpdateIn, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    fields_set = payload.model_fields_set
    if "stepNumber" in fields_set:
        task.step_number = payload.stepNumber
    if "resultId" in fields_set:
        task.result_id = payload.resultId
        task.result_name = RESULT_NAMES_BY_ID.get(payload.resultId) if payload.resultId is not None else None
    if "comment" in fields_set:
        task.comment = payload.comment
    db.commit()
    db.refresh(task)
    return TaskListResponse(
        success=True,
        data=[_task_to_step(task)],
        message=None,
        errors=None,
        timestamp=_now_iso(),
    )
