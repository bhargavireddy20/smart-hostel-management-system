import { useEffect, useState } from 'react'
import {
  Bell,
  BedDouble,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  UserRound,
  Wallet,
  Building2,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react'

type StudentDashboardProps = {
  onLogout: () => void
}

type StudentProfile = {
  id: number
  student_id: string
  full_name: string
  email: string
  phone: string | null
  course: string
  academic_year: number
  is_active: boolean
  created_at: string
}

type MyRoom = {
  assigned: boolean
  message: string
  room_number?: string | null
  block?: string | null
  capacity?: number | null
  occupied?: number | null
  available?: number | null
  is_active?: boolean | null
}

type AttendanceRecord = {
  attendance_date: string
  status: 'Present' | 'Absent' | 'Leave'
  note: string | null
  is_locked: boolean
  locked_at: string | null
}

type AttendanceResponse = {
  student_id: string
  student_name: string
  start_date: string
  end_date: string
  total_recorded: number
  records: AttendanceRecord[]
}

type FeePayment = {
  id: number
  amount: number
  payment_date: string
  payment_method: string
  reference: string | null
}

type StudentFee = {
  id: number
  student_id: string
  student_name: string
  description: string
  total_amount: number
  amount_paid: number
  balance: number
  due_date: string
  status: 'Paid' | 'Partially Paid' | 'Pending'
  payments: FeePayment[]
}

type StudentComplaint = {
  id: number
  complaint_number: string
  student_id: string
  student: string
  room: string | null
  title: string
  description: string
  category: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'Open' | 'In Progress' | 'Resolved'
  date: string
  created_at: string
  updated_at: string
}

type StudentNotice = {
  id: number
  title: string
  content: string
  audience: string
  priority: string
  publish_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

type ComplaintForm = {
  title: string
  description: string
  category: string
  priority: 'Low' | 'Medium' | 'High'
}

const sections = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'My Profile', icon: UserRound },
  { name: 'My Room', icon: BedDouble },
  { name: 'Attendance', icon: CalendarCheck },
  { name: 'Fees & Payments', icon: Wallet },
  { name: 'Complaints', icon: MessageSquare },
  { name: 'Notices', icon: Bell },
]

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthRange(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()

  return {
    start: formatDate(new Date(year, month, 1)),
    end: formatDate(new Date(year, month + 1, 0)),
  }
}

function formatDisplayDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  )
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPaymentDate(value: string): string {
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

export default function StudentDashboard({
  onLogout,
}: StudentDashboardProps) {
  const [activeSection, setActiveSection] = useState('Dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [room, setRoom] = useState<MyRoom | null>(null)
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomError, setRoomError] = useState('')

  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )

  const [attendance, setAttendance] =
    useState<AttendanceResponse | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')

  const [fees, setFees] = useState<StudentFee[]>([])
  const [feesLoading, setFeesLoading] = useState(false)
  const [feesError, setFeesError] = useState('')

  // STUDENT COMPLAINTS
const [complaints, setComplaints] = useState<StudentComplaint[]>([])
const [complaintsLoading, setComplaintsLoading] = useState(false)
const [complaintsError, setComplaintsError] = useState('')
const [complaintMessage, setComplaintMessage] = useState('')
const [complaintSubmitting, setComplaintSubmitting] = useState(false)

const [notices, setNotices] = useState<StudentNotice[]>([])
const [noticesLoading, setNoticesLoading] = useState(false)
const [noticesError, setNoticesError] = useState('')

const [complaintForm, setComplaintForm] = useState<ComplaintForm>({
  title: '',
  description: '',
  category: 'Maintenance',
  priority: 'Medium',
})

  const sidebarWidth = collapsed ? 76 : 240

  // LOAD STUDENT PROFILE
  useEffect(() => {
    if (activeSection !== 'My Profile') return

    const token = sessionStorage.getItem('smartstay_access_token')

    if (!token) {
      setProfileError('Your session has expired. Please sign in again.')
      setProfile(null)
      return
    }

    const controller = new AbortController()

    async function loadProfile() {
      setProfileLoading(true)
      setProfileError('')

      try {
        const response = await fetch(`${API_URL}/students/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            data?.detail || 'Unable to load your student profile.',
          )
        }

        setProfile(data as StudentProfile)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        setProfile(null)
        setProfileError(
          error instanceof Error
            ? error.message
            : 'Unable to connect to SmartStay.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setProfileLoading(false)
        }
      }
    }

    void loadProfile()
    return () => controller.abort()
  }, [activeSection])

  // LOAD STUDENT ROOM
  useEffect(() => {
    if (activeSection !== 'My Room') return

    const token = sessionStorage.getItem('smartstay_access_token')

    if (!token) {
      setRoomError('Your session has expired. Please sign in again.')
      setRoom(null)
      return
    }

    const controller = new AbortController()

    async function loadRoom() {
      setRoomLoading(true)
      setRoomError('')
      setRoom(null)

      try {
        const response = await fetch(`${API_URL}/rooms/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            data?.detail || 'Unable to load room information.',
          )
        }

        setRoom(data as MyRoom)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        setRoom(null)
        setRoomError(
          error instanceof Error
            ? error.message
            : 'Unable to connect to SmartStay.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setRoomLoading(false)
        }
      }
    }

    void loadRoom()
    return () => controller.abort()
  }, [activeSection])

  // LOAD STUDENT ATTENDANCE
  useEffect(() => {
    if (activeSection !== 'Attendance') return

    const token = sessionStorage.getItem('smartstay_access_token')

    if (!token) {
      setAttendanceError('Your session has expired. Please sign in again.')
      setAttendance(null)
      return
    }

    const controller = new AbortController()
    const range = getMonthRange(selectedMonth)

    async function loadAttendance() {
      setAttendanceLoading(true)
      setAttendanceError('')
      setAttendance(null)

      try {
        const params = new URLSearchParams({
          start_date: range.start,
          end_date: range.end,
        })

        const response = await fetch(
          `${API_URL}/attendance/me?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
            signal: controller.signal,
          },
        )

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            data?.detail || 'Unable to load attendance records.',
          )
        }

        setAttendance(data as AttendanceResponse)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        setAttendance(null)
        setAttendanceError(
          error instanceof Error
            ? error.message
            : 'Unable to connect to SmartStay.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setAttendanceLoading(false)
        }
      }
    }

    void loadAttendance()
    return () => controller.abort()
  }, [activeSection, selectedMonth])

  // LOAD STUDENT FEES
  useEffect(() => {
    if (activeSection !== 'Fees & Payments') return

    const token = sessionStorage.getItem('smartstay_access_token')

    if (!token) {
      setFeesError('Your session has expired. Please sign in again.')
      setFees([])
      return
    }

    const controller = new AbortController()

    async function loadFees() {
      setFeesLoading(true)
      setFeesError('')
      setFees([])

      try {
        const response = await fetch(`${API_URL}/fees/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            data?.detail || 'Unable to load your fee records.',
          )
        }

        if (!Array.isArray(data)) {
          throw new Error('Unexpected fee response from the server.')
        }

        setFees(data as StudentFee[])
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        setFeesError(
          error instanceof Error
            ? error.message
            : 'Unable to connect to SmartStay.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setFeesLoading(false)
        }
      }
    }

    void loadFees()
    return () => controller.abort()
  }, [activeSection])

  // LOAD STUDENT COMPLAINTS
