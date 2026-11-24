
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Room, RoomAssignment, Student
from app.routers.students import get_current_student

router = APIRouter(prefix="/rooms", tags=["Rooms"])


# -------------------------
# Request and response schemas
# -------------------------

class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1, max_length=30)
    block: str = Field(min_length=1, max_length=50)
    capacity: int = Field(ge=1, le=20)


class RoomUpdate(BaseModel):
    room_number: str = Field(min_length=1, max_length=30)
    block: str = Field(min_length=1, max_length=50)
    capacity: int = Field(ge=1, le=20)


class AssignedStudentResponse(BaseModel):
    student_id: str
    full_name: str
    email: str
    course: str


class RoomResponse(BaseModel):
    id: int
    room_number: str
    block: str
    capacity: int
    occupied: int
    available: int
    is_active: bool
    students: list[AssignedStudentResponse] = []


class EligibleStudentResponse(BaseModel):
    student_id: str
    full_name: str
    email: str
    course: str


class AssignmentCreate(BaseModel):
    student_id: str = Field(min_length=1, max_length=30)


class MyRoomResponse(BaseModel):
    assigned: bool
    message: str
    room_number: str | None = None
    block: str | None = None
    capacity: int | None = None
    occupied: int | None = None
    available: int | None = None
    is_active: bool | None = None


# -------------------------
# Room response helper
# -------------------------

def room_response(db: Session, room: Room) -> dict:
    assignments = db.execute(
        select(RoomAssignment, Student)
        .join(Student, RoomAssignment.student_pk == Student.id)
        .where(
            RoomAssignment.room_pk == room.id,
            RoomAssignment.end_date.is_(None),
        )
        .order_by(Student.full_name)
    ).all()

    students = [
        {
            "student_id": student.student_id,
            "full_name": student.full_name,
            "email": student.email,
            "course": student.course,
        }
        for assignment, student in assignments
    ]

    occupied = len(students)

    return {
        "id": room.id,
        "room_number": room.room_number,
        "block": room.block,
        "capacity": room.capacity,
        "occupied": occupied,
        "available": max(0, room.capacity - occupied),
        "is_active": room.is_active,
        "students": students,
    }


# -------------------------
# Student: view own room
# -------------------------

@router.get("/me", response_model=MyRoomResponse)
def get_my_room(
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    assignment = db.scalar(
        select(RoomAssignment)
        .where(
            RoomAssignment.student_pk == current_student.id,
            RoomAssignment.end_date.is_(None),
        )
        .order_by(RoomAssignment.id.desc())
    )

    if assignment is None:
        return MyRoomResponse(
            assigned=False,
            message="You do not currently have a room assigned.",
        )

    room = db.get(Room, assignment.room_pk)

    if room is None:
        return MyRoomResponse(
            assigned=False,
            message="Your room assignment could not be found. Please contact the hostel administrator.",
        )

    occupied = db.scalar(
        select(func.count(RoomAssignment.id)).where(
            RoomAssignment.room_pk == room.id,
            RoomAssignment.end_date.is_(None),
        )
    ) or 0

    return MyRoomResponse(
        assigned=True,
        message="Room details loaded successfully.",
        room_number=room.room_number,
        block=room.block,
        capacity=room.capacity,
        occupied=occupied,
        available=max(0, room.capacity - occupied),
        is_active=room.is_active,
    )


# -------------------------
# Admin: list rooms
# -------------------------

@router.get("/", response_model=list[RoomResponse])
def list_rooms(db: Session = Depends(get_db)):
    rooms = db.scalars(
        select(Room).order_by(Room.block, Room.room_number)
    ).all()

    return [room_response(db, room) for room in rooms]


# -------------------------
# Admin: list eligible students
# -------------------------

@router.get(
    "/eligible-students/",
    response_model=list[EligibleStudentResponse],
)
def list_eligible_students(db: Session = Depends(get_db)):
    assigned_student_ids = select(RoomAssignment.student_pk).where(
        RoomAssignment.end_date.is_(None)
    )

    students = db.scalars(
        select(Student)
        .where(
            Student.is_active.is_(True),
            ~Student.id.in_(assigned_student_ids),
        )
        .order_by(Student.full_name)
    ).all()

    return [
        {
            "student_id": student.student_id,
            "full_name": student.full_name,
            "email": student.email,
            "course": student.course,
        }
        for student in students
    ]


# -------------------------
# Admin: create room
# -------------------------

@router.post(
    "/",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)):
    room_number = payload.room_number.strip()
    block = payload.block.strip()

    if not room_number or not block:
        raise HTTPException(
            status_code=422,
            detail="Room number and block are required.",
        )

    existing = db.scalar(
        select(Room).where(Room.room_number == room_number)
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="That room number already exists.",
        )

    room = Room(
        room_number=room_number,
        block=block,
        capacity=payload.capacity,
    )

    db.add(room)
    db.commit()
    db.refresh(room)

    return room_response(db, room)


