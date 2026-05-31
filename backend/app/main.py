import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, SessionLocal, Base
import app.models  # noqa: F401 — ensures all ORM classes are registered

from app.routers import shops, technicians, work_orders, shifts, lookups, tasks, notes, parts, assets

_default_origins = "http://localhost:5173,http://localhost:3000"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_if_empty()
    yield


def _seed_if_empty():
    from app.models.shop import Shop
    db = SessionLocal()
    try:
        if db.query(Shop).count() == 0:
            from app.seed import seed_database
            seed_database(db)
    except Exception:
        db.rollback()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        from app.seed import seed_database
        db2 = SessionLocal()
        try:
            seed_database(db2)
        finally:
            db2.close()
    finally:
        db.close()


app = FastAPI(title="Technician App API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shops.router, prefix="/api")
app.include_router(technicians.router, prefix="/api")
app.include_router(work_orders.router, prefix="/api")
app.include_router(shifts.router, prefix="/api")
app.include_router(lookups.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(parts.router, prefix="/api")
app.include_router(assets.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
