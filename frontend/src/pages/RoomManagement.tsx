
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus,
  Search,
  X,
  BedDouble,
  Users,
  CheckCircle2,
  UserPlus,
  RefreshCw,
  UserMinus,
  Pencil,
} from 'lucide-react'

const API = 'http://127.0.0.1:8000'

type ApiStudent = {
  student_id: string
  full_name: string
  email: string
  course: string
}

type ApiRoom = {
  id: number
  room_number: string
  block: string
  capacity: number
  occupied: number
  available: number
  is_active: boolean
  students: ApiStudent[]
}

type RoomStatus = 'Available' | 'Occupied' | 'Maintenance'
type RoomType = 'Single' | 'Double' | 'Triple'

type Room = {
  id: number
  number: string
  block: string
  capacity: number
  status: RoomStatus
  assignedStudents: ApiStudent[]
}

type RoomForm = {
  number: string
  block: string
  type: RoomType
  capacity: number
}

const emptyForm: RoomForm = {
  number: '',
  block: 'A',
  type: 'Double',
  capacity: 2,
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
      'Cannot connect to SmartStay API. Check that the backend is running.',
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
      // Keep the HTTP error message if the response is not JSON.
    }

    throw new Error(detail)
  }

  return response.json() as Promise<T>
}

function toRoom(room: ApiRoom): Room {
  const prefix = `${room.block}-`

  // Some existing database room numbers use a different block prefix.
  // Normalize the display without modifying the database.
  const number = room.room_number.startsWith(prefix)
    ? room.room_number.slice(prefix.length)
    : /^[A-Z]-/.test(room.room_number)
      ? room.room_number.slice(2)
      : room.room_number

  return {
    id: room.id,
    number,
    block: room.block,
    capacity: room.capacity,
    status: !room.is_active
      ? 'Maintenance'
      : room.occupied === 0
        ? 'Available'
        : 'Occupied',
    assignedStudents: room.students,
  }
}

function getRoomStatus(room: Room): RoomStatus {
  if (room.status === 'Maintenance') return 'Maintenance'

  return room.assignedStudents.length === 0 ? 'Available' : 'Occupied'
}

function getRoomType(capacity: number): RoomType {
  if (capacity === 1) return 'Single'
  if (capacity === 3) return 'Triple'
  return 'Double'
}

