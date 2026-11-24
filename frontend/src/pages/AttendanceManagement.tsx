
import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  LockKeyhole,
  Save,
  ShieldCheck,
  Users,
  RotateCcw,
  RefreshCw,
} from 'lucide-react'

type AttendanceStatus = 'Present' | 'Absent' | 'Leave'

type Student = {
  id: number
  studentId: string
  name: string
  room: string
}

type AttendanceRecord = {
  id: number
  student_pk: number
  student_id: string
  full_name: string
  status: AttendanceStatus
  note: string | null
}

type AttendanceResponse = {
  attendance_date: string
  is_locked: boolean
  locked_at?: string | null
  records: AttendanceRecord[]
}

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

function getLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string): string {
  if (!value) return ''

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`

    try {
      const error = await response.json()
      message = error.detail || message
    } catch {
      // Keep the default error message.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export default function AttendanceManagement() {
  const today = getLocalDate()

  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<
    Record<number, AttendanceStatus>
  >({})
  const [selectedDate, setSelectedDate] = useState(today)
  const [isLocked, setIsLocked] = useState(false)
  const [lockedAt, setLockedAt] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAttendancePage() {
      setLoading(true)
      setMessage('')

      try {
        const [studentResponse, attendanceResponse] = await Promise.all([
          apiRequest<unknown>('/students/'),
          apiRequest<AttendanceResponse>(
            `/attendance/?attendance_date=${selectedDate}`,
          ),
        ])

        if (cancelled) return

        // Accept either a plain student array or a common wrapped response.
        const rawStudents = Array.isArray(studentResponse)
          ? studentResponse
          : (
              studentResponse as {
                students?: unknown[]
                items?: unknown[]
                data?: unknown[]
              }
            ).students ??
            (
              studentResponse as {
                items?: unknown[]
              }
            ).items ??
            (
              studentResponse as {
                data?: unknown[]
              }
            ).data ??
            []

        const activeStudents: Student[] = rawStudents
          .filter((item): item is Record<string, unknown> => {
            return typeof item === 'object' && item !== null
          })
          .filter((item) => item.is_active !== false)
          .filter((item) => item.id != null)
          .map((item) => ({
            id: Number(item.id),
            studentId: String(
              item.student_id ?? item.studentId ?? item.id,
            ),
            name: String(
              item.full_name ?? item.name ?? 'Unnamed Student',
            ),
            room: String(
              item.room_number ??
                item.room ??
                item.room_details?.toString?.() ??
                '—',
            ),
          }))
          .filter((student) => Number.isFinite(student.id))

        setStudents(activeStudents)
        setIsLocked(attendanceResponse.is_locked)
        setLockedAt(attendanceResponse.locked_at ?? null)

        const savedMarks: Record<number, AttendanceStatus> = {}

        for (const record of attendanceResponse.records ?? []) {
          if (
            record.status === 'Present' ||
            record.status === 'Absent' ||
            record.status === 'Leave'
          ) {
            savedMarks[record.student_pk] = record.status
          }
        }

        setAttendance(savedMarks)
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Could not load attendance data.',
          )
          setMessageType('error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAttendancePage()

    return () => {
      cancelled = true
    }
  }, [selectedDate])

  const presentCount = students.filter(
    (student) => attendance[student.id] === 'Present',
  ).length

  const absentCount = students.filter(
    (student) => attendance[student.id] === 'Absent',
  ).length

  const leaveCount = students.filter(
    (student) => attendance[student.id] === 'Leave',
  ).length

  const unmarkedCount =
    students.length - presentCount - absentCount - leaveCount

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim()

    return students.filter((student) => {
      const searchableText =
        `${student.name} ${student.studentId} ${student.room}`.toLowerCase()

      const status = attendance[student.id]

      return (
        searchableText.includes(query) &&
        (statusFilter === 'All' || status === statusFilter)
      )
    })
  }, [students, attendance, search, statusFilter])

  function showFeedback(
    text: string,
    type: 'success' | 'error' = 'success',
  ) {
    setMessage(text)
    setMessageType(type)
  }

  function markStudent(id: number, status: AttendanceStatus) {
    if (isLocked || saving) return

    setAttendance((current) => ({
      ...current,
      [id]: status,
    }))

    setMessage('')
  }

  function markAllPresent() {
    if (isLocked || saving) return

    const updated: Record<number, AttendanceStatus> = {}

    students.forEach((student) => {
      updated[student.id] = 'Present'
    })

    setAttendance(updated)
    showFeedback('All active students marked Present. Review before saving.')
  }

  function clearDraft() {
    if (isLocked || saving) return

    if (!window.confirm('Clear all attendance marks for this date?')) return

    setAttendance({})
    showFeedback('Unsaved attendance marks cleared.')
  }

  async function saveAttendance() {
    if (isLocked || saving) return

    if (selectedDate > today) {
      showFeedback('Future-date attendance is not allowed.', 'error')
      return
    }

    if (students.length === 0) {
      showFeedback(
        'No active students were found. Check Student Management first.',
        'error',
      )
      return
    }

    if (unmarkedCount > 0) {
      showFeedback(
        `Please mark all students first. ${unmarkedCount} remain unmarked.`,
        'error',
      )
      return
    }

    const confirmed = window.confirm(
      `Save and lock attendance for ${formatDate(selectedDate)}? Once locked, this register cannot be edited.`,
    )

    if (!confirmed) return

    setSaving(true)
    setMessage('')

    try {
      const records = students.map((student) => ({
        student_pk: student.id,
        status: attendance[student.id],
        note: null,
      }))

      await apiRequest(`/attendance/${selectedDate}`, {
        method: 'PUT',
        body: JSON.stringify({ records }),
      })

      const lockResponse = await apiRequest<{
        message: string
        is_locked: boolean
        locked_at?: string | null
      }>(`/attendance/${selectedDate}/lock`, {
        method: 'POST',
      })

      setIsLocked(lockResponse.is_locked)
      setLockedAt(lockResponse.locked_at ?? null)

      showFeedback(
        'Attendance saved to the database and locked successfully.',
      )
    } catch (error) {
      // Reload server state if saving or locking failed.
      try {
        const serverData = await apiRequest<AttendanceResponse>(
          `/attendance/?attendance_date=${selectedDate}`,
        )

        setIsLocked(serverData.is_locked)
        setLockedAt(serverData.locked_at ?? null)

        const serverMarks: Record<number, AttendanceStatus> = {}
        for (const record of serverData.records ?? []) {
          if (
            record.status === 'Present' ||
            record.status === 'Absent' ||
            record.status === 'Leave'
          ) {
            serverMarks[record.student_pk] = record.status
          }
        }
        setAttendance(serverMarks)
      } catch {
        // Preserve the original error if the refresh also fails.
      }

      showFeedback(
        error instanceof Error
          ? error.message
          : 'Could not save attendance.',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  async function refreshAttendance() {
    setLoading(true)
    setMessage('')

    try {
      const [studentResponse, attendanceResponse] = await Promise.all([
        apiRequest<unknown>('/students/'),
        apiRequest<AttendanceResponse>(
          `/attendance/?attendance_date=${selectedDate}`,
        ),
      ])

      const rawStudents = Array.isArray(studentResponse)
        ? studentResponse
        : (
            studentResponse as {
              students?: unknown[]
              items?: unknown[]
              data?: unknown[]
            }
          ).students ??
          (
            studentResponse as {
              items?: unknown[]
            }
          ).items ??
          (
            studentResponse as {
              data?: unknown[]
            }
          ).data ??
          []

      const activeStudents: Student[] = rawStudents
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' && item !== null,
        )
        .filter((item) => item.is_active !== false && item.id != null)
        .map((item) => ({
          id: Number(item.id),
          studentId: String(item.student_id ?? item.studentId ?? item.id),
          name: String(item.full_name ?? item.name ?? 'Unnamed Student'),
          room: String(item.room_number ?? item.room ?? '—'),
        }))
        .filter((student) => Number.isFinite(student.id))

      setStudents(activeStudents)
      setIsLocked(attendanceResponse.is_locked)
      setLockedAt(attendanceResponse.locked_at ?? null)

      const marks: Record<number, AttendanceStatus> = {}
      for (const record of attendanceResponse.records ?? []) {
        if (
          record.status === 'Present' ||
          record.status === 'Absent' ||
          record.status === 'Leave'
        ) {
          marks[record.student_pk] = record.status
        }
      }

      setAttendance(marks)
      showFeedback('Attendance data refreshed.')
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : 'Refresh failed.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="attendance-management">
      <div className="student-page-heading">
        <div>
          <h2>Daily Attendance Register</h2>
          <p>
            Manage hostel attendance using registered students and saved
            database records.
          </p>
        </div>

        <button
          type="button"
          className="student-cancel-button"
          onClick={refreshAttendance}
          disabled={loading || saving}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="student-add-form">
        <div className="student-form-grid">
          <label>
            <span>
              <CalendarDays size={16} />
              Attendance Date
            </span>
            <input
              type="date"
              value={selectedDate}
              max={today}
              disabled={saving}
              onChange={(event) => {
                if (event.target.value) {
                  setSelectedDate(event.target.value)
                  setSearch('')
                  setStatusFilter('All')
                }
              }}
            />
          </label>

          <div>
            <span>Register Status</span>
            <p style={{ marginTop: 12 }}>
              {isLocked ? (
                <span className="student-status active">
                  <LockKeyhole size={14} /> Locked
                </span>
              ) : (
                <span className="student-status pending">
                  <Clock size={14} /> Draft
                </span>
              )}
            </p>
          </div>

          <div>
            <span>Total Active Students</span>
            <p
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <Users size={16} /> {students.length} registered
            </p>
          </div>
        </div>

        {isLocked && (
          <p className="attendance-note">
            <ShieldCheck size={16} />
            {lockedAt
              ? `Locked on ${new Date(lockedAt).toLocaleString()}.`
              : 'This register is locked.'}{' '}
            It is read-only.
          </p>
        )}
      </div>

      {message && (
        <div
          className="student-message"
          role="status"
          style={{
            borderColor:
              messageType === 'error' ? '#fecaca' : '#a7f3d0',
          }}
        >
          {message}
          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="student-summary">
        <div className="student-summary-card">
          <CheckCircle2 size={21} />
          <div>
            <span>Present</span>
            <strong>{presentCount}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <XCircle size={21} />
          <div>
            <span>Absent</span>
            <strong>{absentCount}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <CalendarDays size={21} />
          <div>
            <span>On Leave</span>
            <strong>{leaveCount}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <Clock size={21} />
          <div>
            <span>Unmarked</span>
            <strong>{unmarkedCount}</strong>
          </div>
        </div>
      </div>

      <div className="student-toolbar">
        <label className="student-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search by name, student ID or room..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="student-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter students by attendance status"
        >
          <option value="All">All students</option>
          <option value="Present">Present</option>
          <option value="Absent">Absent</option>
          <option value="Leave">On Leave</option>
        </select>
      </div>

      <div className="student-directory-heading">
        <div>
          <h3>Student Attendance</h3>
          <p>
            {formatDate(selectedDate)} · {filteredStudents.length} student(s)
            shown
          </p>
        </div>

        {!isLocked && (
          <div className="room-header-actions">
            <button
              type="button"
              className="student-cancel-button"
              onClick={markAllPresent}
              disabled={loading || saving || students.length === 0}
            >
              <CheckCircle2 size={16} /> Mark All Present
            </button>

            <button
              type="button"
              className="student-cancel-button"
              onClick={clearDraft}
              disabled={loading || saving}
            >
              <RotateCcw size={16} /> Clear Marks
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="student-empty-state">Loading attendance data...</div>
      ) : (
        <div className="student-table-wrapper">
          <table className="student-table attendance-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Room</th>
                <th>Attendance Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student, index) => {
                const status = attendance[student.id]

                return (
                  <tr key={student.id}>
                    <td>{index + 1}</td>
                    <td>{student.studentId}</td>
                    <td>
                      <div className="complaint-title-cell">
                        <strong>{student.name}</strong>
                      </div>
                    </td>
                    <td>{student.room}</td>
                    <td>
                      {isLocked ? (
                        <span
                          className={`student-status ${
                            status === 'Present'
                              ? 'active'
                              : status === 'Absent'
                                ? 'overdue'
                                : 'pending'
                          }`}
                        >
                          {status ?? 'Not recorded'}
                        </span>
                      ) : (
                        <select
                          className="attendance-status-select"
                          value={status ?? ''}
                          disabled={saving}
                          onChange={(event) => {
                            const value = event.target.value

                            if (
                              value === 'Present' ||
                              value === 'Absent' ||
                              value === 'Leave'
                            ) {
                              markStudent(student.id, value)
                            }
                          }}
                          aria-label={`Attendance status for ${student.name}`}
                        >
                          <option value="" disabled>
                            Select status
                          </option>
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="Leave">Leave</option>
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="student-empty-state">
                      {students.length === 0
                        ? 'No active students found. Register students in Student Management first.'
                        : 'No students match your search or filter.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="student-form-actions">
        {isLocked ? (
          <p className="attendance-note">
            <ShieldCheck size={16} />
            Attendance is saved and locked. Editing is disabled for this date.
          </p>
        ) : (
          <>
            <p className="attendance-note">
              {unmarkedCount === 0 && students.length > 0
                ? 'All students are marked. Review before saving and locking.'
                : `${unmarkedCount} student(s) still need to be marked.`}
            </p>

            <button
              type="button"
              className="student-add-button"
              onClick={saveAttendance}
              disabled={
                loading ||
                saving ||
                students.length === 0 ||
                unmarkedCount > 0
              }
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save & Lock Attendance'}
            </button>
          </>
        )}
      </div>

      <p className="attendance-note">
        Student records and attendance are loaded from the FastAPI backend.
        Saved registers are stored in PostgreSQL.
      </p>
    </section>
  )
}
