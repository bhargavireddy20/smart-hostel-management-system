import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Search,
  X,
  CreditCard,
  CheckCircle2,
  Clock,
  IndianRupee,
  ReceiptText,
  Plus,
  RefreshCw,
  History,
} from 'lucide-react'

const API = 'http://127.0.0.1:8000'

type ApiStudent = {
  student_id: string
  full_name: string
  email: string
  course: string
}

type ApiPayment = {
  id: number
  amount: number
  payment_date: string
  payment_method: string
  reference: string | null
}

type ApiFee = {
  id: number
  student_id: string
  student_name: string
  description: string
  total_amount: number
  amount_paid: number
  balance: number
  due_date: string
  status: string
  payments: ApiPayment[]
}

type PaymentStatus = 'Paid' | 'Pending' | 'Partially Paid' | 'Overdue'

type Payment = {
  id: number
  student: string
  studentId: string
  description: string
  amount: number
  amountPaid: number
  balance: number
  dueDate: string
  paidOn: string
  status: PaymentStatus
  method: string
  reference: string
}

type PaymentForm = {
  method: string
  reference: string
  amount: string
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function futureDateString(days = 30) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string) {
  if (!value) return '—'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getStatus(fee: ApiFee): PaymentStatus {
  if (fee.balance <= 0) return 'Paid'

  if (fee.amount_paid > 0) return 'Partially Paid'

  if (fee.due_date.slice(0, 10) < todayString()) return 'Overdue'

  return 'Pending'
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
  } catch {
    throw new Error(
      'Cannot connect to SmartStay API. Check that FastAPI is running.',
    )
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status}).`

    try {
      const body = await response.json()
      detail =
        typeof body.detail === 'string'
          ? body.detail
          : JSON.stringify(body.detail ?? body)
    } catch {
      // Keep the fallback message.
    }

    throw new Error(detail)
  }

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

function toPayment(fee: ApiFee): Payment {
  const latestPayment = fee.payments[fee.payments.length - 1]

  return {
    id: fee.id,
    student: fee.student_name,
    studentId: fee.student_id,
    description: fee.description,
    amount: fee.total_amount,
    amountPaid: fee.amount_paid,
    balance: fee.balance,
    dueDate: fee.due_date,
    paidOn: latestPayment
      ? formatDate(latestPayment.payment_date)
      : '—',
    status: getStatus(fee),
    method: latestPayment?.payment_method ?? '—',
    reference: latestPayment?.reference ?? '—',
  }
}

const emptyPaymentForm: PaymentForm = {
  method: 'UPI',
  reference: '',
  amount: '',
}

export default function PaymentManagement() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<ApiStudent[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [isCreatingRecord, setIsCreatingRecord] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [description, setDescription] = useState('Hostel Fee')
  const [feeAmount, setFeeAmount] = useState('6500')
  const [dueDate, setDueDate] = useState(futureDateString())

  const [form, setForm] = useState<PaymentForm>({
    ...emptyPaymentForm,
  })

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Payment History popup state
  const [historyFee, setHistoryFee] = useState<Payment | null>(null)
  const [historyTransactions, setHistoryTransactions] = useState<ApiPayment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const loadFees = useCallback(async () => {
    setLoading(true)

    try {
      const data = await apiRequest<ApiFee[]>('/fees/')
      setPayments(data.map(toPayment))
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load fee records.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStudents = useCallback(async () => {
    try {
      const data = await apiRequest<ApiStudent[]>('/students/')
      setStudents(data)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load registered students.',
      )
    }
  }, [])

  useEffect(() => {
    void loadFees()
    void loadStudents()
  }, [loadFees, loadStudents])

  const selectedStudent = students.find(
    (student) => student.student_id === selectedStudentId,
  )

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const text =
          `${payment.id} ${payment.student} ${payment.studentId} ${payment.description}`.toLowerCase()

        return (
          text.includes(search.toLowerCase()) &&
          (statusFilter === 'All' || payment.status === statusFilter)
        )
      }),
    [payments, search, statusFilter],
  )

  const paidTotal = payments.reduce(
    (sum, payment) => sum + payment.amountPaid,
    0,
  )

  const pendingTotal = payments.reduce(
    (sum, payment) => sum + payment.balance,
    0,
  )

  const overdueCount = payments.filter(
    (payment) =>
      payment.balance > 0 && payment.dueDate.slice(0, 10) < todayString(),
  ).length

  function openNewFeeForm() {
    setSelectedPayment(null)
    setIsCreatingRecord(true)
    setSelectedStudentId('')
    setDescription('Hostel Fee')
    setFeeAmount('6500')
    setDueDate(futureDateString())
    setForm({ ...emptyPaymentForm })
    setMessage('')
    setShowPaymentForm(true)
    void loadStudents()
  }

  function openPaymentForm(payment: Payment) {
    setSelectedPayment(payment)
    setIsCreatingRecord(false)
    setForm({
      method: 'UPI',
      reference: '',
      amount: String(payment.balance),
    })
    setMessage('')
    setShowPaymentForm(true)
  }

  async function createFeeRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!selectedStudent) {
      setMessage('Please select a registered student.')
      return
    }

    const amount = Number(feeAmount)
    const cleanDescription = description.trim()

    if (!cleanDescription || !Number.isInteger(amount) || amount <= 0) {
      setMessage('Enter a description and a valid fee amount.')
      return
    }

    if (!dueDate) {
      setMessage('Select a fee due date.')
      return
    }

    setSaving(true)

    try {
      await apiRequest<ApiFee>('/fees/', {
        method: 'POST',
        body: JSON.stringify({
          student_id: selectedStudent.student_id,
          description: cleanDescription,
          total_amount: amount,
          due_date: dueDate,
        }),
      })

      await loadFees()
      setShowPaymentForm(false)
      setIsCreatingRecord(false)
      setMessage(`Fee record created for ${selectedStudent.full_name}.`)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to create fee record.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!selectedPayment) return

    const amount = Number(form.amount)
    const reference = form.reference.trim()

    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage('Enter a valid payment amount.')
      return
    }

    if (amount > selectedPayment.balance) {
      setMessage(
        `Payment cannot exceed the outstanding balance of ₹${selectedPayment.balance.toLocaleString('en-IN')}.`,
      )
      return
    }

    if (!reference) {
      setMessage('Enter the transaction reference or receipt number.')
      return
    }

    const duplicateReference = payments.some(
      (payment) =>
        payment.id !== selectedPayment.id &&
        payment.reference !== '—' &&
        payment.reference.toLowerCase() === reference.toLowerCase(),
    )

    if (duplicateReference) {
      setMessage('This reference is already visible on another fee record.')
      return
    }

    setSaving(true)

    try {
      await apiRequest<ApiFee>(
        `/fees/${selectedPayment.id}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount,
            payment_method: form.method,
            reference,
          }),
        },
      )

      await loadFees()
      setShowPaymentForm(false)
      setSelectedPayment(null)
      setMessage(
        `Payment details saved for ${selectedPayment.student}. Verify the transaction before treating it as confirmed.`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to record payment.',
      )
    } finally {
      setSaving(false)
    }
  }

  function closeForm() {
    setShowPaymentForm(false)
    setSelectedPayment(null)
    setIsCreatingRecord(false)
    setMessage('')
  }

  // Load transaction history from the backend.
  async function openPaymentHistory(payment: Payment) {
    setHistoryFee(payment)
    setHistoryTransactions([])
    setHistoryError('')
    setHistoryLoading(true)

    try {
      const data = await apiRequest<ApiPayment[]>(
        `/fees/${payment.id}/payments`,
      )

      setHistoryTransactions(data)
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : 'Failed to load payment history.',
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  function closePaymentHistory() {
    setHistoryFee(null)
    setHistoryTransactions([])
    setHistoryError('')
    setHistoryLoading(false)
  }

  return (
    <section className="payment-management">
      <div className="student-page-heading">
        <div>
          <h2>Payments Management</h2>
          <p>Track hostel fees and maintain accountable payment records.</p>
        </div>

        <button
          type="button"
          className="student-add-button"
          onClick={openNewFeeForm}
        >
          <Plus size={18} />
          Add Fee Record
        </button>
      </div>

      <div className="student-summary">
        <div className="student-summary-card">
          <IndianRupee size={21} />
          <div>
            <span>Recorded as Paid</span>
            <strong>₹{paidTotal.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <Clock size={21} />
          <div>
            <span>Outstanding Fees</span>
            <strong>₹{pendingTotal.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <ReceiptText size={21} />
          <div>
            <span>Overdue Records</span>
            <strong>{overdueCount}</strong>
          </div>
        </div>
      </div>

      {message && (
        <div className="student-message" role="status">
          {message}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setMessage('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showPaymentForm && (
        <form
          className="student-add-form"
          onSubmit={isCreatingRecord ? createFeeRecord : recordPayment}
        >
          <div className="student-form-heading">
            <h3>{isCreatingRecord ? 'Create Fee Record' : 'Record Payment'}</h3>
            <button
              type="button"
              className="student-close-button"
              onClick={closeForm}
              aria-label="Close form"
            >
              <X size={18} />
            </button>
          </div>

          {isCreatingRecord ? (
            <>
              <div className="student-form-grid">
                <label>
                  Registered Student
                  <select
                    required
                    value={selectedStudentId}
                    onChange={(event) =>
                      setSelectedStudentId(event.target.value)
                    }
                  >
                    <option value="">Select a student</option>
                    {students.map((student) => (
                      <option
                        key={student.student_id}
                        value={student.student_id}
                      >
                        {student.full_name} ({student.student_id})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Student ID
                  <input
                    readOnly
                    value={selectedStudent?.student_id ?? ''}
                    placeholder="Auto-filled"
                  />
                </label>

                <label>
                  Fee Description
                  <input
                    required
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Hostel Fee - Semester 2"
                  />
                </label>

                <label>
                  Fee Amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={feeAmount}
                    onChange={(event) => setFeeAmount(event.target.value)}
                  />
                </label>

                <label>
                  Due Date
                  <input
                    required
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
              </div>

              <p className="payment-form-note">
                New fee records are saved to PostgreSQL and start with an
                outstanding balance. Payments are recorded separately.
              </p>

              <div className="student-form-actions">
                <button
                  type="button"
                  className="student-cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="student-add-button"
                  disabled={saving || students.length === 0}
                >
                  {saving ? 'Saving...' : 'Create Fee Record'}
                </button>
              </div>
            </>
          ) : selectedPayment ? (
            <>
              <p className="payment-form-note">
                Student: <strong>{selectedPayment.student}</strong>
                <br />
                Total fee:{' '}
                <strong>
                  ₹{selectedPayment.amount.toLocaleString('en-IN')}
                </strong>
                <br />
                Already paid:{' '}
                <strong>
                  ₹{selectedPayment.amountPaid.toLocaleString('en-IN')}
                </strong>
                <br />
                Outstanding balance:{' '}
                <strong>
                  ₹{selectedPayment.balance.toLocaleString('en-IN')}
                </strong>
              </p>

              <div className="student-form-grid">
                <label>
                  Payment Amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    max={selectedPayment.balance}
                    step="1"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                  />
                </label>

                <label>
                  Payment Method
                  <select
                    value={form.method}
                    onChange={(event) =>
                      setForm({ ...form, method: event.target.value })
                    }
                  >
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>Card</option>
                  </select>
                </label>

                <label>
                  Transaction Reference / Receipt Number
                  <input
                    required
                    value={form.reference}
                    onChange={(event) =>
                      setForm({ ...form, reference: event.target.value })
                    }
                    placeholder="Enter verifiable reference"
                  />
                </label>
              </div>

              <p className="payment-form-note">
                This records payment details; it does not automatically verify
                a bank, UPI, card, or cash transaction. The backend records the
                payment date.
              </p>

              <div className="student-form-actions">
                <button
                  type="button"
                  className="student-cancel-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="student-add-button"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </>
          ) : null}
        </form>
      )}

      <div className="student-toolbar">
        <label className="student-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search student or fee record..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="student-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by payment status"
        >
          <option value="All">All statuses</option>
          <option value="Paid">Paid</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>

        <button
          type="button"
          className="student-cancel-button"
          onClick={() => {
            setMessage('')
            void loadFees()
            void loadStudents()
          }}
          disabled={loading || saving}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="student-directory-heading">
        <div>
          <h3>Fee Records</h3>
          <p>{filteredPayments.length} record(s) found</p>
        </div>
      </div>

      <div className="student-table-wrapper">
        <table className="student-table payment-table">
          <thead>
            <tr>
              <th>Fee / Student</th>
              <th>Description / Due Date</th>
              <th>Total / Balance</th>
              <th>Last Payment</th>
              <th>Method</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <div className="student-empty-state">
                    Loading fee records from PostgreSQL...
                  </div>
                </td>
              </tr>
            ) : (
              filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <div className="complaint-title-cell">
                      <strong>{payment.student}</strong>
                      <span>
                        FEE-{payment.id} · {payment.studentId}
                      </span>
                    </div>
                  </td>

                  <td>
                    <div className="complaint-title-cell">
                      <strong>{payment.description}</strong>
                      <span>Due {formatDate(payment.dueDate)}</span>
                    </div>
                  </td>

                  <td>
                    <div className="complaint-title-cell">
                      <strong>
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </strong>
                      <span>
                        Balance: ₹{payment.balance.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </td>

                  <td>{payment.paidOn}</td>
                  <td>{payment.method}</td>

                  <td>
                    <span
                      className={`student-status ${
                        payment.status === 'Partially Paid'
                          ? 'pending'
                          : payment.status.toLowerCase()
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>

                  <td>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="student-cancel-button"
                        onClick={() => void openPaymentHistory(payment)}
                      >
                        <History size={15} />
                        History
                      </button>

                      {payment.balance <= 0 ? (
                        <span className="payment-recorded">
                          <CheckCircle2 size={16} />
                          Paid
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="student-add-button payment-record-button"
                          onClick={() => openPaymentForm(payment)}
                        >
                          <CreditCard size={15} />
                          Record
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}

            {!loading && filteredPayments.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="student-empty-state">
                    No fee records found in the database.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment History popup */}
      {historyFee && (
        <div
          onClick={closePaymentHistory}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-history-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '760px',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--card-bg, #fff)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.25)',
              margin: 0,
            }}
          >
            <div className="student-form-heading">
              <div>
                <h3 id="payment-history-title">Payment History</h3>
                <p>
                  {historyFee.student} · FEE-{historyFee.id}
                </p>
              </div>

              <button
                type="button"
                className="student-close-button"
                onClick={closePaymentHistory}
                aria-label="Close payment history"
              >
                <X size={18} />
              </button>
            </div>

            <p className="payment-form-note">
              <strong>{historyFee.description}</strong>
              <br />
              Student ID: {historyFee.studentId}
              <br />
              Total fee: ₹{historyFee.amount.toLocaleString('en-IN')}
              <br />
              Amount paid: ₹{historyFee.amountPaid.toLocaleString('en-IN')}
              <br />
              Outstanding balance: ₹
              {historyFee.balance.toLocaleString('en-IN')}
            </p>

            {historyLoading && (
              <div className="student-empty-state">
                Loading payment history...
              </div>
            )}

            {historyError && (
              <div className="student-message" role="alert">
                {historyError}
              </div>
            )}

            {!historyLoading &&
              !historyError &&
              historyTransactions.length === 0 && (
                <div className="student-empty-state">
                  No transactions have been recorded for this fee yet.
                </div>
              )}

            {!historyLoading &&
              !historyError &&
              historyTransactions.length > 0 && (
                <div className="student-table-wrapper">
                  <table className="student-table payment-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Reference</th>
                      </tr>
                    </thead>

                    <tbody>
                      {historyTransactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{formatDate(transaction.payment_date)}</td>
                          <td>
                            <strong>
                              ₹{transaction.amount.toLocaleString('en-IN')}
                            </strong>
                          </td>
                          <td>{transaction.payment_method}</td>
                          <td>{transaction.reference || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            <div className="student-form-actions">
              <button
                type="button"
                className="student-cancel-button"
                onClick={closePaymentHistory}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}