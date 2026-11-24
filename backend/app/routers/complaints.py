from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Complaint, Student, RoomAssignment, Room
from app.routers.students import get_current_student
from app.routers.auth import require_admin

router = APIRouter(prefix="/complaints", tags=["Complaints"])

ComplaintStatus = Literal["Open", "In Progress", "Resolved"]
ComplaintPriority = Literal["Low", "Medium", "High"]


# SCHEMAS

class ComplaintCreate(BaseModel):
    student_id: str = Field(min_length=1, max_length=30)
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=2000)
    category: str = Field(min_length=1, max_length=50)
    priority: ComplaintPriority = "Medium"


class StudentComplaintCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str = Field(min_length=1, max_length=2000)
    category: str = Field(min_length=1, max_length=50)
    priority: ComplaintPriority = "Medium"


class ComplaintUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    priority: ComplaintPriority | None = None
    status: ComplaintStatus | None = None


# SERIALIZATION

def serialize_complaint(db: Session, complaint: Complaint) -> dict:
    student = db.get(Student, complaint.student_pk)

    assignment = db.scalar(
        select(RoomAssignment)
        .where(
            RoomAssignment.student_pk == complaint.student_pk,
            RoomAssignment.end_date.is_(None),
        )
        .order_by(RoomAssignment.start_date.desc())
        .limit(1)
    )

    room = db.get(Room, assignment.room_pk) if assignment else None

    return {
        "id": complaint.id,
        "complaint_number": complaint.complaint_number,
        "student_id": student.student_id if student else None,
        "student": student.full_name if student else "Unknown student",
        "room": room.room_number if room else "Unassigned",
        "title": complaint.title,
        "description": complaint.description,
        "category": complaint.category,
        "priority": complaint.priority,
        "status": complaint.status,
        "date": complaint.created_at.date().isoformat(),
        "created_at": complaint.created_at.isoformat(),
        "updated_at": complaint.updated_at.isoformat(),
    }


# CREATE COMPLAINT HELPER

def save_complaint(
    db: Session,
    student: Student,
    payload,
):
    complaint = Complaint(
        complaint_number=f"CMP-{datetime.now(timezone.utc):%y%m%d%H%M%S%f}",
        student_pk=student.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        category=payload.category.strip(),
        priority=payload.priority,
        status="Open",
    )

    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    return serialize_complaint(db, complaint)


# ADMIN: VIEW ALL COMPLAINTS

@router.get("/")
def list_complaints(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    complaints = db.scalars(
        select(Complaint).order_by(Complaint.created_at.desc())
    ).all()

    return [
        serialize_complaint(db, complaint)
        for complaint in complaints
    ]


# ADMIN: CREATE COMPLAINT FOR A STUDENT

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_complaint(
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    student = db.scalar(
        select(Student).where(Student.student_id == payload.student_id)
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student ID was not found.",
        )

    if not student.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot create a complaint for an inactive student.",
        )

    return save_complaint(db, student, payload)


# STUDENT: SUBMIT OWN COMPLAINT

@router.post("/me", status_code=status.HTTP_201_CREATED)
def create_my_complaint(
    payload: StudentComplaintCreate,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    return save_complaint(db, student, payload)


# STUDENT: VIEW OWN COMPLAINTS

@router.get("/me")
def list_my_complaints(
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    complaints = db.scalars(
        select(Complaint)
        .where(Complaint.student_pk == student.id)
        .order_by(Complaint.created_at.desc())
    ).all()

    return [
        serialize_complaint(db, complaint)
        for complaint in complaints
    ]


# ADMIN: UPDATE COMPLAINT

@router.patch("/{complaint_id}")
def update_complaint(
    complaint_id: int,
    payload: ComplaintUpdate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    complaint = db.get(Complaint, complaint_id)

    if not complaint:
        raise HTTPException(
            status_code=404,
            detail="Complaint not found.",
        )

    changes = payload.model_dump(exclude_unset=True)

    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip()

            if not value:
                raise HTTPException(
                    status_code=422,
                    detail=f"{field} cannot be empty.",
                )

        setattr(complaint, field, value)

    db.commit()
    db.refresh(complaint)

    return serialize_complaint(db, complaint)