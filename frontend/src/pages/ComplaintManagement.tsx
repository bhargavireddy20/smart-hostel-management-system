
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus,
  Search,
  X,
  MessageSquareWarning,
  Clock,
  CheckCircle2,
  Pencil,
  RefreshCw,
} from 'lucide-react'

type ComplaintStatus = 'Open' | 'In Progress' | 'Resolved'
type Priority = 'Low' | 'Medium' | 'High'

type Complaint = {
  dbId: number
  id: string
  studentId: string
  title: string
  student: string
  room: string
  category: string
  priority: Priority
  status: ComplaintStatus
  date: string
  description: string
}

type ApiComplaint = {
  id: number
  complaint_number: string
  student_id: string | null
  student: string
  room: string
  title: string
  description: string
  category: string
  priority: Priority
  status: ComplaintStatus
  date: string
  created_at: string
  updated_at: string
}

type ApiStudent = {
  id: number
  student_id: string
  full_name: string
  is_active: boolean
}

type ComplaintForm = {
  title: string
  studentId: string
  category: string
  priority: Priority
  status: ComplaintStatus
  description: string
}

const API_URL = 'http://127.0.0.1:8000'

const emptyForm: ComplaintForm = {
  title: '',
  studentId: '',
  category: 'Plumbing',
  priority: 'Medium',
  status: 'Open',
  description: '',
}


async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem('smartstay_access_token')
  const role = sessionStorage.getItem('smartstay_role')

  if (!token) {
    throw new Error('Session expired. Please log in again.')
  }

  if (role !== 'admin') {
    throw new Error('Admin access is required.')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail

    const errorMessage = Array.isArray(detail)
      ? detail
          .map((item: { msg?: string }) => item.msg ?? 'Invalid input')
          .join(', ')
      : typeof detail === 'string'
        ? detail
        : `Request failed with status ${response.status}`

    throw new Error(errorMessage)
  }

  return response.json() as Promise<T>
}


