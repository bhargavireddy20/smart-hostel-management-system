
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  BedDouble,
  MessageSquareWarning,
  CreditCard,
  ClipboardCheck,
  Bell,
  Search,
  ArrowUpRight,
  Building2,
  Menu,
  X,
  Megaphone,
  Clock3,
  CheckCircle2,
  LogOut,
} from 'lucide-react'

import './AdminDashboard.css'
import StudentManagement from './StudentManagement'
import RoomManagement from './RoomManagement'
import ComplaintManagement from './ComplaintManagement'
import PaymentManagement from './PaymentManagement'
import AttendanceManagement from './AttendanceManagement'
import NoticeManagement from './NoticeManagement'

type Section =
  | 'Dashboard'
  | 'Students'
  | 'Rooms'
  | 'Complaints'
  | 'Payments'
  | 'Attendance'
  | 'Notices'

type AdminDashboardProps = {
  onLogout: () => void
}

type Student = {
  name: string
  id: string
  room: string
  course: string
  status: string
}

type ApiStudent = {
  id: number
  student_id: string
  full_name: string
  email: string
  phone: string
  course: string
  academic_year: number
  is_active: boolean
  created_at?: string
}

type ApiRoom = {
  id: number
  room_number: string
  block: string
  capacity: number
  occupied: number
  available: number
  is_active: boolean
  students?: unknown[]
}

type ApiFee = {
  id: number
  student_id: string
  student_name: string
  description: string
  total_amount: number
  amount_paid: number
  balance: number
  status: string
  due_date: string
}


type ApiComplaint = {
  id: number
  complaint_number: string
  title: string
  student: string
  room: string
  category: string
  priority: 'Low' | 'Medium' | 'High'
  status: string
  date: string
}


const API_URL = 'http://127.0.0.1:8000'

const navigation: {
  label: Section
  icon: typeof LayoutDashboard
}[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Students', icon: Users },
  { label: 'Rooms', icon: BedDouble },
  { label: 'Complaints', icon: MessageSquareWarning },
  { label: 'Payments', icon: CreditCard },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Notices', icon: Megaphone },
]


