
import { useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react'

type StudentLoginProps = {
  onLogin: () => void
  onBack: () => void
}

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

export default function StudentLogin({
  onLogin,
  onBack,
}: StudentLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/student-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.detail || 'Invalid student email or password.',
        )
      }

      if (!data.access_token || data.role !== 'student') {
        throw new Error('Invalid student authentication response.')
      }

      sessionStorage.setItem(
        'smartstay_access_token',
        data.access_token,
      )
      sessionStorage.setItem('smartstay_role', 'student')

      setPassword('')
      onLogin()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to SmartStay. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand">
          <span className="login-brand-icon">
            <Building2 size={25} />
          </span>
          <span>
            <strong>SmartStay</strong>
            <small>STUDENT PORTAL</small>
          </span>
        </div>

        <div className="login-message">
          <span className="login-label">YOUR SPACE, YOUR STAY</span>
          <h1>Hostel life,<br />made simpler.</h1>
          <p>
            Access your room details, attendance, fee information,
            complaints and hostel notices in one place.
          </p>
        </div>

        <p className="login-copyright">
          © 2026 SmartStay · Smart hostel living, made simpler.
        </p>
      </section>

      <section className="login-form-section">
        <div className="login-form-container">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 24,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={17} />
            Back to account selection
          </button>

          <span className="welcome-label">STUDENT ACCESS</span>
          <h2>Welcome back</h2>
          <p className="login-subtitle">
            Sign in with your registered student email.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="student-email">Student email</label>
            <div className="login-input-wrap">
              <Mail size={18} />
              <input
                id="student-email"
                type="email"
                autoComplete="username"
                placeholder="student@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <label htmlFor="student-password">Password</label>
            <div className="login-input-wrap">
              <LockKeyhole size={18} />
              <input
                id="student-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Sign in'}
              {!loading && <span> →</span>}
            </button>
          </form>

          <div className="login-help">
            <LockKeyhole size={15} />
            <span>
              Your login is verified by the SmartStay backend.
            </span>
          </div>

          <p className="login-footer">
            Need access? Contact your hostel administrator.
          </p>
        </div>
      </section>
    </main>
  )
}
