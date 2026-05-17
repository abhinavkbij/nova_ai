from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import nova

app = FastAPI(title="Nova AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nova.router, prefix="/api/nova")


@app.get("/health")
def health():
    return {"status": "ok"}