function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function AdminDashboard({
  onLogout,
}: AdminDashboardProps) {
  const [activeSection, setActiveSection] =
    useState<Section>('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)

  const [complaintCount, setComplaintCount] = useState(0)
  const [complaintLoading, setComplaintLoading] = useState(true)
  const [recentComplaints, setRecentComplaints] = useState<ApiComplaint[]>([])

  const [students, setStudents] = useState<ApiStudent[]>([])
  const [rooms, setRooms] = useState<ApiRoom[]>([])
  const [fees, setFees] = useState<ApiFee[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')

  // Load complaint count from the backend.
  
useEffect(() => {
  let isMounted = true

  async function loadComplaints() {
    const token = sessionStorage.getItem('smartstay_access_token')

    try {
      if (!token) {
        throw new Error('Admin session not found. Please log in again.')
      }

      const response = await fetch(`${API_URL}/complaints/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Unable to load complaints (${response.status})`)
      }

      const data: ApiComplaint[] = await response.json()

      const unresolvedCount = data.filter(
        (complaint) =>
          complaint.status?.toLowerCase() !== 'resolved',
      ).length

      if (isMounted) {
        setComplaintCount(unresolvedCount)
        setRecentComplaints(data.slice(0, 3))
      }
    } catch (error) {
      console.error('Failed to load complaints:', error)
    } finally {
      if (isMounted) {
        setComplaintLoading(false)
      }
    }
  }

  void loadComplaints()

  return () => {
    isMounted = false
  }
}, [])


  
  // Load real students, rooms and fee records from the backend.
  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      setDashboardLoading(true)
      setDashboardError('')

      try {
        const token = sessionStorage.getItem('smartstay_access_token')

        if (!token) {
          throw new Error('Admin session not found. Please log in again.')
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        }

        const [studentsResponse, roomsResponse, feesResponse] =
          await Promise.all([
            fetch(`${API_URL}/students/`, { headers }),
            fetch(`${API_URL}/rooms/`, { headers }),
            fetch(`${API_URL}/fees/`, { headers }),
          ])

        if (!studentsResponse.ok) {
          throw new Error(
            `Unable to load students (${studentsResponse.status})`
          )
        }

        if (!roomsResponse.ok) {
          throw new Error(
            `Unable to load rooms (${roomsResponse.status})`
          )
        }

        if (!feesResponse.ok) {
          throw new Error(
            `Unable to load fee records (${feesResponse.status})`
          )
        }

        const [studentsData, roomsData, feesData] = await Promise.all([
          studentsResponse.json(),
          roomsResponse.json(),
          feesResponse.json(),
        ])

        if (
          !Array.isArray(studentsData) ||
          !Array.isArray(roomsData) ||
          !Array.isArray(feesData)
        ) {
          throw new Error('Unexpected response received from the API.')
        }

        if (isMounted) {
          setStudents(studentsData as ApiStudent[])
          setRooms(roomsData as ApiRoom[])
          setFees(feesData as ApiFee[])
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error)

        if (isMounted) {
          setDashboardError(
            error instanceof Error
              ? error.message
              : 'Failed to load dashboard data.'
          )
        }
      } finally {
        if (isMounted) {
          setDashboardLoading(false)
        }
      }
    }

    void loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [])


  function changeSection(section: Section) {
    setActiveSection(section)
    setSidebarOpen(false)
    setSearch('')
  }

  // Calculate statistics from actual API records.
  const activeStudents = students.filter(
    (student) => student.is_active,
  )

  const activeRooms = rooms.filter((room) => room.is_active)

  const occupiedBeds = activeRooms.reduce(
    (sum, room) => sum + (Number(room.occupied) || 0),
    0,
  )

  const availableBeds = activeRooms.reduce(
    (sum, room) => sum + (Number(room.available) || 0),
    0,
  )

  const totalBeds = occupiedBeds + availableBeds

  const occupancyPercentage =
    totalBeds > 0
      ? Math.round((occupiedBeds / totalBeds) * 100)
      : 0

  const totalFees = fees.reduce(
    (sum, fee) => sum + (Number(fee.total_amount) || 0),
    0,
  )

  const collectedFees = fees.reduce(
    (sum, fee) => sum + (Number(fee.amount_paid) || 0),
    0,
  )

  const pendingFees = fees.reduce(
    (sum, fee) => sum + (Number(fee.balance) || 0),
    0,
  )

  const collectionPercentage =
    totalFees > 0
      ? Math.min(
          100,
          Math.round((collectedFees / totalFees) * 100),
        )
      : 0

  const recentStudents: Student[] = [...students]
    .sort((a, b) => {
      const dateA = a.created_at
        ? new Date(a.created_at).getTime()
        : 0
      const dateB = b.created_at
        ? new Date(b.created_at).getTime()
        : 0

      return dateB - dateA
    })
    .slice(0, 4)
    .map((student) => ({
      name: student.full_name,
      id: student.student_id,
      room: '—',
      course: student.course || '—',
      status: student.is_active ? 'Active' : 'Inactive',
    }))

  return (
    <div className="admin-layout">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar ${
          sidebarOpen ? 'sidebar-open' : ''
        }`}
      >
        <div className="admin-brand">
          <span className="admin-brand-icon">
            <Building2 size={23} />
          </span>

          <span>
            <strong>SmartStay</strong>
            <small>HOSTEL MANAGEMENT</small>
          </span>

          <button
            className="mobile-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="admin-nav-label">WORKSPACE</div>

        <nav className="admin-navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`admin-nav-item ${
                activeSection === label ? 'selected' : ''
              }`}
              onClick={() => changeSection(label)}
            >
              <Icon size={19} />
              <span>{label}</span>

              {label === 'Complaints' && (
                <span className="nav-badge">
                  {complaintLoading ? '…' : complaintCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-profile">
            <div className="profile-avatar">WA</div>

            <div className="profile-details">
              <strong>Warden Admin</strong>
              <span>Administrator</span>
            </div>
          </div>

          <button className="logout-button" onClick={onLogout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-heading">
            <button
              className="mobile-menu"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="admin-breadcrumb">
                Workspace / {activeSection}
              </p>
              <h1>{activeSection}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="admin-search">
              <Search size={17} />

              <input
                aria-label="Search students"
                placeholder="Search students..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setActiveSection('Students')
                }}
              />

              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  <X size={15} />
                </button>
              )}
            </label>

            <div className="notification-wrap">
              <button
                className="notification-button"
                aria-label="Toggle notifications"
                aria-expanded={showNotifications}
                onClick={() =>
                  setShowNotifications((current) => !current)
                }
              >
                <Bell size={19} />
                <span />
              </button>

              {showNotifications && (
                <div className="notification-popover">
                  <strong>Notifications</strong>

                  <p>
                    <MessageSquareWarning size={16} />
                    {complaintLoading
                      ? 'Loading complaint count...'
                      : `${complaintCount} unresolved complaints need review.`}
                  </p>

                  <p>
                    <CreditCard size={16} />
                    {dashboardLoading
                      ? 'Loading fee information...'
                      : `${formatCurrency(pendingFees)} in pending fees.`}
                  </p>

                  <p className="notification-note">
                    Counts from live records where available
                  </p>
                </div>
              )}
            </div>

            <div className="topbar-avatar">WA</div>
          </div>
        </header>

        {activeSection === 'Dashboard' ? (
          <div className="admin-content">
            <section className="admin-welcome">
              <div>
                <span className="welcome-eyebrow">
                  HOSTEL OVERVIEW
                </span>

                <h2>Good day, Warden!</h2>

                <p>
                  Here’s what’s happening at your hostel today.
                </p>

                <span className="demo-label">
                  LIVE DASHBOARD STATISTICS
                </span>
              </div>

              <div className="welcome-art">
                <Building2 size={108} />
              </div>
            </section>

            {dashboardError && (
              <div role="alert" className="dashboard-error">
                {dashboardError}
                <p>
                  Check that the FastAPI backend is running and its
                  endpoints are available.
                </p>
              </div>
            )}

            <section className="admin-stats">
              <article className="admin-stat-card">
                <div className="stat-heading">
                  <span>Total students</span>
                  <span className="stat-icon purple">
                    <Users size={20} />
                  </span>
                </div>

                <strong>
                  {dashboardLoading ? '…' : activeStudents.length}
                </strong>

                <p>
                  <ArrowUpRight size={15} />
                  Active registered students
                </p>
              </article>

              <article className="admin-stat-card">
                <div className="stat-heading">
                  <span>Total rooms</span>
                  <span className="stat-icon teal">
                    <BedDouble size={20} />
                  </span>
                </div>

                <strong>
                  {dashboardLoading ? '…' : activeRooms.length}
                </strong>

                <p>Active rooms in the hostel</p>
              </article>

              <article className="admin-stat-card">
                <div className="stat-heading">
                  <span>Occupancy</span>
                  <span className="stat-icon blue">
                    <Building2 size={20} />
                  </span>
                </div>

                <strong>
                  {dashboardLoading ? '…' : `${occupancyPercentage}%`}
                </strong>

                <p>
                  {dashboardLoading
                    ? 'Loading bed allocation...'
                    : `${occupiedBeds} occupied of ${totalBeds} beds`}
                </p>
              </article>

              <article className="admin-stat-card">
                <div className="stat-heading">
                  <span>Open complaints</span>
                  <span className="stat-icon amber">
                    <MessageSquareWarning size={20} />
                  </span>
                </div>

                <strong>
                  {complaintLoading ? '…' : complaintCount}
                </strong>

                <p>Open and in-progress complaints</p>
              </article>
            </section>

            <section className="admin-dashboard-grid">
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h3>Room occupancy</h3>
                    <p>Current bed allocation</p>
                  </div>

                  <span className="panel-tag">Live data</span>
                </div>

                <div className="occupancy-layout">
                  <div
                    className="occupancy-chart"
                    style={{
                      background: `conic-gradient(#4f46e5 ${
                        occupancyPercentage * 3.6
                      }deg, #e5e7eb ${
                        occupancyPercentage * 3.6
                      }deg)`,
                    }}
                  >
                    <div>
                      <strong>
                        {dashboardLoading
                          ? '…'
                          : `${occupancyPercentage}%`}
                      </strong>
                      <span>Occupied</span>
                    </div>
                  </div>

                  <div className="occupancy-legend">
                    <p>
                      <span className="legend-mark occupied-mark" />
                      Occupied{' '}
                      <strong>
                        {dashboardLoading ? '…' : occupiedBeds}
                      </strong>
                    </p>

                    <p>
                      <span className="legend-mark available-mark" />
                      Available{' '}
                      <strong>
                        {dashboardLoading ? '…' : availableBeds}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="occupancy-footnote">
                  Calculated from active rooms and their bed allocations.
                </div>
              </article>

              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h3>Recent complaints</h3>
                    <p>Preview · connect to live records next</p>
                  </div>

                  <button
                    className="admin-text-button"
                    onClick={() => changeSection('Complaints')}
                  >
                    View all →
                  </button>
                </div>

                
<div className="complaint-list">
  {complaintLoading ? (
    <p>Loading complaints...</p>
  ) : recentComplaints.length === 0 ? (
    <p>No complaints available.</p>
  ) : (
    recentComplaints.map((complaint) => (
      <div
        className="admin-complaint"
        key={complaint.id}
      >
        <div className="complaint-symbol">
          <MessageSquareWarning size={18} />
        </div>

        <div className="complaint-description">
          <strong>{complaint.title}</strong>
          <span>
            Room {complaint.room} · {complaint.student}
          </span>
        </div>

        <span
          className={`status-pill ${
            complaint.status.toLowerCase().replace(' ', '-')
          }`}
        >
          {complaint.status}
        </span>
      </div>
    ))
  )}
</div>

              </article>
            </section>

            <section className="admin-panel registrations-panel">
              <div className="admin-panel-heading">
                <div>
                  <h3>Recent student registrations</h3>
                  <p>Latest registered students · live records</p>
                </div>

                <button
                  className="admin-text-button"
                  onClick={() => changeSection('Students')}
                >
                  View students →
                </button>
              </div>

              {dashboardLoading ? (
                <p>Loading students...</p>
              ) : recentStudents.length > 0 ? (
                <StudentTable rows={recentStudents.slice(0, 3)} />
              ) : (
                <p>No student records found.</p>
              )}
            </section>

            <section className="admin-dashboard-grid lower-grid">
              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h3>Fee collection</h3>
                    <p>Totals from fee records</p>
                  </div>

                  <CreditCard
                    size={20}
                    className="panel-heading-icon"
                  />
                </div>

                <div className="fee-total">
                  {dashboardLoading ? '…' : formatCurrency(collectedFees)}
                </div>

                <div className="fee-progress">
                  <span
                    style={{
                      width: `${collectionPercentage}%`,
                    }}
                  />
                </div>

                <div className="fee-meta">
                  <span>Collected</span>
                  <strong>
                    {dashboardLoading
                      ? '…'
                      : `${collectionPercentage}%`}
                  </strong>
                </div>

                <div className="fee-meta">
                  <span>Total fees</span>
                  <strong>
                    {dashboardLoading ? '…' : formatCurrency(totalFees)}
                  </strong>
                </div>

                <div className="fee-meta">
                  <span>Pending amount</span>
                  <strong>
                    {dashboardLoading ? '…' : formatCurrency(pendingFees)}
                  </strong>
                </div>
              </article>

              <article className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <h3>Notice board</h3>
                    <p>Demo previews · live notices next</p>
                  </div>

                  <Megaphone
                    size={20}
                    className="panel-heading-icon"
                  />
                </div>

                <div className="notice-item">
                  <span className="notice-dot" />
                  <div>
                    <strong>Hostel meeting</strong>
                    <p>
                      <Clock3 size={13} />
                      Tomorrow · 5:00 PM
                    </p>
                  </div>
                </div>

                <div className="notice-item">
                  <span className="notice-dot teal-dot" />
                  <div>
                    <strong>Monthly room inspection</strong>
                    <p>
                      <Clock3 size={13} />
                      Friday · 10:00 AM
                    </p>
                  </div>
                </div>

                <button
                  className="admin-text-button notice-link"
                  onClick={() => changeSection('Notices')}
                >
                  View all notices →
                </button>
              </article>
            </section>
          </div>
        ) : activeSection === 'Students' ? (
          <StudentManagement />
        ) : activeSection === 'Rooms' ? (
          <RoomManagement />
        ) : activeSection === 'Complaints' ? (
          <ComplaintManagement />
        ) : activeSection === 'Payments' ? (
          <PaymentManagement />
        ) : activeSection === 'Attendance' ? (
  <AttendanceManagement />
) : activeSection === 'Notices' ? (
  <NoticeManagement />
) : (
          <section className="admin-panel module-panel">
            <div className="module-icon">
              <CheckCircle2 size={30} />
            </div>

            <h2>{activeSection} management</h2>

            <p>
              This section is connected to dashboard navigation.
              We’ll implement its management features next.
            </p>

            <button
              className="module-back-button"
              onClick={() => changeSection('Dashboard')}
            >
              Back to dashboard
            </button>
          </section>
        )}

        <footer className="admin-footer">
          SmartStay · Smart hostel living, made simpler. ·
          Development preview
        </footer>
      </main>
    </div>
  )
}

function StudentTable({ rows }: { rows: Student[] }) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>STUDENT</th>
            <th>STUDENT ID</th>
            <th>ROOM</th>
            <th>COURSE</th>
            <th>STATUS</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((student) => (
            <tr key={student.id}>
              <td>
                <strong>{student.name}</strong>
              </td>
              <td>{student.id}</td>
              <td>{student.room}</td>
              <td>{student.course}</td>
              <td>
                <span
                  className={`status-pill ${
                    student.status === 'Active'
                      ? 'resolved'
                      : 'pending'
                  }`}
                >
                  {student.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
