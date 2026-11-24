
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FeePayment, FeeRecord, Student
from app.routers.students import get_current_student

router = APIRouter(prefix="/fees", tags=["Fees"])


# ---------- Request schemas ----------

class FeeCreate(BaseModel):
    student_id: str = Field(min_length=1, max_length=30)
    description: str = Field(min_length=1, max_length=150)
    total_amount: int = Field(gt=0)
    due_date: date


class PaymentCreate(BaseModel):
    amount: int = Field(gt=0)
    payment_method: str = Field(min_length=1, max_length=30)
    reference: str | None = Field(default=None, max_length=100)


# ---------- Response schemas ----------

class PaymentResponse(BaseModel):
    id: int
    amount: int
    payment_date: datetime
    payment_method: str
    reference: str | None


class FeeResponse(BaseModel):
    id: int
    student_id: str
    student_name: str
    description: str
    total_amount: int
    amount_paid: int
    balance: int
    due_date: date
    status: str
    payments: list[PaymentResponse]


# ---------- Helpers ----------

def get_fee_or_404(db: Session, fee_id: int) -> FeeRecord:
    fee = db.get(FeeRecord, fee_id)

    if fee is None:
        raise HTTPException(
            status_code=404,
            detail="Fee record not found.",
        )

    return fee


def build_fee_response(db: Session, fee: FeeRecord) -> dict:
    student = db.get(Student, fee.student_pk)

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    payments = db.scalars(
        select(FeePayment)
        .where(FeePayment.fee_record_id == fee.id)
        .order_by(FeePayment.payment_date, FeePayment.id)
    ).all()

    amount_paid = sum(payment.amount for payment in payments)
    balance = fee.total_amount - amount_paid

    if balance <= 0:
        fee_status = "Paid"
    elif amount_paid > 0:
        fee_status = "Partially Paid"
    else:
        fee_status = "Pending"

    return {
        "id": fee.id,
        "student_id": student.student_id,
        "student_name": student.full_name,
        "description": fee.description,
        "total_amount": fee.total_amount,
        "amount_paid": amount_paid,
        "balance": balance,
        "due_date": (
            fee.due_date.date()
            if isinstance(fee.due_date, datetime)
            else fee.due_date
        ),
        "status": fee_status,
        "payments": [
            {
                "id": payment.id,
                "amount": payment.amount,
                "payment_date": payment.payment_date,
                "payment_method": payment.payment_method,
                "reference": payment.reference,
            }
            for payment in payments
        ],
    }


# ---------- ADMIN / EXISTING ENDPOINTS ----------

@router.get("/", response_model=list[FeeResponse])
def list_fees(db: Session = Depends(get_db)):
    fees = db.scalars(
        select(FeeRecord).order_by(
            FeeRecord.due_date,
            FeeRecord.id,
        )
    ).all()

    return [
        build_fee_response(db, fee)
        for fee in fees
    ]


@router.post(
    "/",
    response_model=FeeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_fee(
    payload: FeeCreate,
    db: Session = Depends(get_db),
):
    student_id = payload.student_id.strip()
    description = payload.description.strip()

    if not student_id or not description:
        raise HTTPException(
            status_code=422,
            detail="Student ID and description are required.",
        )

    student = db.scalar(
        select(Student).where(
            Student.student_id == student_id
        )
    )

    if student is None:
        raise HTTPException(
            status_code=404,
            detail="Student not found.",
        )

    if not student.is_active:
        raise HTTPException(
            status_code=409,
            detail="Cannot create a fee for an inactive student.",
        )

    fee = FeeRecord(
        student_pk=student.id,
        description=description,
        total_amount=payload.total_amount,
        due_date=datetime.combine(
            payload.due_date,
            time.min,
            tzinfo=timezone.utc,
        ),
    )

    db.add(fee)
    db.commit()
    db.refresh(fee)

    return build_fee_response(db, fee)


@router.post(
    "/{fee_id}/payments",
    response_model=FeeResponse,
)
def record_payment(
    fee_id: int,
    payload: PaymentCreate,
    db: Session = Depends(get_db),
):
    fee = db.scalar(
        select(FeeRecord)
        .where(FeeRecord.id == fee_id)
        .with_for_update()
    )

    if fee is None:
        raise HTTPException(
            status_code=404,
            detail="Fee record not found.",
        )

    amount_paid = db.scalar(
        select(
            func.coalesce(func.sum(FeePayment.amount), 0)
        ).where(
            FeePayment.fee_record_id == fee.id
        )
    ) or 0

    balance = fee.total_amount - amount_paid

    if balance <= 0:
        raise HTTPException(
            status_code=409,
            detail="This fee has already been fully paid.",
        )

    if payload.amount > balance:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Payment exceeds the outstanding balance "
                f"of {balance}."
            ),
        )

    payment_method = payload.payment_method.strip()

    if not payment_method:
        raise HTTPException(
            status_code=422,
            detail="Payment method is required.",
        )

    payment = FeePayment(
        fee_record_id=fee.id,
        amount=payload.amount,
        payment_method=payment_method,
        reference=(
            payload.reference.strip()
            if payload.reference
            else None
        ),
    )

    db.add(payment)
    db.commit()
    db.refresh(fee)

    return build_fee_response(db, fee)


@router.get(
    "/{fee_id}/payments",
    response_model=list[PaymentResponse],
)
def list_fee_payments(
    fee_id: int,
    db: Session = Depends(get_db),
):
    get_fee_or_404(db, fee_id)

    return db.scalars(
        select(FeePayment)
        .where(FeePayment.fee_record_id == fee_id)
        .order_by(
            FeePayment.payment_date,
            FeePayment.id,
        )
    ).all()


# ---------- STUDENT ENDPOINT ----------

@router.get(
    "/me",
    response_model=list[FeeResponse],
)
def get_my_fees(
    start_date: date | None = None,
    end_date: date | None = None,
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Return only the authenticated student's fee records.

    Optional filters apply to fee due dates.
    """

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="Start date cannot be after end date.",
        )

    query = (
        select(FeeRecord)
        .where(
            FeeRecord.student_pk == current_student.id
        )
        .order_by(
            FeeRecord.due_date,
            FeeRecord.id,
        )
    )

    if start_date:
        start_datetime = datetime.combine(
            start_date,
            time.min,
            tzinfo=timezone.utc,
        )
        query = query.where(
            FeeRecord.due_date >= start_datetime
        )

    if end_date:
        end_datetime = datetime.combine(
            end_date,
            time.max,
            tzinfo=timezone.utc,
        )
        query = query.where(
            FeeRecord.due_date <= end_datetime
        )

    fees = db.scalars(query).all()

    return [
        build_fee_response(db, fee)
        for fee in fees
    ]
