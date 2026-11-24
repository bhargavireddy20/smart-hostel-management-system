
import { useState } from 'react'
import {
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react'

type LoginProps = {
  onLogin: () => void
}

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

export default function Login({ onLogin }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/admin-login`, {
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
          data.detail || 'Invalid email or password.',
        )
      }

      if (!data.access_token || data.role !== 'admin') {
        throw new Error('Invalid authentication response.')
      }

      sessionStorage.setItem(
        'smartstay_access_token',
        data.access_token,
      )
      sessionStorage.setItem('smartstay_role', data.role)

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
            <small>HOSTEL MANAGEMENT</small>
          </span>
        </div>

        <div className="login-message">
          <span className="login-label">SMARTER HOSTEL LIVING</span>
          <h1>Your hostel life,<br />simplified.</h1>
          <p>
            One place for hostel operations, student services,
            room allocation and everyday updates.
          </p>

          <div className="login-feature">
            <span>✓</span>
            <div>
              <strong>Everything in one place</strong>
              <p>Manage hostel tasks without the hassle.</p>
            </div>
          </div>

          <div className="login-feature">
            <span>✓</span>
            <div>
              <strong>Designed for students and staff</strong>
              <p>A clearer, simpler hostel experience.</p>
            </div>
          </div>
        </div>

        <p className="login-copyright">
          © 2026 SmartStay · Smart hostel living, made simpler.
        </p>
      </section>

      <section className="login-form-section">
        <div className="login-form-container">
          <div className="mobile-brand">
            <Building2 size={24} />
            <strong>SmartStay</strong>
          </div>

          <span className="welcome-label">ADMIN ACCESS</span>
          <h2>Sign in to SmartStay</h2>
          <p className="login-subtitle">
            Enter your authorized administrator credentials.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="email">Admin email address</label>
            <div className="login-input-wrap">
              <Mail size={18} />
              <input
                id="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="password-label-row">
              <label htmlFor="password">Password</label>
            </div>

            <div className="login-input-wrap">
              <LockKeyhole size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p
                role="alert"
                style={{ color: '#b91c1c', fontSize: 14 }}
              >
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
              Your credentials are verified securely by the SmartStay backend.
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
