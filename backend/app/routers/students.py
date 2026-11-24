
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Student
from app.schemas import StudentCreate, StudentResponse
from app.routers.auth import get_jwt_secret, require_admin

router = APIRouter(prefix="/students", tags=["Students"])
bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="BearerAuth",
)


def get_current_student(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    db: Session = Depends(get_db),
) -> Student:

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Student authentication required.",
        )

    try:
        claims = jwt.decode(
            credentials.credentials,
            get_jwt_secret(),
            algorithms=["HS256"],
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token.",
        )

    if claims.get("role") != "student":
        raise HTTPException(
            status_code=403,
            detail="Student access required.",
        )

    student = db.get(Student, int(claims["sub"]))

    if student is None or not student.is_active:
        raise HTTPException(
            status_code=401,
            detail="Student account not found or inactive.",
        )

    return student


# ADMIN: Create a student
@router.post(
    "/",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_student(
    student_data: StudentCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    existing_student = db.scalar(
        select(Student).where(
            (Student.student_id == student_data.student_id)
            | (Student.email == str(student_data.email))
        )
    )

    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student ID or email already exists.",
        )

    student = Student(**student_data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)

    return student


# ADMIN: List all students
@router.get("/", response_model=list[StudentResponse])
def list_students(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return db.scalars(
        select(Student).order_by(Student.id)
    ).all()


# STUDENT: Get own profile
@router.get("/me", response_model=StudentResponse)
def get_my_profile(
    current_student: Student = Depends(get_current_student),
):
    return current_student


# ADMIN: Get a particular student
@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: str,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    student = db.scalar(
        select(Student).where(Student.student_id == student_id)
    )

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    return student


# ADMIN: Deactivate a student
@router.patch("/{student_id}/deactivate")
def deactivate_student(
    student_id: str,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    student = db.scalar(
        select(Student).where(Student.student_id == student_id)
    )

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found.",
        )

    student.is_active = False
    db.commit()

    return {
        "message": "Student deactivated successfully.",
        "student_id": student.student_id,
    }
