
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StudentCreate(BaseModel):
    student_id: str = Field(min_length=1, max_length=30)
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    course: str = Field(min_length=2, max_length=100)
    academic_year: int = Field(ge=1, le=8)


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: str
    full_name: str
    email: EmailStr
    phone: str
    course: str
    academic_year: int
    is_active: bool
    created_at: datetime
