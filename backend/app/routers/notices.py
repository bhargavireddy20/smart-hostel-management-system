
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notice
from app.routers.auth import require_admin
from app.routers.students import get_current_student

router = APIRouter(prefix="/notices", tags=["Notices"])


class NoticeCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    content: str = Field(min_length=1)
    audience: str = Field(default="All Students", max_length=30)
    priority: str = Field(default="Normal", max_length=20)
    publish_at: datetime | None = None
    expires_at: datetime | None = None


class NoticeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    audience: str
    priority: str
    publish_at: datetime | None
    expires_at: datetime | None
    is_active: bool
    created_at: datetime


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def is_visible_to_students(notice: Notice, now: datetime) -> bool:
    if not notice.is_active:
        return False

    audience = (notice.audience or "").strip().lower()

    if audience not in {"all students", "students"}:
        return False

    if notice.publish_at:
        if normalize_datetime(notice.publish_at) > now:
            return False

    if notice.expires_at:
        if normalize_datetime(notice.expires_at) <= now:
            return False

    return True


# ADMIN: View all notices
@router.get("/", response_model=list[NoticeResponse])
def get_notices(
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    return (
        db.query(Notice)
        .order_by(Notice.created_at.desc())
        .all()
    )


# STUDENT: View notices intended for students
@router.get("/me", response_model=list[NoticeResponse])
def get_student_notices(
    db: Session = Depends(get_db),
    student=Depends(get_current_student),
):
    now = datetime.now(timezone.utc)

    notices = (
        db.query(Notice)
        .order_by(Notice.created_at.desc())
        .all()
    )

    return [
        notice
        for notice in notices
        if is_visible_to_students(notice, now)
    ]


# ADMIN: Create notice
@router.post(
    "/",
    response_model=NoticeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_notice(
    notice_data: NoticeCreate,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    if (
        notice_data.publish_at
        and notice_data.expires_at
        and normalize_datetime(notice_data.expires_at)
        <= normalize_datetime(notice_data.publish_at)
    ):
        raise HTTPException(
            status_code=400,
            detail="Expiry must be later than the publish date.",
        )

    notice = Notice(
        title=notice_data.title.strip(),
        content=notice_data.content.strip(),
        audience=notice_data.audience.strip(),
        priority=notice_data.priority.strip(),
        publish_at=notice_data.publish_at,
        expires_at=notice_data.expires_at,
        is_active=True,
    )

    db.add(notice)
    db.commit()
    db.refresh(notice)

    return notice


# ADMIN: View one notice
@router.get("/{notice_id}", response_model=NoticeResponse)
def get_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    notice = db.query(Notice).filter(
        Notice.id == notice_id
    ).first()

    if not notice:
        raise HTTPException(
            status_code=404,
            detail="Notice not found.",
        )

    return notice


# ADMIN: Deactivate notice
@router.patch("/{notice_id}/deactivate")
def deactivate_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    notice = db.query(Notice).filter(
        Notice.id == notice_id
    ).first()

    if not notice:
        raise HTTPException(
            status_code=404,
            detail="Notice not found.",
        )

    notice.is_active = False
    db.commit()
    db.refresh(notice)

    return {
        "message": "Notice deactivated successfully.",
        "id": notice.id,
        "is_active": notice.is_active,
    }