useEffect(() => {
  if (activeSection !== 'Complaints') return

  const token = sessionStorage.getItem('smartstay_access_token')

  if (!token) {
    setComplaintsError('Your session has expired. Please sign in again.')
    setComplaints([])
    return
  }

  const controller = new AbortController()

  async function loadComplaints() {
    setComplaintsLoading(true)
    setComplaintsError('')

    try {
      const response = await fetch(`${API_URL}/complaints/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          data?.detail || 'Unable to load your complaints.',
        )
      }

      if (!Array.isArray(data)) {
        throw new Error('Unexpected complaint response from server.')
      }

      setComplaints(data as StudentComplaint[])
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return

      setComplaintsError(
        error instanceof Error
          ? error.message
          : 'Unable to connect to SmartStay.',
      )
    } finally {
      if (!controller.signal.aborted) {
        setComplaintsLoading(false)
      }
    }
  }

  void loadComplaints()

  return () => controller.abort()
}, [activeSection])


  // LOAD STUDENT NOTICES
  useEffect(() => {
    if (activeSection !== 'Notices') return

    const token = sessionStorage.getItem('smartstay_access_token')

    if (!token) {
      setNoticesError('Your session has expired. Please sign in again.')
      setNotices([])
      return
    }

    const controller = new AbortController()

    async function loadNotices() {
      setNoticesLoading(true)
      setNoticesError('')
      setNotices([])

      try {
        const response = await fetch(`${API_URL}/notices/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        })

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            data?.detail || 'Unable to load hostel notices.',
          )
        }

        if (!Array.isArray(data)) {
          throw new Error('Unexpected notice response from server.')
        }

        // The backend filters inactive, unpublished, expired,
        // and non-student notices.
        setNotices(data as StudentNotice[])
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return

        setNoticesError(
          error instanceof Error
            ? error.message
            : 'Unable to load notices.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setNoticesLoading(false)
        }
      }
    }

    void loadNotices()

    return () => controller.abort()
  }, [activeSection])


    // FEE SUMMARY CALCULATIONS
  const totalFees = fees.reduce(
    (total, fee) => total + fee.total_amount,
    0,
  )

  const totalPaid = fees.reduce(
    (total, fee) => total + fee.amount_paid,
    0,
  )

  const totalBalance = fees.reduce(
    (total, fee) => total + fee.balance,
    0,
  )

  const pendingFees = fees.filter(
    (fee) => fee.status !== 'Paid',
  )

  const allPayments = fees
    .flatMap((fee) =>
      fee.payments.map((payment) => ({
        ...payment,
        feeDescription: fee.description,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.payment_date).getTime() -
        new Date(a.payment_date).getTime(),
    )

  // ATTENDANCE SUMMARY
  const attendanceRecords = attendance?.records ?? []

  const presentCount = attendanceRecords.filter(
    (record) => record.status === 'Present',
  ).length

  const absentCount = attendanceRecords.filter(
    (record) => record.status === 'Absent',
  ).length

  const leaveCount = attendanceRecords.filter(
    (record) => record.status === 'Leave',
  ).length

  const attendancePercentage =
    presentCount + absentCount > 0
      ? Math.round(
          (presentCount / (presentCount + absentCount)) * 100,
        )
      : 0

  // NAVIGATION
  function handleSectionChange(section: string) {
    setActiveSection(section)
    setSearch('')
  }

  function changeMonth(direction: number) {
    setSelectedMonth(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + direction,
          1,
        ),
    )
  }

async function handleComplaintSubmit(
  event: React.FormEvent<HTMLFormElement>,
) {
  event.preventDefault()

  const token = sessionStorage.getItem('smartstay_access_token')

  if (!token) {
    setComplaintsError('Your session has expired. Please sign in again.')
    return
  }

  setComplaintSubmitting(true)
  setComplaintsError('')
  setComplaintMessage('')

  try {
    const response = await fetch(`${API_URL}/complaints/me`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title: complaintForm.title.trim(),
        description: complaintForm.description.trim(),
        category: complaintForm.category,
        priority: complaintForm.priority,
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        data?.detail || 'Unable to submit your complaint.',
      )
    }

    setComplaintMessage('Your complaint has been submitted successfully!')

    setComplaintForm({
      title: '',
      description: '',
      category: 'Maintenance',
      priority: 'Medium',
    })

    // Refresh complaint history
    const refreshResponse = await fetch(`${API_URL}/complaints/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    const refreshedData = await refreshResponse.json().catch(() => null)

    if (!refreshResponse.ok) {
      throw new Error('Complaint submitted, but history could not be refreshed.')
    }

    setComplaints(refreshedData as StudentComplaint[])
  } catch (error) {
    setComplaintsError(
      error instanceof Error
        ? error.message
        : 'Unable to submit complaint.',
    )
  } finally {
    setComplaintSubmitting(false)
  }
}

  // COMMON STYLES
  const colors = {
    primary: '#5548ed',
    primaryLight: '#efedff',
    accent: '#0d9488',
    background: '#f5f7fc',
    surface: '#ffffff',
    border: '#e5e9f2',
    text: '#172033',
    muted: '#8190a8',
    green: '#15966b',
    greenLight: '#e8f8f0',
    red: '#dc5555',
    redLight: '#fff0f0',
    orange: '#d97706',
    orangeLight: '#fff6e5',
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.background,
    color: colors.text,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  const cardStyle: React.CSSProperties = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: 20,
  }

  const mutedStyle: React.CSSProperties = {
    color: colors.muted,
    fontSize: 13,
  }

  const secondaryButtonStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    background: '#fff',
    color: colors.text,
    borderRadius: 9,
    padding: '9px 13px',
    fontWeight: 500,
    cursor: 'pointer',
  }

  const formLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 650,
  marginBottom: 7,
  color: colors.text,
}

const formInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  border: `1px solid ${colors.border}`,
  borderRadius: 9,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
  color: colors.text,
}

  const statusStyle = (status: string): React.CSSProperties => {
    const styleMap: Record<string, React.CSSProperties> = {
      Paid: {
        background: colors.greenLight,
        color: colors.green,
      },
      'Partially Paid': {
        background: colors.orangeLight,
        color: colors.orange,
      },
      Pending: {
        background: colors.redLight,
        color: colors.red,
      },
      Present: {
        background: colors.greenLight,
        color: colors.green,
      },
      Absent: {
        background: colors.redLight,
        color: colors.red,
      },
      Leave: {
        background: colors.orangeLight,
        color: colors.orange,
      },
    }

    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      ...styleMap[status],
    }
  }

  const pageTitle =
    activeSection === 'Dashboard'
      ? 'Dashboard'
      : activeSection

  return (
    <div style={pageStyle}>
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: sidebarWidth,
          background: '#fff',
          borderRight: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 20,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 76,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: collapsed ? '0 20px' : '0 24px',
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: colors.primary,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Building2 size={21} />
          </div>

          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                SmartStay
              </div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 1.5,
                  color: colors.muted,
                }}
              >
                STUDENT PORTAL
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '25px 12px', flex: 1 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: colors.muted,
                padding: '0 10px 14px',
              }}
            >
              WORKSPACE
            </div>
          )}

          {sections.map((section) => {
            const Icon = section.icon
            const selected = activeSection === section.name

            return (
              <button
                key={section.name}
                onClick={() => handleSectionChange(section.name)}
                title={collapsed ? section.name : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  border: 'none',
                  borderRadius: 10,
                  padding: collapsed ? '13px 16px' : '12px 10px',
                  marginBottom: 5,
                  cursor: 'pointer',
                  background: selected
                    ? colors.primaryLight
                    : 'transparent',
                  color: selected ? colors.primary : '#586982',
                  fontWeight: selected ? 700 : 500,
                  fontSize: 13,
                  textAlign: 'left',
                }}
              >
                <Icon size={19} />

                {!collapsed && (
                  <>
                    <span style={{ flex: 1 }}>{section.name}</span>
                    {selected && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: colors.primary,
                        }}
                      />
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>

        <div
          style={{
            padding: 15,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 15,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: colors.primaryLight,
                color: colors.primary,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              ST
            </div>

            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  Student Account
                </div>
                <div style={mutedStyle}>Student</div>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: '#718096',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 5px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <LogOut size={17} />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      <main
        style={{
          marginLeft: sidebarWidth,
          minHeight: '100vh',
          transition: 'margin-left 0.2s ease',
        }}
      >
        <header
          style={{
            height: 76,
            background: '#fff',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            gap: 15,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={secondaryButtonStyle}
              aria-label="Toggle sidebar"
            >
              {collapsed ? (
                <ChevronRight size={17} />
              ) : (
                <ChevronLeft size={17} />
              )}
            </button>

            <div>
              <div style={{ ...mutedStyle, fontSize: 10 }}>
                Workspace / {pageTitle}
              </div>
              <div style={{ fontSize: 16, fontWeight: 750 }}>
                {pageTitle}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: '#fff',
                border: `1px solid ${colors.border}`,
                borderRadius: 9,
                padding: '9px 11px',
              }}
            >
              <Search size={15} color={colors.muted} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search this section..."
                style={{
                  border: 'none',
                  outline: 'none',
                  width: 130,
                  fontSize: 12,
                }}
              />
            </div>

            <button
              style={{
                ...secondaryButtonStyle,
                padding: 9,
              }}
              aria-label="Notifications"
              onClick={() => handleSectionChange('Notices')}
            >
              <Bell size={17} />
            </button>

            <div
              style={{
                width: 32,
                height: 32,
                background: colors.primaryLight,
                color: colors.primary,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ST
            </div>
          </div>
        </header>

        <div style={{ padding: 24 }}>
          {activeSection === 'Dashboard' && (
            <div>
              <div style={{ marginBottom: 22 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 23 }}>
                  Welcome back
                  {profile?.full_name
                    ? `, ${profile.full_name.split(' ')[0]}`
                    : ''}
                  !
                </h2>
                <p style={{ ...mutedStyle, margin: 0 }}>
                  Here's your hostel overview.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: 16,
                  marginBottom: 22,
                }}
              >
                {[
                  {
                    title: 'My Room',
                    value: room?.assigned
                      ? room.room_number ?? 'Assigned'
                      : 'View details',
                    icon: BedDouble,
                    section: 'My Room',
                  },
                  {
                    title: 'Attendance',
                    value: `${attendancePercentage}%`,
                    icon: CalendarCheck,
                    section: 'Attendance',
                  },
                  {
                    title: 'Outstanding Fees',
                    value: formatCurrency(totalBalance),
                    icon: Wallet,
                    section: 'Fees & Payments',
                  },
                  {
                    title: 'My Profile',
                    value: profile?.student_id ?? 'View profile',
                    icon: UserRound,
                    section: 'My Profile',
                  },
                ].map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.title}
                      onClick={() => handleSectionChange(item.section)}
                      style={{
                        ...cardStyle,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 39,
                          height: 39,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 11,
                          background: colors.primaryLight,
                          color: colors.primary,
                          marginBottom: 13,
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      <div style={mutedStyle}>{item.title}</div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 750,
                          marginTop: 5,
                        }}
                      >
                        {item.value}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Quick access</h3>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  {[
                    'My Profile',
                    'My Room',
                    'Attendance',
                    'Fees & Payments',
                    'Complaints',
                    'Notices',
                  ].map((item) => (
                    <button
                      key={item}
                      onClick={() => handleSectionChange(item)}
                      style={secondaryButtonStyle}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
                    {/* MY PROFILE */}
          {activeSection === 'My Profile' && (
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>My Profile</h2>

              {profileLoading && <p>Loading profile...</p>}
              {profileError && <ErrorMessage message={profileError} />}

              {!profileLoading && profile && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 15,
                    marginTop: 20,
                  }}
                >
                  {[
                    ['Full Name', profile.full_name],
                    ['Student ID', profile.student_id],
                    ['Email', profile.email],
                    ['Phone', profile.phone || 'Not provided'],
                    ['Course', profile.course],
                    ['Academic Year', profile.academic_year],
                    [
                      'Account Status',
                      profile.is_active ? 'Active' : 'Inactive',
                    ],
                  ].map(([label, value]) => (
                    <InfoCard
                      key={label}
                      label={String(label)}
                      value={String(value)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MY ROOM */}
          {activeSection === 'My Room' && (
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>My Room</h2>

              {roomLoading && <p>Loading room information...</p>}
              {roomError && <ErrorMessage message={roomError} />}

              {!roomLoading && room && (
                <>
                  {!room.assigned ? (
                    <EmptyState
                      title="No Room Assigned"
                      message={room.message}
                    />
                  ) : (
                    <>
                      <div
                        style={{
                          padding: 25,
                          borderRadius: 14,
                          background:
                            'linear-gradient(110deg, #5548ed, #8178f7)',
                          color: '#fff',
                          marginTop: 20,
                        }}
                      >
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          YOUR ALLOCATED ROOM
                        </div>
                        <h2 style={{ fontSize: 32, margin: '12px 0 5px' }}>
                          Room {room.room_number}
                        </h2>
                        <p style={{ margin: 0 }}>Block {room.block}</p>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 14,
                          marginTop: 20,
                        }}
                      >
                        <InfoCard
                          label="Room Capacity"
                          value={room.capacity ?? '—'}
                        />
                        <InfoCard
                          label="Occupied Beds"
                          value={room.occupied ?? '—'}
                        />
                        <InfoCard
                          label="Available Beds"
                          value={room.available ?? '—'}
                        />
                        <InfoCard
                          label="Room Status"
                          value={room.is_active ? 'Active' : 'Inactive'}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ATTENDANCE */}
          {activeSection === 'Attendance' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div>
                  <h2 style={{ margin: '0 0 5px' }}>My Attendance</h2>
                  <p style={mutedStyle}>
                    View your daily hostel attendance records.
                  </p>
                </div>

                <span style={statusStyle('Present')}>Read only</span>
              </div>

              {attendanceLoading && <p>Loading attendance...</p>}
              {attendanceError && (
                <ErrorMessage message={attendanceError} />
              )}

              {!attendanceLoading && !attendanceError && attendance && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 14,
                      marginBottom: 20,
                    }}
                  >
                    <SummaryCard
                      label="Attendance"
                      value={`${attendancePercentage}%`}
                      color={colors.primary}
                    />
                    <SummaryCard
                      label="Present Days"
                      value={presentCount}
                      color={colors.green}
                    />
                    <SummaryCard
                      label="Absent Days"
                      value={absentCount}
                      color={colors.red}
                    />
                    <SummaryCard
                      label="Leave Days"
                      value={leaveCount}
                      color={colors.orange}
                    />
                  </div>

                  <div style={cardStyle}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 20,
                      }}
                    >
                      <h3 style={{ margin: 0 }}>
                        {formatMonth(selectedMonth)}
                      </h3>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => changeMonth(-1)}
                          style={secondaryButtonStyle}
                          aria-label="Previous month"
                        >
                          <ChevronLeft size={17} />
                        </button>

                        <button
                          onClick={() => changeMonth(1)}
                          style={secondaryButtonStyle}
                          aria-label="Next month"
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        gap: 7,
                      }}
                    >
                      {[
                        'Sun',
                        'Mon',
                        'Tue',
                        'Wed',
                        'Thu',
                        'Fri',
                        'Sat',
                      ].map((day) => (
                        <div
                          key={day}
                          style={{
                            textAlign: 'center',
                            color: colors.muted,
                            fontSize: 11,
                            padding: 8,
                            fontWeight: 650,
                          }}
                        >
                          {day}
                        </div>
                      ))}

                      {(() => {
                        const year = selectedMonth.getFullYear()
                        const month = selectedMonth.getMonth()
                        const firstDay = new Date(year, month, 1).getDay()
                        const daysInMonth = new Date(
                          year,
                          month + 1,
                          0,
                        ).getDate()

                        const recordMap = new Map(
                          attendanceRecords.map((record) => [
                            record.attendance_date,
                            record,
                          ]),
                        )

                        const cells: (number | null)[] = [
                          ...Array.from(
                            { length: firstDay },
                            () => null,
                          ),
                          ...Array.from(
                            { length: daysInMonth },
                            (_, index) => index + 1,
                          ),
                        ]

                        while (cells.length % 7 !== 0) {
                          cells.push(null)
                        }

                        return cells.map((day, index) => {
                          if (day === null) {
                            return <div key={`empty-${index}`} />
                          }

                          const dateString = formatDate(
                            new Date(year, month, day),
                          )

                          const record = recordMap.get(dateString)

                          const dayColor =
                            record?.status === 'Present'
                              ? colors.green
                              : record?.status === 'Absent'
                                ? colors.red
                                : record?.status === 'Leave'
                                  ? colors.orange
                                  : colors.muted

                          return (
                            <div
                              key={dateString}
                              title={
                                record
                                  ? `${record.status}${record.is_locked ? ' - Locked' : ''}`
                                  : 'No attendance recorded'
                              }
                              style={{
                                minHeight: 48,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 3,
                                borderRadius: 9,
                                background: record
                                  ? `${dayColor}18`
                                  : '#f8fafc',
                                border: `1px solid ${
                                  record ? `${dayColor}55` : colors.border
                                }`,
                                color: dayColor,
                                fontSize: 12,
                                fontWeight: 650,
                              }}
                            >
                              {day}
                              {record && (
                                <span style={{ fontSize: 9 }}>
                                  {record.status === 'Present'
                                    ? 'P'
                                    : record.status === 'Absent'
                                      ? 'A'
                                      : 'L'}
                                </span>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 15,
                        marginTop: 18,
                      }}
                    >
                      <Legend color={colors.green} label="Present" />
                      <Legend color={colors.red} label="Absent" />
                      <Legend color={colors.orange} label="Leave" />
                      <Legend color="#cbd5e1" label="Not recorded" />
                    </div>
                  </div>

                  <div style={{ ...cardStyle, marginTop: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Attendance History</h3>

                    {attendanceRecords.length === 0 ? (
                      <EmptyState
                        title="No Records Found"
                        message="No attendance has been recorded for this month."
                      />
                    ) : (
                      [...attendanceRecords]
                        .sort((a, b) =>
                          b.attendance_date.localeCompare(a.attendance_date),
                        )
                        .map((record) => (
                          <div
                            key={record.attendance_date}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 10,
                              padding: '14px 0',
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: 13 }}>
                                {formatDisplayDate(record.attendance_date)}
                              </strong>
                              {record.note && (
                                <p style={mutedStyle}>{record.note}</p>
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                              }}
                            >
                              <span style={statusStyle(record.status)}>
                                {record.status}
                              </span>

                              {record.is_locked && (
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    color: colors.muted,
                                  }}
                                >
                                  <Lock size={13} />
                                  Locked
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* FEES & PAYMENTS */}
          {activeSection === 'Fees & Payments' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div>
                  <h2 style={{ margin: '0 0 5px' }}>
                    Fees & Payments
                  </h2>
                  <p style={mutedStyle}>
                    Your personal fee details and payment history.
                  </p>
                </div>

                <span style={statusStyle('Present')}>Read only</span>
              </div>

              {feesLoading && (
                <div style={cardStyle}>
                  <p>Loading your fee records...</p>
                </div>
              )}

              {feesError && <ErrorMessage message={feesError} />}

              {!feesLoading && !feesError && (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 14,
                      marginBottom: 22,
                    }}
                  >
                    <SummaryCard
                      label="Total Fees"
                      value={formatCurrency(totalFees)}
                      color={colors.primary}
                    />

                    <SummaryCard
                      label="Amount Paid"
                      value={formatCurrency(totalPaid)}
                      color={colors.green}
                    />

                    <SummaryCard
                      label="Outstanding Balance"
                      value={formatCurrency(totalBalance)}
                      color={colors.red}
                    />

                    <SummaryCard
                      label="Unpaid Fee Items"
                      value={pendingFees.length}
                      color={colors.orange}
                    />
                  </div>

                  <div style={cardStyle}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        marginBottom: 18,
                      }}
                    >
                      <h3 style={{ margin: 0 }}>Fee Breakdown</h3>
                      <span style={mutedStyle}>
                        {fees.length} fee record(s)
                      </span>
                    </div>

                    {fees.length === 0 ? (
                      <EmptyState
                        title="No Fee Records"
                        message="No fee records are currently linked to your student account."
                      />
                    ) : (
                      fees
                        .filter((fee) => {
                          const query = search.trim().toLowerCase()

                          return (
                            !query ||
                            fee.description.toLowerCase().includes(query) ||
                            fee.status.toLowerCase().includes(query) ||
                            fee.due_date.includes(query)
                          )
                        })
                        .map((fee) => (
                          <div
                            key={fee.id}
                            style={{
                              padding: '20px 0',
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: 12,
                              }}
                            >
                              <div>
                                <h4
                                  style={{
                                    fontSize: 15,
                                    margin: '0 0 6px',
                                  }}
                                >
                                  {fee.description}
                                </h4>

                                <p
                                  style={{
                                    ...mutedStyle,
                                    margin: 0,
                                  }}
                                >
                                  Fee #{fee.id} · Due{' '}
                                  {formatDisplayDate(fee.due_date)}
                                </p>
                              </div>

                              <span style={statusStyle(fee.status)}>
                                {fee.status}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'repeat(auto-fit, minmax(145px, 1fr))',
                                gap: 12,
                                marginTop: 18,
                              }}
                            >
                              <InfoCard
                                label="Total Amount"
                                value={formatCurrency(fee.total_amount)}
                              />

                              <InfoCard
                                label="Amount Paid"
                                value={formatCurrency(fee.amount_paid)}
                              />

                              <InfoCard
                                label="Balance"
                                value={formatCurrency(fee.balance)}
                              />
                            </div>

                            <div
                              style={{
                                height: 8,
                                background: '#edf0f5',
                                borderRadius: 20,
                                overflow: 'hidden',
                                marginTop: 18,
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${
                                    fee.total_amount > 0
                                      ? Math.min(
                                          100,
                                          (fee.amount_paid /
                                            fee.total_amount) *
                                            100,
                                        )
                                      : 0
                                  }%`,
                                  background: colors.green,
                                  borderRadius: 20,
                                }}
                              />
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 11,
                                color: colors.muted,
                                marginTop: 7,
                              }}
                            >
                              <span>Payment progress</span>
                              <span>
                                {fee.total_amount > 0
                                  ? Math.round(
                                      (fee.amount_paid /
                                        fee.total_amount) *
                                        100,
                                    )
                                  : 0}
                                %
                              </span>
                            </div>

                            <div style={{ marginTop: 20 }}>
                              <h4 style={{ fontSize: 13 }}>
                                Payment History
                              </h4>

                              {fee.payments.length === 0 ? (
                                <p style={mutedStyle}>
                                  No payments recorded for this fee.
                                </p>
                              ) : (
                                fee.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      flexWrap: 'wrap',
                                      gap: 10,
                                      padding: '12px 0',
                                      borderTop: `1px solid ${colors.border}`,
                                    }}
                                  >
                                    <div>
                                      <strong style={{ fontSize: 13 }}>
                                        {formatCurrency(payment.amount)}
                                      </strong>

                                      <p
                                        style={{
                                          ...mutedStyle,
                                          margin: '5px 0 0',
                                        }}
                                      >
                                        {formatPaymentDate(
                                          payment.payment_date,
                                        )}{' '}
                                        · {payment.payment_method}
                                      </p>

                                      {payment.reference && (
                                        <p
                                          style={{
                                            ...mutedStyle,
                                            margin: '4px 0 0',
                                            fontSize: 11,
                                          }}
                                        >
                                          Reference: {payment.reference}
                                        </p>
                                      )}
                                    </div>

                                    <span
                                      style={{
                                        color: colors.green,
                                        fontSize: 11,
                                        fontWeight: 650,
                                      }}
                                    >
                                      <CheckCircle2
                                        size={13}
                                        style={{
                                          verticalAlign: 'middle',
                                          marginRight: 4,
                                        }}
                                      />
                                      Recorded
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  <div style={{ ...cardStyle, marginTop: 20 }}>
                    <h3 style={{ marginTop: 0 }}>
                      Recent Payment History
                    </h3>

                    {allPayments.length === 0 ? (
                      <p style={mutedStyle}>
                        No payments have been recorded yet.
                      </p>
                    ) : (
                      allPayments.map((payment) => (
                        <div
                          key={`${payment.id}-${payment.feeDescription}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 10,
                            padding: '12px 0',
                            borderBottom: `1px solid ${colors.border}`,
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 13 }}>
                              {payment.feeDescription}
                            </strong>
                            <p style={{ ...mutedStyle, margin: '5px 0 0' }}>
                              {formatPaymentDate(payment.payment_date)} ·{' '}
                              {payment.payment_method}
                            </p>
                          </div>

                          <strong style={{ color: colors.green }}>
                            {formatCurrency(payment.amount)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* COMPLAINTS */}
{activeSection === 'Complaints' && (
  <div>
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 6px' }}>My Complaints</h2>
      <p style={mutedStyle}>
        Submit hostel complaints and track their progress.
      </p>
    </div>

    {complaintsError && (
      <div style={{ marginBottom: 15 }}>
        <ErrorMessage message={complaintsError} />
      </div>
    )}

    {complaintMessage && (
      <div
        role="status"
        style={{
          padding: 13,
          marginBottom: 15,
          borderRadius: 10,
          background: colors.greenLight,
          color: colors.green,
          fontSize: 13,
          border: '1px solid #b7ebd2',
        }}
      >
        {complaintMessage}
      </div>
    )}

    {/* SUBMIT COMPLAINT FORM */}
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Submit a Complaint</h3>

      <form onSubmit={handleComplaintSubmit}>
        <div style={{ display: 'grid', gap: 15 }}>
          <div>
            <label style={formLabelStyle}>Complaint Title</label>
            <input
              required
              maxLength={150}
              value={complaintForm.title}
              onChange={(event) =>
                setComplaintForm({
                  ...complaintForm,
                  title: event.target.value,
                })
              }
              placeholder="Enter complaint title"
              style={formInputStyle}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 15,
            }}
          >
            <div>
              <label style={formLabelStyle}>Category</label>
              <select
                value={complaintForm.category}
                onChange={(event) =>
                  setComplaintForm({
                    ...complaintForm,
                    category: event.target.value,
                  })
                }
                style={formInputStyle}
              >
                <option value="Maintenance">Maintenance</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Food">Food</option>
                <option value="Electricity">Electricity</option>
                <option value="Water">Water Supply</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={formLabelStyle}>Priority</label>
              <select
                value={complaintForm.priority}
                onChange={(event) =>
                  setComplaintForm({
                    ...complaintForm,
                    priority: event.target.value as ComplaintForm['priority'],
                  })
                }
                style={formInputStyle}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div>
            <label style={formLabelStyle}>Description</label>
            <textarea
              required
              maxLength={2000}
              rows={4}
              value={complaintForm.description}
              onChange={(event) =>
                setComplaintForm({
                  ...complaintForm,
                  description: event.target.value,
                })
              }
              placeholder="Explain your issue in detail..."
              style={{
                ...formInputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={complaintSubmitting}
              style={{
                border: 'none',
                background: colors.primary,
                color: '#fff',
                padding: '11px 20px',
                borderRadius: 9,
                fontWeight: 650,
                cursor: complaintSubmitting ? 'not-allowed' : 'pointer',
                opacity: complaintSubmitting ? 0.7 : 1,
              }}
            >
              {complaintSubmitting ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </div>
      </form>
    </div>

    {/* COMPLAINT HISTORY */}
    <div style={{ ...cardStyle, marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>My Complaint History</h3>
        <span style={mutedStyle}>
          {complaints.length} complaint(s)
        </span>
      </div>

      {complaintsLoading && <p>Loading complaints...</p>}

      {!complaintsLoading && complaints.length === 0 && !complaintsError && (
        <EmptyState
          title="No Complaints Yet"
          message="Your submitted complaints will appear here."
        />
      )}

      {!complaintsLoading &&
        complaints.map((complaint) => (
          <div
            key={complaint.id}
            style={{
              padding: '18px 0',
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <strong style={{ fontSize: 14 }}>
                  {complaint.title}
                </strong>
                <p style={{ ...mutedStyle, margin: '6px 0' }}>
                  {complaint.complaint_number} · {complaint.category}
                </p>
              </div>

              <span style={statusStyle(complaint.status)}>
                {complaint.status}
              </span>
            </div>

            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              {complaint.description}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <span style={mutedStyle}>
                Submitted: {complaint.date}
              </span>

              <span
                style={{
                  ...statusStyle(complaint.priority),
                  ...(complaint.priority === 'High'
                    ? { background: colors.redLight, color: colors.red }
                    : complaint.priority === 'Medium'
                      ? { background: colors.orangeLight, color: colors.orange }
                      : { background: colors.greenLight, color: colors.green }),
                }}
              >
                {complaint.priority} Priority
              </span>
            </div>
          </div>
        ))}
    </div>
  </div>
)}

          
  {/* NOTICES */}
  {activeSection === 'Notices' && (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 6px' }}>Hostel Notices</h2>
        <p style={mutedStyle}>
          Stay updated with the latest hostel announcements.
        </p>
      </div>

      {noticesError && (
        <div style={{ marginBottom: 15 }}>
          <ErrorMessage message={noticesError} />
        </div>
      )}

      {noticesLoading ? (
        <div style={cardStyle}>
          <p>Loading hostel notices...</p>
        </div>
      ) : notices.length === 0 ? (
        <div style={cardStyle}>
          <EmptyState
            title="No Active Notices"
            message="There are currently no announcements available for students."
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 15 }}>
          {notices.map((notice) => (
            <article
              key={notice.id}
              style={{
                ...cardStyle,
                borderLeft: `4px solid ${
                  notice.priority === 'Urgent'
                    ? colors.red
                    : notice.priority === 'High'
                      ? colors.orange
                      : colors.primary
                }`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <span
                    style={{
                      ...statusStyle(
                        notice.priority === 'Urgent'
                          ? 'Absent'
                          : notice.priority === 'High'
                            ? 'Leave'
                            : 'Present',
                      ),
                    }}
                  >
                    {notice.priority} Priority
                  </span>

                  <h3 style={{ margin: '12px 0 6px', fontSize: 17 }}>
                    {notice.title}
                  </h3>
                </div>

                <span style={mutedStyle}>
                  <CheckCircle2
                    size={14}
                    style={{ verticalAlign: 'middle', marginRight: 4 }}
                  />
                  Active
                </span>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.7 }}>
                {notice.content}
              </p>

              <div
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  paddingTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span style={mutedStyle}>
                  Audience: {notice.audience}
                </span>

                <span style={mutedStyle}>
                  Published:{' '}
                  {notice.publish_at
                    ? new Date(notice.publish_at).toLocaleDateString('en-IN')
                    : new Date(notice.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )}

        </div>

        <footer
          style={{
            padding: 20,
            textAlign: 'center',
            color: colors.muted,
            fontSize: 11,
          }}
        >
          SmartStay · Student Portal
        </footer>
      </main>
    </div>
  )
}

// REUSABLE COMPONENTS

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: 14,
        borderRadius: 10,
        background: '#fef2f2',
        color: '#b91c1c',
        fontSize: 13,
        border: '1px solid #fecaca',
      }}
    >
      {message}
    </div>
  )
}

function InfoCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #e7eaf2',
        borderRadius: 12,
        background: '#fff',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#8992a5',
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          fontSize: 14,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </strong>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div
      style={{
        padding: 18,
        border: '1px solid #e7eaf2',
        borderRadius: 12,
        background: '#fff',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#8992a5',
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          fontSize: 24,
          color,
        }}
      >
        {value}
      </strong>
    </div>
  )
}

function EmptyState({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div
      style={{
        padding: 30,
        textAlign: 'center',
        background: '#f8fafc',
        border: '1px solid #e7eaf2',
        borderRadius: 12,
        color: '#647087',
        marginTop: 15,
      }}
    >
      <CalendarCheck
        size={30}
        color="#8992a5"
        style={{ marginBottom: 10 }}
      />

      <h3 style={{ margin: '5px 0', fontSize: 15 }}>
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
    </div>
  )
}

function Legend({
  color,
  label,
}: {
  color: string
  label: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: '#647087',
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 3,
          background: color,
        }}
      />
      {label}
    </span>
  )
}