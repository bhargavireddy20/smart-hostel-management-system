
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    AttendanceDay,
    AttendanceRecord,
    Student,
)
from app.routers.students import get_current_student

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
)


class AttendanceEntry(BaseModel):
    student_pk: int
    status: str = Field(
        pattern="^(Present|Absent|Leave)$"
    )
    note: str | None = None


class AttendanceSaveRequest(BaseModel):
    records: list[AttendanceEntry]


def get_attendance_day(
    attendance_date: date,
    db: Session,
) -> AttendanceDay | None:
    return (
        db.query(AttendanceDay)
        .options(
            joinedload(AttendanceDay.records)
            .joinedload(AttendanceRecord.student)
        )
        .filter(
            AttendanceDay.attendance_date == attendance_date
        )
        .first()
    )


# --------------------------------------------------
# STUDENT: VIEW OWN ATTENDANCE
# --------------------------------------------------

@router.get("/me")
def get_my_attendance(
    start_date: date,
    end_date: date,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date.",
        )

    if (end_date - start_date).days > 366:
        raise HTTPException(
            status_code=400,
            detail="Attendance date range cannot exceed 366 days.",
        )

    records = (
        db.query(AttendanceRecord)
        .join(
            AttendanceDay,
            AttendanceRecord.attendance_day_id == AttendanceDay.id,
        )
        .filter(
            AttendanceRecord.student_pk == current_student.id,
            AttendanceDay.attendance_date >= start_date,
            AttendanceDay.attendance_date <= end_date,
        )
        .order_by(AttendanceDay.attendance_date.asc())
        .all()
    )

    return {
        "student_id": current_student.student_id,
        "student_name": current_student.full_name,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_recorded": len(records),
        "records": [
            {
                "attendance_date": record.attendance_day.attendance_date.isoformat(),
                "status": record.status,
                "note": record.note,
                "is_locked": record.attendance_day.is_locked,
                "locked_at": (
                    record.attendance_day.locked_at.isoformat()
                    if record.attendance_day.locked_at
                    else None
                ),
            }
            for record in records
        ],
    }


# --------------------------------------------------
# ADMIN: GET ATTENDANCE FOR A DATE
# --------------------------------------------------

@router.get("/")
def get_attendance(
    attendance_date: date,
    db: Session = Depends(get_db),
):
    day = get_attendance_day(attendance_date, db)

    if day is None:
        return {
            "attendance_date": attendance_date.isoformat(),
            "is_locked": False,
            "records": [],
        }

    return {
        "attendance_date": day.attendance_date.isoformat(),
        "is_locked": day.is_locked,
        "locked_at": (
            day.locked_at.isoformat()
            if day.locked_at else None
        ),
        "records": [
            {
                "id": record.id,
                "student_pk": record.student_pk,
                "student_id": record.student.student_id,
                "full_name": record.student.full_name,
                "status": record.status,
                "note": record.note,
            }
            for record in day.records
        ],
    }


# --------------------------------------------------
# ADMIN: SAVE DAILY ATTENDANCE
# --------------------------------------------------

@router.put("/{attendance_date}")
def save_attendance(
    attendance_date: date,
    payload: AttendanceSaveRequest,
    db: Session = Depends(get_db),
):
    day = get_attendance_day(attendance_date, db)

    if day and day.is_locked:
        raise HTTPException(
            status_code=409,
            detail="Attendance for this date is locked and cannot be changed.",
        )

    active_students = (
        db.query(Student)
        .filter(Student.is_active.is_(True))
        .all()
    )

    active_student_ids = {
        student.id for student in active_students
    }

    submitted_ids = [
        entry.student_pk for entry in payload.records
    ]

    if len(submitted_ids) != len(set(submitted_ids)):
        raise HTTPException(
            status_code=400,
            detail="A student can only have one attendance entry per day.",
        )

    if set(submitted_ids) != active_student_ids:
        raise HTTPException(
            status_code=400,
            detail="Submit attendance for every active student exactly once.",
        )

    if day is None:
        day = AttendanceDay(
            attendance_date=attendance_date,
            is_locked=False,
        )
        db.add(day)
        db.flush()

    existing_records = {
        record.student_pk: record
        for record in day.records
    }

    for entry in payload.records:
        record = existing_records.get(entry.student_pk)

        if record is None:
            record = AttendanceRecord(
                attendance_day_id=day.id,
                student_pk=entry.student_pk,
                status=entry.status,
                note=entry.note,
            )
            db.add(record)
        else:
            record.status = entry.status
            record.note = entry.note

    try:
        db.commit()
        db.refresh(day)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save attendance.",
        )

    return {
        "message": "Attendance saved successfully.",
        "attendance_date": day.attendance_date.isoformat(),
        "is_locked": day.is_locked,
        "record_count": len(payload.records),
    }


# --------------------------------------------------
# ADMIN: LOCK DAILY ATTENDANCE
# --------------------------------------------------

@router.post("/{attendance_date}/lock")
def lock_attendance(
    attendance_date: date,
    db: Session = Depends(get_db),
):
    day = get_attendance_day(attendance_date, db)

    if day is None:
        raise HTTPException(
            status_code=404,
            detail="Save attendance for this date before locking it.",
        )

    if day.is_locked:
        return {
            "message": "Attendance is already locked.",
            "attendance_date": day.attendance_date.isoformat(),
            "is_locked": True,
        }

    active_student_ids = {
        student.id
        for student in db.query(Student)
        .filter(Student.is_active.is_(True))
        .all()
    }

    recorded_student_ids = {
        record.student_pk for record in day.records
    }

    if recorded_student_ids != active_student_ids:
        raise HTTPException(
            status_code=400,
            detail="Attendance must be saved for every active student before locking.",
        )

    day.is_locked = True
    day.locked_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(day)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not lock attendance.",
        )

    return {
        "message": "Attendance saved and locked successfully.",
        "attendance_date": day.attendance_date.isoformat(),
        "is_locked": day.is_locked,
        "locked_at": (
            day.locked_at.isoformat()
            if day.locked_at else None
        ),
    }
