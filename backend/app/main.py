from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine
from app.routers.students import router as students_router
from app.routers.rooms import router as rooms_router
from app.routers.fees import router as fees_router
from app.routers.complaints import router as complaints_router
from app.routers.notices import router as notices_router
from app.routers import attendance
from app.routers.auth import router as auth_router

app = FastAPI(
    title="SmartStay API",
    description="Smart Hostel Management System backend",
    version="1.0.0",
)
app.include_router(rooms_router)
app.include_router(fees_router)
app.include_router(complaints_router)
app.include_router(notices_router)
app.include_router(attendance.router)
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Welcome to SmartStay API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except Exception:
        return {
            "status": "unhealthy",
            "database": "disconnected",
        }


app.include_router(students_router)
