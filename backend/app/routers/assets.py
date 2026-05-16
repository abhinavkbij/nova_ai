from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database import get_db
from app.models.asset import Asset
from app.models.work_order import WorkOrder

router = APIRouter(tags=["assets"])

WO_STATUS_MAP = {
    "A": "Active - Repair in Progress [A]",
    "C": "Closed",
    "H": "On Hold",
    "W": "Waiting Parts",
    "R": "Return to Shop",
}


def _utc_timestamp():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _envelope(data, message="OK"):
    return {"success": True, "data": data, "message": message, "errors": None, "timestamp": _utc_timestamp()}


@router.get("/assets/verify")
def verify_asset(
    assetNumber: str = Query(...),
    orgId: int = Query(...),
    db: Session = Depends(get_db),
):
    asset = db.query(Asset).filter(Asset.asset_number == assetNumber).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found. Please check the asset number and try again.")

    open_wos = (
        db.query(WorkOrder)
        .filter(WorkOrder.asset_number == assetNumber, WorkOrder.status_code != "C")
        .order_by(WorkOrder.date_in.desc())
        .all()
    )

    org_name = asset.org.name if asset.org else ""

    return _envelope(
        {
            "id": asset.id,
            "assetNumber": asset.asset_number,
            "organization": org_name,
            "orgId": asset.org_id,
            "year": asset.year,
            "make": asset.make,
            "model": asset.model,
            "vin": asset.vin,
            "license": asset.license,
            "status": asset.status,
            "totalPointValue": asset.total_point_value,
            "originalReplacementDate": asset.original_replacement_date,
            "pointScaleUsed": asset.point_scale_used,
            "meterReading": asset.meter_reading or 0,
            "openWorkOrders": [
                {
                    "documentNumber": wo.wo_number,
                    "dateIn": wo.date_in.isoformat() if wo.date_in else None,
                    "dateOut": None,
                    "statusCode": wo.status_code,
                    "statusDesc": WO_STATUS_MAP.get(wo.status_code, wo.status_code),
                }
                for wo in open_wos
            ],
        },
        "Asset verified successfully",
    )
