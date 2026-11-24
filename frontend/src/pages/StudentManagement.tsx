
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus,
  Search,
  X,
  Users,
  UserRound,
  CheckCircle2,
  Pencil,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import {
  getStudents,
  createStudent,
  deactivateStudent,
  type ApiStudent,
} from '../services/studentService'

type Student = {
  id: string
  name: string
  room: string
  course: string
  status: 'Active' | 'Pending'
  email: string
  phone: string
  academicYear: number
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  course: '',
  academicYear: 1,
}

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const [form, setForm] = useState(emptyForm)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const records = await getStudents()

      const mapped: Student[] = records.map(
        (student: ApiStudent) => ({
          id: student.student_id,
          name: student.full_name,
          room: 'Unassigned',
          course: student.course,
          status: student.is_active ? 'Active' : 'Pending',
          email: student.email,
          phone: student.phone,
          academicYear: student.academic_year,
        }),
      )

      setStudents(mapped)
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load students from the server.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        const searchText =
          `${student.name} ${student.id} ${student.room} ${student.course} ${student.email}`
            .toLowerCase()

        const matchesSearch = searchText.includes(search.toLowerCase())
        const matchesStatus =
          statusFilter === 'All' || student.status === statusFilter

        return matchesSearch && matchesStatus
      }),
    [students, search, statusFilter],
  )

  function openAddForm() {
    setForm({ ...emptyForm })
    setMessage('')
    setShowForm(true)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const normalizedEmail = form.email.trim().toLowerCase()
    const normalizedPhone = form.phone.trim()

    const duplicateEmail = students.some(
      (student) => student.email.toLowerCase() === normalizedEmail,
    )

    if (duplicateEmail) {
      setMessage('This email is already registered.')
      return
    }

    if (!/^[0-9+\-\s()]{7,20}$/.test(normalizedPhone)) {
      setMessage('Enter a valid phone number.')
      return
    }

    void saveStudent(normalizedEmail, normalizedPhone)
  }

  async function saveStudent(email: string, phone: string) {
    setSaving(true)

    try {
      const studentId = `STU-${Date.now()}`

      await createStudent({
        student_id: studentId,
        full_name: form.name.trim(),
        email,
        phone,
        course: form.course.trim(),
        academic_year: form.academicYear,
      })

      await loadStudents()
      setShowForm(false)
      setForm({ ...emptyForm })
      setMessage('Student registered successfully in the database.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the student.',
      )
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(student: Student) {
    setMessage(
      `Editing ${student.name} is not connected yet. We need to add the student-update API first.`,
    )
  }

  async function confirmDeactivate() {
    if (!studentToDelete) return

    setDeactivating(true)
    setMessage('')

    try {
      await deactivateStudent(studentToDelete.id)
      await loadStudents()

      setMessage(`${studentToDelete.name} has been deactivated.`)
      setStudentToDelete(null)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not deactivate this student.',
      )
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <section className="student-management">
      <div className="student-page-heading">
        <div>
          <h2>Student Management</h2>
          <p>Manage student records, room assignments and status.</p>
        </div>

        <button
          type="button"
          className="student-add-button"
          onClick={openAddForm}
        >
          <Plus size={18} />
          Add Student
        </button>
      </div>

      <div className="student-summary">
        <div className="student-summary-card">
          <Users size={21} />
          <div>
            <span>Total Students</span>
            <strong>{students.length}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <UserRound size={21} />
          <div>
            <span>Active Students</span>
            <strong>
              {students.filter((student) => student.status === 'Active').length}
            </strong>
          </div>
        </div>

        <div className="student-summary-card">
          <CheckCircle2 size={21} />
          <div>
            <span>Inactive Students</span>
            <strong>
              {students.filter((student) => student.status === 'Pending').length}
            </strong>
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

      {loadError && (
        <div className="student-message" role="alert">
          <span>Could not load students: {loadError}</span>
          <button
            type="button"
            onClick={() => void loadStudents()}
            aria-label="Retry loading students"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      <div className="student-toolbar">
        <label className="student-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search students..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="student-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by student status"
        >
          <option value="All">All statuses</option>
          <option value="Active">Active</option>
          <option value="Pending">Inactive</option>
        </select>
      </div>

      {showForm && (
        <form className="student-add-form" onSubmit={handleSubmit}>
          <div className="student-form-heading">
            <h3>Add New Student</h3>
            <button
              type="button"
              className="student-close-button"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
              disabled={saving}
            >
              <X size={18} />
            </button>
          </div>

          <div className="student-form-grid">
            <label>
              Full Name
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Enter full name"
              />
            </label>

            <label>
              Email Address
              <input
                required
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder="student@example.com"
              />
            </label>

            <label>
              Phone Number
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder="Enter phone number"
              />
            </label>

            <label>
              Course
              <input
                required
                maxLength={120}
                value={form.course}
                onChange={(event) =>
                  setForm({ ...form, course: event.target.value })
                }
                placeholder="e.g. B.Tech CSE AI and DS"
              />
            </label>

            <label>
              Academic Year
              <select
                required
                value={form.academicYear}
                onChange={(event) =>
                  setForm({
                    ...form,
                    academicYear: Number(event.target.value),
                  })
                }
              >
                {[1, 2, 3, 4].map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <label>Room Number</label>
              <p>Room assignment will be managed in the Rooms module.</p>
            </div>
          </div>

          <div className="student-form-actions">
            <button
              type="button"
              className="student-cancel-button"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="student-add-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Register Student'}
            </button>
          </div>
        </form>
      )}

      {studentToDelete && (
        <div className="student-delete-overlay">
          <div
            className="student-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-student-title"
          >
            <div className="student-delete-icon">
              <Trash2 size={23} />
            </div>

            <h3 id="delete-student-title">Deactivate student?</h3>
            <p>
              Are you sure you want to deactivate{' '}
              <strong>{studentToDelete.name}</strong>? The record will be
              retained in the database rather than permanently deleted.
            </p>

            <div className="student-form-actions">
              <button
                type="button"
                className="student-cancel-button"
                onClick={() => setStudentToDelete(null)}
                disabled={deactivating}
              >
                Cancel
              </button>

              <button
                type="button"
                className="student-delete-button"
                onClick={() => void confirmDeactivate()}
                disabled={deactivating}
              >
                {deactivating ? 'Deactivating...' : 'Deactivate Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="student-directory-heading">
        <div>
          <h3>Student Directory</h3>
          <p>{filteredStudents.length} student(s) found</p>
        </div>
      </div>

      <div className="student-table-wrapper">
        <table className="student-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Student ID</th>
              <th>Room</th>
              <th>Course</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>
                  <div className="student-empty-state">
                    Loading students from the database...
                  </div>
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="student-empty-state">
                    {loadError
                      ? 'Students could not be loaded. Use Retry above.'
                      : 'No students found. Try changing your search or filter.'}
                  </div>
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="student-name-cell">
                      <div className="student-avatar">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{student.name}</strong>
                        <span>{student.email}</span>
                      </div>
                    </div>
                  </td>

                  <td>{student.id}</td>
                  <td>{student.room}</td>
                  <td>{student.course}</td>

                  <td>
                    <span
                      className={`student-status ${student.status.toLowerCase()}`}
                    >
                      {student.status}
                    </span>
                  </td>

                  <td>
                    <div className="student-row-actions">
                      <button
                        type="button"
                        className="student-icon-button"
                        title={`Edit ${student.name}`}
                        aria-label={`Edit ${student.name}`}
                        onClick={() => handleEdit(student)}
                      >
                        <Pencil size={16} />
                      </button>

                      {student.status === 'Active' && (
                        <button
                          type="button"
                          className="student-icon-button student-icon-delete"
                          title={`Deactivate ${student.name}`}
                          aria-label={`Deactivate ${student.name}`}
                          onClick={() => setStudentToDelete(student)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
