from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.shop import Shop
from app.schemas.shop import ShopOut

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get("", response_model=List[ShopOut])
def get_shops(db: Session = Depends(get_db)):
    return db.query(Shop).order_by(Shop.name).all()
