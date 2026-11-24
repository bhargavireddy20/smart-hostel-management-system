
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from pwdlib import PasswordHash
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Student

load_dotenv()

router = APIRouter(prefix="/auth", tags=["Authentication"])
password_hasher = PasswordHash.recommended()
bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="BearerAuth",
)

JWT_ALGORITHM = "HS256"


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class StudentLoginRequest(BaseModel):
    email: str
    password: str


class SetStudentPasswordRequest(BaseModel):
    student_id: str
    new_password: str


def get_jwt_secret() -> str:
    secret_key = os.getenv("JWT_SECRET_KEY", "")

    if not secret_key or len(secret_key) < 32:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured correctly.",
        )

    return secret_key


def create_access_token(
    subject: str,
    role: str,
    expires_minutes: int,
    extra_claims: dict | None = None,
) -> str:
    secret_key = get_jwt_secret()
    now = datetime.now(timezone.utc)

    claims = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }

    if extra_claims:
        claims.update(extra_claims)

    return jwt.encode(
        claims,
        secret_key,
        algorithm=JWT_ALGORITHM,
    )


def require_admin(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = jwt.decode(
            credentials.credentials,
            get_jwt_secret(),
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims.get("role") != "admin" or not claims.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required.",
        )

    configured_email = os.getenv("ADMIN_EMAIL", "").strip().lower()

    if claims["sub"].strip().lower() != configured_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator token is not authorized.",
        )

    return claims


@router.post("/admin-login")
def admin_login(payload: AdminLoginRequest):
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password_hash = os.getenv("ADMIN_PASSWORD_HASH", "")
    expires_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

    if not admin_email or not password_hash:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin authentication is not configured correctly.",
        )

    email_matches = payload.email.strip().lower() == admin_email

    try:
        password_matches = password_hasher.verify(
            payload.password,
            password_hash,
        )
    except Exception:
        password_matches = False

    if not email_matches or not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(
        subject=admin_email,
        role="admin",
        expires_minutes=expires_minutes,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "admin",
        "expires_in": expires_minutes * 60,
    }


@router.post("/student-login")
def student_login(payload: StudentLoginRequest):
    expires_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

    db = SessionLocal()

    try:
        statement = select(Student).where(
            Student.email == payload.email.strip().lower()
        )
        student = db.scalars(statement).first()

        if (
            student is None
            or not student.is_active
            or not student.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        try:
            password_matches = password_hasher.verify(
                payload.password,
                student.password_hash,
            )
        except Exception:
            password_matches = False

        if not password_matches:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        token = create_access_token(
            subject=str(student.id),
            role="student",
            expires_minutes=expires_minutes,
            extra_claims={"student_id": student.student_id},
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "role": "student",
            "expires_in": expires_minutes * 60,
        }

    finally:
        db.close()


@router.post("/admin/set-student-password")
def set_student_password(
    payload: SetStudentPasswordRequest,
    admin: Annotated[dict, Depends(require_admin)],
):
    if len(payload.new_password) < 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 12 characters long.",
        )

    db = SessionLocal()

    try:
        statement = select(Student).where(
            Student.student_id == payload.student_id.strip()
        )
        student = db.scalars(statement).first()

        if student is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found.",
            )

        student.password_hash = password_hasher.hash(
            payload.new_password
        )
        db.commit()

        return {
            "message": "Student password configured successfully.",
            "student_id": student.student_id,
        }

    finally:
        db.close()
