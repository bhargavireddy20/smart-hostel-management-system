
import { useState } from 'react'
import './App.css'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import StudentLogin from './pages/StudentLogin'
import StudentDashboard from './pages/StudentDashboard'

type UserRole = 'admin' | 'student' | null

function getInitialRole(): UserRole {
  const token = sessionStorage.getItem('smartstay_access_token')
  const role = sessionStorage.getItem('smartstay_role')

  if (token && (role === 'admin' || role === 'student')) {
    return role
  }

  sessionStorage.removeItem('smartstay_access_token')
  sessionStorage.removeItem('smartstay_role')
  return null
}

function App() {
  const [role, setRole] = useState<UserRole>(getInitialRole)

  function handleLogin() {
    const token = sessionStorage.getItem('smartstay_access_token')
    const savedRole = sessionStorage.getItem('smartstay_role')

    if (
      token &&
      (savedRole === 'admin' || savedRole === 'student')
    ) {
      setRole(savedRole)
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('smartstay_access_token')
    sessionStorage.removeItem('smartstay_role')
    setRole(null)
  }

  if (role === 'admin') {
    return <AdminDashboard onLogout={handleLogout} />
  }

  if (role === 'student') {
    return <StudentDashboard onLogout={handleLogout} />
  }

  return (
    <LoginScreen
      onLogin={handleLogin}
    />
  )
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [loginType, setLoginType] = useState<UserRole>(null)

  if (loginType === 'student') {
    return <StudentLogin onLogin={onLogin} onBack={() => setLoginType(null)} />
  }

  if (loginType === 'admin') {
    return <Login onLogin={onLogin} />
  }

  return (
    <main className="login-page">
      <section className="login-form-section">
        <div className="login-form-container">
          <h2>Welcome to SmartStay</h2>
          <p className="login-subtitle">
            Choose your account type to continue.
          </p>

          <button
            type="button"
            className="login-submit"
            onClick={() => setLoginType('admin')}
          >
            Administrator Login →
          </button>

          <button
            type="button"
            className="login-submit"
            style={{ marginTop: 12 }}
            onClick={() => setLoginType('student')}
          >
            Student Login →
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
