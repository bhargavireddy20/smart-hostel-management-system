
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Megaphone, Plus, RefreshCw, X, EyeOff } from 'lucide-react'

const API_URL = 'http://127.0.0.1:8000'

type Notice = {
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

type NoticeForm = {
  title: string
  content: string
  audience: string
  priority: string
  publish_at: string
  expires_at: string
}

const emptyForm: NoticeForm = {
  title: '',
  content: '',
  audience: 'All Students',
  priority: 'Normal',
  publish_at: '',
  expires_at: '',
}

function formatDate(value: string | null) {
  if (!value) return 'Not scheduled'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

function getAdminHeaders() {
  const token = sessionStorage.getItem('smartstay_access_token')

  if (!token) {
    throw new Error('Admin session not found. Please log in again.')
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
}

export default function NoticeManagement() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NoticeForm>(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadNotices = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/notices/`, {
        headers: getAdminHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Could not load notices (${response.status}).`)
      }

      const data: Notice[] = await response.json()
      setNotices(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load notices.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadNotices()
  }, [loadNotices])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${API_URL}/notices/`, {
        method: 'POST',
        headers: {
          ...getAdminHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          audience: form.audience,
          priority: form.priority,
          publish_at: form.publish_at
            ? new Date(form.publish_at).toISOString()
            : null,
          expires_at: form.expires_at
            ? new Date(form.expires_at).toISOString()
            : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Could not create notice. Check the entered dates and fields.',
        )
      }

      setForm(emptyForm)
      setShowForm(false)
      setMessage('Notice created successfully.')

      await loadNotices()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create notice.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function deactivateNotice(id: number) {
    if (!window.confirm('Deactivate this notice?')) return

    setMessage('')
    setError('')

    try {
      const response = await fetch(
        `${API_URL}/notices/${id}/deactivate`,
        {
          method: 'PATCH',
          headers: getAdminHeaders(),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Could not deactivate notice.')
      }

      setMessage('Notice deactivated successfully.')
      await loadNotices()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not deactivate notice.',
      )
    }
  }

  const activeCount = notices.filter(
    (notice) => notice.is_active,
  ).length

  return (
    <section className="notice-management">
      <div className="student-page-heading">
        <div>
          <h2>Notice Management</h2>
          <p>Create hostel announcements and keep students informed.</p>
        </div>

        <button
          className="student-add-button"
          onClick={() => {
            setMessage('')
            setError('')
            setShowForm((current) => !current)
          }}
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Cancel' : 'Create notice'}
        </button>
      </div>

      <div className="student-summary">
        <div className="student-summary-card">
          <Megaphone size={22} />
          <span>Total notices</span>
          <strong>{notices.length}</strong>
        </div>

        <div className="student-summary-card">
          <Megaphone size={22} />
          <span>Active notices</span>
          <strong>{activeCount}</strong>
        </div>
      </div>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      {showForm && (
        <form className="student-form" onSubmit={handleSubmit}>
          <h3>Create a new notice</h3>

          <label>
            Notice title
            <input
              required
              minLength={3}
              maxLength={150}
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="e.g. Monthly hostel meeting"
            />
          </label>

          <label>
            Message
            <textarea
              required
              rows={4}
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
              placeholder="Enter the full announcement..."
            />
          </label>

          <div className="student-form-grid">
            <label>
              Audience
              <select
                value={form.audience}
                onChange={(event) =>
                  setForm({ ...form, audience: event.target.value })
                }
              >
                <option>All Students</option>
                <option>Students</option>
                <option>Staff</option>
                <option>Wardens</option>
              </select>
            </label>

            <label>
              Priority
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm({ ...form, priority: event.target.value })
                }
              >
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </label>

            <label>
              Publish date (optional)
              <input
                type="datetime-local"
                value={form.publish_at}
                onChange={(event) =>
                  setForm({ ...form, publish_at: event.target.value })
                }
              />
            </label>

            <label>
              Expiry date (optional)
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(event) =>
                  setForm({ ...form, expires_at: event.target.value })
                }
              />
            </label>
          </div>

          <button
            className="student-add-button"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Publish notice'}
          </button>
        </form>
      )}

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h3>All notices</h3>
            <p>Saved announcements from the database</p>
          </div>

          <button
            className="admin-text-button"
            onClick={() => void loadNotices()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading notices...</p>
        ) : notices.length === 0 ? (
          <p>No notices yet. Create your first announcement.</p>
        ) : (
          <div className="notice-record-list">
            {notices.map((notice) => (
              <article className="notice-record" key={notice.id}>
                <div className="notice-record-heading">
                  <div>
                    <span
                      className={`notice-priority ${notice.priority.toLowerCase()}`}
                    >
                      {notice.priority}
                    </span>

                    <h3>{notice.title}</h3>
                  </div>

                  {notice.is_active && (
                    <button
                      className="admin-text-button"
                      onClick={() => void deactivateNotice(notice.id)}
                    >
                      <EyeOff size={15} /> Deactivate
                    </button>
                  )}
                </div>

                <p>{notice.content}</p>

                <div className="notice-record-meta">
                  <span>Audience: {notice.audience}</span>
                  <span>Created: {formatDate(notice.created_at)}</span>
                  <span>Publish: {formatDate(notice.publish_at)}</span>

                  {notice.expires_at && (
                    <span>
                      Expires: {formatDate(notice.expires_at)}
                    </span>
                  )}

                  <strong>
                    {notice.is_active ? 'Active' : 'Inactive'}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