# -------------------------
# Admin: update room
# -------------------------

@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
):
    room = db.get(Room, room_id)

    if not room:
        raise HTTPException(404, "Room not found.")

    room_number = payload.room_number.strip()
    block = payload.block.strip()

    if not room_number or not block:
        raise HTTPException(
            422,
            "Room number and block are required.",
        )

    existing = db.scalar(
        select(Room).where(
            Room.room_number == room_number,
            Room.id != room_id,
        )
    )

    if existing:
        raise HTTPException(
            409,
            "That room number already exists.",
        )

    occupied = db.scalar(
        select(func.count(RoomAssignment.id)).where(
            RoomAssignment.room_pk == room.id,
            RoomAssignment.end_date.is_(None),
        )
    ) or 0

    if payload.capacity < occupied:
        raise HTTPException(
            409,
            f"This room currently has {occupied} assigned "
            f"student(s). Capacity cannot be lower than {occupied}.",
        )

    room.room_number = room_number
    room.block = block
    room.capacity = payload.capacity

    try:
        db.commit()
        db.refresh(room)
    except Exception:
        db.rollback()
        raise HTTPException(
            500,
            "Unable to update the room. Please try again.",
        )

    return room_response(db, room)


# -------------------------
# Admin: assign student
# -------------------------

@router.post("/{room_id}/assign", response_model=RoomResponse)
def assign_student(
    room_id: int,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
):
    room = db.get(Room, room_id)

    if not room or not room.is_active:
        raise HTTPException(404, "Active room not found.")

    student_id = payload.student_id.strip()

    student = db.scalar(
        select(Student).where(Student.student_id == student_id)
    )

    if not student or not student.is_active:
        raise HTTPException(404, "Active student not found.")

    current_assignment = db.scalar(
        select(RoomAssignment).where(
            RoomAssignment.student_pk == student.id,
            RoomAssignment.end_date.is_(None),
        )
    )

    if current_assignment:
        raise HTTPException(
            409,
            "This student is already assigned to a room.",
        )

    occupied = db.scalar(
        select(func.count(RoomAssignment.id)).where(
            RoomAssignment.room_pk == room.id,
            RoomAssignment.end_date.is_(None),
        )
    ) or 0

    if occupied >= room.capacity:
        raise HTTPException(
            409,
            "This room is already at capacity.",
        )

    db.add(
        RoomAssignment(
            student_pk=student.id,
            room_pk=room.id,
        )
    )

    db.commit()
    db.refresh(room)

    return room_response(db, room)


# -------------------------
# Admin: unassign student
# -------------------------

@router.post(
    "/{room_id}/unassign/{student_id}",
    response_model=RoomResponse,
)
def unassign_student(
    room_id: int,
    student_id: str,
    db: Session = Depends(get_db),
):
    room = db.get(Room, room_id)

    if not room:
        raise HTTPException(404, "Room not found.")

    student = db.scalar(
        select(Student).where(Student.student_id == student_id)
    )

    if not student:
        raise HTTPException(404, "Student not found.")

    assignment = db.scalar(
        select(RoomAssignment).where(
            RoomAssignment.room_pk == room.id,
            RoomAssignment.student_pk == student.id,
            RoomAssignment.end_date.is_(None),
        )
    )

    if not assignment:
        raise HTTPException(
            404,
            "This student is not currently assigned to this room.",
        )

    assignment.end_date = datetime.now(timezone.utc)

    db.commit()
    db.refresh(room)

    return room_response(db, room)
