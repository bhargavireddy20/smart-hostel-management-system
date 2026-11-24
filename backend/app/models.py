
from datetime import datetime

from sqlalchemy import (
     Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    student_id: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    full_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(150), unique=True, index=True, nullable=False
    )

    password_hash: Mapped[str | None] = mapped_column(
    String(255),
    nullable=True,
    )

    phone: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    course: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    academic_year: Mapped[int] = mapped_column(nullable=False)

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    room_number: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    block: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    capacity: Mapped[int] = mapped_column(
        Integer, nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class RoomAssignment(Base):
    __tablename__ = "room_assignments"

    __table_args__ = (
        UniqueConstraint(
            "student_pk",
            "end_date",
            name="uq_room_assignment_student_end_date",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    student_pk: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
        index=True,
    )

    room_pk: Mapped[int] = mapped_column(
        ForeignKey("rooms.id"),
        nullable=False,
        index=True,
    )

    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class FeeRecord(Base):
    __tablename__ = "fee_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    student_pk: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
        index=True,
    )

    description: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    total_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    fee_record_id: Mapped[int] = mapped_column(
        ForeignKey("fee_records.id"),
        nullable=False,
        index=True,
    )

    amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    payment_method: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    complaint_number: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
    )

    student_pk: Mapped[int] = mapped_column(
        ForeignKey("students.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        String(2000),
        nullable=False,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    priority: Mapped[str] = mapped_column(
        String(20),
        default="Medium",
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="Open",
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    content = Column(Text, nullable=False)
    audience = Column(
        String(30),
        nullable=False,
        default="All Students",
    )
    priority = Column(
        String(20),
        nullable=False,
        default="Normal",
    )
    publish_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship


class AttendanceDay(Base):
    __tablename__ = "attendance_days"

    id = Column(Integer, primary_key=True, index=True)
    attendance_date = Column(Date, nullable=False, unique=True, index=True)
    is_locked = Column(Boolean, nullable=False, default=False)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    records = relationship(
        "AttendanceRecord",
        back_populates="attendance_day",
        cascade="all, delete-orphan",
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    attendance_day_id = Column(
        Integer,
        ForeignKey("attendance_days.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_pk = Column(
        Integer,
        ForeignKey("students.id"),
        nullable=False,
    )
    status = Column(String(20), nullable=False, default="Present")
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    attendance_day = relationship(
        "AttendanceDay",
        back_populates="records",
    )
    student = relationship("Student")

    __table_args__ = (
        UniqueConstraint(
            "attendance_day_id",
            "student_pk",
            name="uq_attendance_day_student",
        ),
    )