export default function ComplaintManagement() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [students, setStudents] = useState<ApiStudent[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<ComplaintForm>({
    ...emptyForm,
  })

  // Load real complaints from the FastAPI backend.
  async function loadComplaints() {
    setLoading(true)
    setError('')

    try {
      const data = await apiRequest<ApiComplaint[]>('/complaints/')

      const mappedComplaints: Complaint[] = data.map((item) => ({
        dbId: item.id,
        id: item.complaint_number,
        studentId: item.student_id ?? '',
        title: item.title,
        student: item.student,
        room: item.room || 'Unassigned',
        category: item.category,
        priority: item.priority,
        status: item.status,
        date: item.date,
        description: item.description,
      }))

      setComplaints(mappedComplaints)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load complaints.',
      )
    } finally {
      setLoading(false)
    }
  }

  // Load students for the complaint creation form.
  async function loadStudents() {
    try {
      const data = await apiRequest<ApiStudent[]>('/students/')

      setStudents(
        data.filter((student) => student.is_active),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to load students: ${err.message}`
          : 'Unable to load students.',
      )
    }
  }

  useEffect(() => {
    void loadComplaints()
    void loadStudents()
  }, [])

  // Search and filter complaints.
  const filteredComplaints = useMemo(
    () =>
      complaints.filter((complaint) => {
        const searchText = [
          complaint.id,
          complaint.title,
          complaint.student,
          complaint.studentId,
          complaint.room,
          complaint.category,
        ]
          .join(' ')
          .toLowerCase()

        return (
          searchText.includes(search.toLowerCase()) &&
          (statusFilter === 'All' ||
            complaint.status === statusFilter) &&
          (priorityFilter === 'All' ||
            complaint.priority === priorityFilter)
        )
      }),
    [complaints, search, statusFilter, priorityFilter],
  )

  const openCount = complaints.filter(
    (complaint) => complaint.status === 'Open',
  ).length

  const progressCount = complaints.filter(
    (complaint) => complaint.status === 'In Progress',
  ).length

  const resolvedCount = complaints.filter(
    (complaint) => complaint.status === 'Resolved',
  ).length

  function openAddForm() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function openEditForm(complaint: Complaint) {
    setEditingId(complaint.dbId)

    setForm({
      title: complaint.title,
      studentId: complaint.studentId,
      category: complaint.category,
      priority: complaint.priority,
      status: complaint.status,
      description: complaint.description,
    })

    setMessage('')
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  // Create a complaint or persist edits to an existing complaint.
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')
    setMessage('')

    try {
      if (editingId !== null) {
        await apiRequest<ApiComplaint>(
          `/complaints/${editingId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              title: form.title.trim(),
              description: form.description.trim(),
              category: form.category,
              priority: form.priority,
              status: form.status,
            }),
          },
        )

        setMessage('Complaint updated successfully.')
      } else {
        if (!form.studentId) {
          throw new Error('Please select a student.')
        }

        await apiRequest<ApiComplaint>('/complaints/', {
          method: 'POST',
          body: JSON.stringify({
            student_id: form.studentId,
            title: form.title.trim(),
            description: form.description.trim(),
            category: form.category,
            priority: form.priority,
          }),
        })

        setMessage('Complaint created successfully.')
      }

      closeForm()
      await loadComplaints()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save complaint.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="complaint-management">
      <div className="student-page-heading">
        <div>
          <h2>Complaints Management</h2>
          <p>Track, prioritize and resolve hostel complaints.</p>
        </div>

        <button
          type="button"
          className="student-add-button"
          onClick={openAddForm}
        >
          <Plus size={18} />
          New Complaint
        </button>
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

      {error && (
        <div className="student-message" role="alert">
          {error}
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="student-summary">
        <div className="student-summary-card">
          <MessageSquareWarning size={21} />
          <div>
            <span>Total Complaints</span>
            <strong>{complaints.length}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <Clock size={21} />
          <div>
            <span>Open / In Progress</span>
            <strong>{openCount + progressCount}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <CheckCircle2 size={21} />
          <div>
            <span>Resolved</span>
            <strong>{resolvedCount}</strong>
          </div>
        </div>
      </div>

      {showForm && (
        <form
          className="student-add-form"
          onSubmit={handleSubmit}
        >
          <div className="student-form-heading">
            <h3>
              {editingId !== null
                ? 'Edit Complaint'
                : 'Create Complaint'}
            </h3>

            <button
              type="button"
              className="student-close-button"
              onClick={closeForm}
              aria-label="Close form"
              disabled={saving}
            >
              <X size={18} />
            </button>
          </div>

          <div className="student-form-grid">
            <label>
              Complaint Title
              <input
                required
                maxLength={150}
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title: event.target.value,
                  })
                }
                placeholder="Briefly describe the issue"
              />
            </label>

            <label>
              Student
              <select
                required
                value={form.studentId}
                disabled={editingId !== null || saving}
                onChange={(event) =>
                  setForm({
                    ...form,
                    studentId: event.target.value,
                  })
                }
              >
                <option value="">Select a student</option>

                {students.map((student) => (
                  <option
                    key={student.id}
                    value={student.student_id}
                  >
                    {student.full_name} ({student.student_id})
                  </option>
                ))}
              </select>

              {editingId !== null && (
                <small>
                  The linked student cannot be changed here.
                </small>
              )}

              {students.length === 0 &&
                editingId === null && (
                  <small>
                    No active students found. Check the Students API.
                  </small>
                )}
            </label>

            <label>
              Category
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value,
                  })
                }
              >
                <option>Plumbing</option>
                <option>Electrical</option>
                <option>Internet</option>
                <option>Cleaning</option>
                <option>Furniture</option>
                <option>Security</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Priority
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({
                    ...form,
                    priority: event.target.value as Priority,
                  })
                }
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>

            {editingId !== null && (
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as ComplaintStatus,
                    })
                  }
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </label>
            )}

            <label className="complaint-description-field">
              Description
              <textarea
                required
                maxLength={2000}
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
                placeholder="Explain the problem..."
              />
            </label>
          </div>

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
              {saving
                ? 'Saving...'
                : editingId !== null
                  ? 'Save Changes'
                  : 'Create Complaint'}
            </button>
          </div>
        </form>
      )}

      <div className="student-directory-heading">
        <div>
          <h3>Complaint Directory</h3>
          <p>
            {filteredComplaints.length} complaint(s) found
          </p>
        </div>

        <button
          type="button"
          className="student-icon-button"
          title="Refresh complaints"
          aria-label="Refresh complaints"
          onClick={() => void loadComplaints()}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? 'spin' : ''}
          />
        </button>
      </div>

      <div className="student-toolbar">
        <label className="student-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search complaints..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </label>

        <select
          className="student-status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          <option value="Open">Pending</option>
          <option value="In Progress">Still in progress</option>
          <option value="Resolved">Resolved</option>
        </select>

        <select
          className="student-status-filter"
          value={priorityFilter}
          onChange={(event) =>
            setPriorityFilter(event.target.value)
          }
          aria-label="Filter by priority"
        >
          <option value="All">All priorities</option>
          <option value="High">High priority</option>
          <option value="Medium">Medium priority</option>
          <option value="Low">Low priority</option>
        </select>
      </div>

      <div className="student-table-wrapper">
        <table className="student-table complaint-table">
          <thead>
            <tr>
              <th>Complaint</th>
              <th>Student / Room</th>
              <th>Priority</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6}>
                  <div className="student-empty-state">
                    Loading complaints...
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              filteredComplaints.map((complaint) => (
                <tr key={complaint.dbId}>
                  <td>
                    <div className="complaint-title-cell">
                      <strong>{complaint.title}</strong>
                      <span>
                        {complaint.id} · {complaint.category}
                      </span>
                    </div>
                  </td>

                  <td>
                    <div className="complaint-title-cell">
                      <strong>{complaint.student}</strong>
                      <span>
                        {complaint.studentId
                          ? `${complaint.studentId} · `
                          : ''}
                        Room {complaint.room}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`complaint-priority ${complaint.priority.toLowerCase()}`}
                    >
                      {complaint.priority}
                    </span>
                  </td>

                  <td>{complaint.date}</td>

                  <td>
                    <span
                      className={`complaint-status ${complaint.status
                        .toLowerCase()
                        .replace(' ', '-')}`}
                    >
                      {complaint.status}
                    </span>
                  </td>

                  <td>
                    <div className="student-row-actions">
                      <button
                        type="button"
                        className="student-icon-button"
                        title="Edit complaint"
                        aria-label={`Edit ${complaint.title}`}
                        onClick={() =>
                          openEditForm(complaint)
                        }
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

            {!loading &&
              !error &&
              filteredComplaints.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="student-empty-state">
                      No complaints found.
                    </div>
                  </td>
                </tr>
              )}

            {!loading &&
              error &&
              complaints.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="student-empty-state">
                      Unable to load complaints. Check the error
                      message above and refresh after fixing it.
                    </div>
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
