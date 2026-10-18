
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from routers.courses import router as courses_router
from config import settings
from database import get_db, initialize_database
from routers.auth import router as auth_router
from routers.assignments import router as assignments_router
from routers.attendance import router as attendance_router
from routers.notifications import router as notifications_router
from routers.announcements import router as announcements_router
from routers.discussions import router as discussions_router
from routers.marks import router as marks_router
from routers.analytics import router as analytics_router
from routers.calendar import router as calendar_router
from routers.doubts import router as doubts_router
from routers.ai import router as ai_router

initialize_database()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="ClassPilot classroom management API",
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(assignments_router)
app.include_router(attendance_router)
app.include_router(notifications_router)
app.include_router(announcements_router)
app.include_router(discussions_router)
app.include_router(marks_router)
app.include_router(analytics_router)
app.include_router(calendar_router)
app.include_router(doubts_router)
app.include_router(ai_router)

@app.get("/", tags=["System"])
def root():
    return {
        "message": "Welcome to ClassPilot API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "classpilot-api"}


@app.get("/health/database", tags=["System"])
def database_health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed.",
        ) from None
