from pydantic import BaseModel
from typing import List


class ShopOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class ShopsListOut(BaseModel):
    data: List[ShopOut]
    total: int