export default function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [eligibleStudents, setEligibleStudents] = useState<ApiStudent[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const [showForm, setShowForm] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null)

  const [showAssignForm, setShowAssignForm] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<RoomForm>({ ...emptyForm })

  const loadRooms = useCallback(async () => {
    setLoading(true)

    try {
      const data = await apiRequest<ApiRoom[]>('/rooms/')
      setRooms(data.map(toRoom))
      setMessage('')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to load rooms.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEligibleStudents = useCallback(async () => {
    try {
      const data = await apiRequest<ApiStudent[]>(
        '/rooms/eligible-students/',
      )
      setEligibleStudents(data)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load eligible students.',
      )
    }
  }, [])

  useEffect(() => {
    void loadRooms()
    void loadEligibleStudents()
  }, [loadRooms, loadEligibleStudents])

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const text =
          `${room.number} ${room.block} ${room.id}`.toLowerCase()

        const matchesSearch = text.includes(search.toLowerCase())
        const matchesStatus =
          statusFilter === 'All' || getRoomStatus(room) === statusFilter

        return matchesSearch && matchesStatus
      }),
    [rooms, search, statusFilter],
  )

  const totalCapacity = rooms.reduce(
    (sum, room) => sum + room.capacity,
    0,
  )

  const occupiedBeds = rooms.reduce(
    (sum, room) => sum + room.assignedStudents.length,
    0,
  )

  const availableBeds = rooms.reduce(
    (sum, room) =>
      sum +
      (room.status === 'Maintenance'
        ? 0
        : Math.max(0, room.capacity - room.assignedStudents.length)),
    0,
  )

  const assignableRooms = rooms.filter(
    (room) =>
      room.status !== 'Maintenance' &&
      room.assignedStudents.length < room.capacity,
  )

  function openAddForm() {
    setEditingRoomId(null)
    setForm({ ...emptyForm })
    setMessage('')
    setShowForm(true)
  }

  function openEditForm(room: Room) {
    setEditingRoomId(room.id)

    setForm({
      number: room.number,
      block: room.block,
      type: getRoomType(room.capacity),
      capacity: room.capacity,
    })

    setMessage('')
    setShowForm(true)
  }

  function closeRoomForm() {
    setShowForm(false)
    setEditingRoomId(null)
    setForm({ ...emptyForm })
  }

  function openAssignForm() {
    setSelectedRoomId('')
    setSelectedStudentId('')
    setMessage('')
    setShowAssignForm(true)
    void loadEligibleStudents()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const number = form.number.trim()
    const block = form.block.trim()

    if (!number || !block) {
      setMessage('Enter a room number and select a block.')
      return
    }

    if (!Number.isInteger(form.capacity) || form.capacity < 1 || form.capacity > 20) {
      setMessage('Bed capacity must be a whole number between 1 and 20.')
      return
    }

    const duplicate = rooms.some(
      (room) =>
        room.id !== editingRoomId &&
        room.number.toLowerCase() === number.toLowerCase() &&
        room.block.toLowerCase() === block.toLowerCase(),
    )

    if (duplicate) {
      setMessage('This room already exists in the database.')
      return
    }

    setSaving(true)

    const payload = {
      room_number: `${block}-${number}`,
      block,
      capacity: form.capacity,
    }

    try {
      if (editingRoomId !== null) {
        await apiRequest<ApiRoom>(`/rooms/${editingRoomId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await apiRequest<ApiRoom>('/rooms/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      const wasEditing = editingRoomId !== null

      await loadRooms()
      closeRoomForm()

      setMessage(
        wasEditing
          ? 'Room updated successfully in PostgreSQL.'
          : 'Room created successfully in PostgreSQL.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : editingRoomId !== null
            ? 'Failed to update room.'
            : 'Failed to create room.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!selectedRoomId || !selectedStudentId) {
      setMessage('Select a room and a registered student.')
      return
    }

    setSaving(true)

    try {
      await apiRequest<ApiRoom>(`/rooms/${selectedRoomId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ student_id: selectedStudentId }),
      })

      const assignedStudent = eligibleStudents.find(
        (student) => student.student_id === selectedStudentId,
      )

      const assignedRoom = rooms.find(
        (room) => room.id === Number(selectedRoomId),
      )

      await Promise.all([loadRooms(), loadEligibleStudents()])

      setShowAssignForm(false)
      setSelectedRoomId('')
      setSelectedStudentId('')

      setMessage(
        assignedStudent && assignedRoom
          ? `${assignedStudent.full_name} assigned to ${assignedRoom.block}-${assignedRoom.number}.`
          : 'Student assigned successfully.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to assign student.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleUnassign(room: Room, student: ApiStudent) {
    const confirmed = window.confirm(
      `Unassign ${student.full_name} from ${room.block}-${room.number}?`,
    )

    if (!confirmed) return

    setMessage('')
    setSaving(true)

    try {
      await apiRequest<ApiRoom>(
        `/rooms/${room.id}/unassign/${encodeURIComponent(student.student_id)}`,
        { method: 'POST' },
      )

      await Promise.all([loadRooms(), loadEligibleStudents()])
      setMessage(`${student.full_name} has been unassigned.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to unassign student.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="room-management">
      <div className="student-page-heading">
        <div>
          <h2>Room Management</h2>
          <p>
            Manage rooms, assign registered students, and track bed
            availability.
          </p>
        </div>

        <div className="room-header-actions">
          <button
            type="button"
            className="student-add-button"
            onClick={openAssignForm}
          >
            <UserPlus size={18} />
            Assign Student
          </button>

          <button
            type="button"
            className="student-add-button"
            onClick={openAddForm}
          >
            <Plus size={18} />
            Add Room
          </button>
        </div>
      </div>

      <div className="student-summary">
        <div className="student-summary-card">
          <BedDouble size={21} />
          <div>
            <span>Total Rooms</span>
            <strong>{rooms.length}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <Users size={21} />
          <div>
            <span>Occupied Beds</span>
            <strong>{occupiedBeds}/{totalCapacity}</strong>
          </div>
        </div>

        <div className="student-summary-card">
          <CheckCircle2 size={21} />
          <div>
            <span>Available Beds</span>
            <strong>{availableBeds}</strong>
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

      <div className="student-toolbar">
        <label className="student-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search rooms..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="student-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by room status"
        >
          <option value="All">All statuses</option>
          <option value="Available">Available</option>
          <option value="Occupied">Occupied</option>
          <option value="Maintenance">Maintenance</option>
        </select>

        <button
          type="button"
          className="student-cancel-button"
          onClick={() => {
            void loadRooms()
            void loadEligibleStudents()
          }}
          disabled={loading || saving}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {showForm && (
        <form className="student-add-form" onSubmit={handleSubmit}>
          <div className="student-form-heading">
            <h3>{editingRoomId !== null ? 'Edit Room' : 'Add New Room'}</h3>

            <button
              type="button"
              className="student-close-button"
              onClick={closeRoomForm}
              aria-label="Close form"
              disabled={saving}
            >
              <X size={18} />
            </button>
          </div>

          <div className="student-form-grid">
            <label>
              Room Number
              <input
                required
                value={form.number}
                onChange={(event) =>
                  setForm({ ...form, number: event.target.value })
                }
                placeholder="e.g. 104"
              />
            </label>

            <label>
              Block
              <select
                value={form.block}
                onChange={(event) =>
                  setForm({ ...form, block: event.target.value })
                }
              >
                <option value="A">Block A</option>
                <option value="B">Block B</option>
                <option value="C">Block C</option>
                <option value="D">Block D</option>
              </select>
            </label>

            <label>
              Room Type
              <select
                value={form.type}
                onChange={(event) => {
                  const type = event.target.value as RoomType
                  const capacity =
                    type === 'Single' ? 1 : type === 'Double' ? 2 : 3

                  setForm({ ...form, type, capacity })
                }}
              >
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Triple">Triple</option>
              </select>
            </label>

            <label>
              Bed Capacity
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                required
                value={form.capacity}
                onChange={(event) =>
                  setForm({ ...form, capacity: Number(event.target.value) })
                }
              />
            </label>
          </div>

          <p className="student-form-hint">
            Room type and capacity are saved. Monthly fees and maintenance
            status are not yet supported by the backend.
          </p>

          <div className="student-form-actions">
            <button
              type="button"
              className="student-cancel-button"
              onClick={closeRoomForm}
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
                : editingRoomId !== null
                  ? 'Save Changes'
                  : 'Add Room'}
            </button>
          </div>
        </form>
      )}

      {showAssignForm && (
        <form className="student-add-form" onSubmit={handleAssignStudent}>
          <div className="student-form-heading">
            <h3>Assign Student to Room</h3>

            <button
              type="button"
              className="student-close-button"
              onClick={() => setShowAssignForm(false)}
              aria-label="Close assignment form"
              disabled={saving}
            >
              <X size={18} />
            </button>
          </div>

          <div className="student-form-grid">
            <label>
              Room
              <select
                required
                value={selectedRoomId}
                onChange={(event) => setSelectedRoomId(event.target.value)}
              >
                <option value="">Select a room</option>

                {assignableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.block}-{room.number} —{' '}
                    {room.capacity - room.assignedStudents.length} bed(s) free
                  </option>
                ))}
              </select>
            </label>

            <label>
              Registered Student
              <select
                required
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
              >
                <option value="">Select a student</option>

                {eligibleStudents.map((student) => (
                  <option
                    key={student.student_id}
                    value={student.student_id}
                  >
                    {student.full_name} ({student.student_id})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedRoomId && (
            <p className="student-form-hint">
              Current occupancy:{' '}
              {rooms.find((room) => room.id === Number(selectedRoomId))
                ?.assignedStudents.length ?? 0}
              /
              {rooms.find((room) => room.id === Number(selectedRoomId))
                ?.capacity ?? 0}{' '}
              beds
            </p>
          )}

          {eligibleStudents.length === 0 && (
            <p className="student-form-error">
              No eligible students found. Register a student or check their
              current room assignment.
            </p>
          )}

          {assignableRooms.length === 0 && (
            <p className="student-form-error">
              No rooms currently have available beds.
            </p>
          )}

          <div className="student-form-actions">
            <button
              type="button"
              className="student-cancel-button"
              onClick={() => setShowAssignForm(false)}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="student-add-button"
              disabled={
                saving ||
                eligibleStudents.length === 0 ||
                assignableRooms.length === 0
              }
            >
              {saving ? 'Saving...' : 'Assign Student'}
            </button>
          </div>
        </form>
      )}

      <div className="student-directory-heading">
        <div>
          <h3>Room Directory</h3>
          <p>{filteredRooms.length} room(s) found</p>
        </div>
      </div>

      <div className="student-table-wrapper">
        <table className="student-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              <th>Assigned Students</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>
                  <div className="student-empty-state">Loading rooms...</div>
                </td>
              </tr>
            ) : filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="student-empty-state">No rooms found.</div>
                </td>
              </tr>
            ) : (
              filteredRooms.map((room) => (
                <tr key={room.id}>
                  <td>
                    <strong>{room.block}-{room.number}</strong>
                  </td>

                  <td>{getRoomType(room.capacity)}</td>

                  <td>
                    {room.assignedStudents.length === 0 ? (
                      <span>None assigned</span>
                    ) : (
                      <div className="room-assigned-students">
                        {room.assignedStudents.map((student) => (
                          <div
                            className="room-assigned-student"
                            key={student.student_id}
                          >
                            <span>{student.full_name}</span>

                            <button
                              type="button"
                              className="student-icon-button"
                              title={`Unassign ${student.full_name}`}
                              aria-label={`Unassign ${student.full_name}`}
                              disabled={saving}
                              onClick={() => void handleUnassign(room, student)}
                            >
                              <UserMinus size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  <td>
                    {room.assignedStudents.length}/{room.capacity} beds
                  </td>

                  <td>
                    <span
                      className={`student-status ${getRoomStatus(room).toLowerCase()}`}
                    >
                      {getRoomStatus(room)}
                    </span>
                  </td>

                  <td>
                    <div className="room-header-actions">
                      <button
                        type="button"
                        className="student-cancel-button"
                        onClick={() => openEditForm(room)}
                        disabled={saving}
                        title={`Edit room ${room.block}-${room.number}`}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
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
