import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── HELPERS ────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
}

const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]
function avatarColor(id = '') { return COLORS[id.charCodeAt(0) % COLORS.length] }

const ROLE_STYLES = {
  admin:  'bg-purple-50 text-purple-700 border border-purple-200',
  staff:  'bg-blue-50 text-blue-700 border border-blue-200',
  client: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

const STATUS_STYLES = {
  active:   'bg-green-50 text-green-700 border border-green-200',
  inactive: 'bg-gray-100 text-gray-500 border border-gray-200',
  pending:  'bg-amber-50 text-amber-700 border border-amber-200',
}

const ROLES   = ['all', 'admin', 'staff', 'client']
const STATUSES = ['all', 'active', 'pending', 'inactive']

// ── ICONS ──────────────────────────────────────────────────
const Icon = {
  Search:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Check:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  X:        () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Edit:     () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Users:    () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Mail:     () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Alert:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Refresh:  () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  ChevronD: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>,
}

// ── AVATAR ─────────────────────────────────────────────────
function Avatar({ name, id, size = 'md' }) {
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${avatarColor(id)}`}>
      {initials(name)}
    </div>
  )
}

// ── MODAL ──────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${width} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <Icon.X />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── CONFIRM DIALOG ─────────────────────────────────────────
function Confirm({ message, confirmLabel, confirmClass = 'bg-red-600 hover:bg-red-700', onConfirm, onCancel }) {
  return (
    <Modal title="Confirm Action" onClose={onCancel}>
      <p className="text-sm text-gray-600 mb-5">{message}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={onConfirm} className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${confirmClass}`}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ── EDIT USER MODAL ────────────────────────────────────────
function EditUserModal({ user, onSave, onClose }) {
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    role:      user.role || 'client',
    status:    user.status || 'pending',
    phone:     user.phone || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleSave() {
    if (!form.full_name.trim()) return setError('Full name is required.')
    setSaving(true)
    const err = await onSave(user.id, form)
    setSaving(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Modal title="Edit User" onClose={onClose}>
      <div className="space-y-4">
        {/* Avatar preview */}
        <div className="flex items-center gap-3 pb-2">
          <Avatar name={form.full_name || user.full_name} id={user.id} size="lg" />
          <div>
            <p className="text-sm font-medium text-gray-900">{form.full_name || '—'}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.full_name}
            onChange={e => set('full_name', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            placeholder="+234..."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
          <select
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.role}
            onChange={e => set('role', e.target.value)}
          >
            <option value="client">Client</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Account Status</label>
          <div className="grid grid-cols-3 gap-2">
            {['active', 'pending', 'inactive'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => set('status', s)}
                className={`py-2 text-xs font-medium rounded-xl border capitalize transition-colors ${
                  form.status === s
                    ? s === 'active'   ? 'bg-green-600 text-white border-green-600'
                    : s === 'pending'  ? 'bg-amber-500 text-white border-amber-500'
                    :                   'bg-gray-600 text-white border-gray-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <Icon.Alert />{error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── USER ROW ───────────────────────────────────────────────
function UserRow({ user, currentUserId, onEdit, onActivate, onDeactivate }) {
  const isSelf = user.id === currentUserId

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <Avatar name={user.full_name} id={user.id} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name || '(No name)'}</p>
                {isSelf && <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">You</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
              {user.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_STYLES[user.role] || ROLE_STYLES.client}`}>
                {user.role}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[user.status] || STATUS_STYLES.pending}`}>
                {user.status}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">Joined {fmtDate(user.created_at)}</p>
            <div className="flex gap-1.5">
              {/* Activate */}
              {user.status !== 'active' && !isSelf && (
                <button
                  onClick={() => onActivate(user)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Icon.Check /> Activate
                </button>
              )}
              {/* Deactivate */}
              {user.status === 'active' && !isSelf && (
                <button
                  onClick={() => onDeactivate(user)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 border border-gray-200 transition-colors"
                >
                  <Icon.X /> Deactivate
                </button>
              )}
              {/* Edit */}
              <button
                onClick={() => onEdit(user)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
              >
                <Icon.Edit /> Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function UserManagement() {
  const { profile } = useAuth()

  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editUser, setEditUser]     = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { user, type }

  // Stats
  const stats = {
    total:    users.length,
    active:   users.filter(u => u.status === 'active').length,
    pending:  users.filter(u => u.status === 'pending').length,
    staff:    users.filter(u => u.role === 'staff').length,
  }

  // ── LOAD ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error: err } = await supabase
      .from('hhf_profiles')
      .select('id, full_name, email, role, status, phone, created_at')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-clear success
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(''), 3500)
    return () => clearTimeout(t)
  }, [success])

  // ── FILTER ────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const matchRole   = roleFilter   === 'all' || u.role   === roleFilter
    const matchStatus = statusFilter === 'all' || u.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    return matchRole && matchStatus && matchSearch
  })

  // ── ACTIONS ───────────────────────────────────────────────
  async function updateUser(id, fields) {
    const { error: err } = await supabase
      .from('hhf_profiles')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) return err.message

    // Audit log
    await supabase.from('hhf_audit_logs').insert({
      actor_id:    profile.id,
      action:      'user_updated',
      target_type: 'profile',
      target_id:   id,
      details:     fields,
    }).catch(e => console.error('Audit log insert failed:', e))

    load()
    return null
  }

  async function handleActivate(user) {
    const err = await updateUser(user.id, { status: 'active' })
    if (err) setError(err)
    else setSuccess(`${user.full_name} has been activated.`)
  }

  async function handleDeactivate(user) {
    const err = await updateUser(user.id, { status: 'inactive' })
    if (err) setError(err)
    else setSuccess(`${user.full_name} has been deactivated.`)
  }

  async function handleSaveEdit(id, fields) {
    return await updateUser(id, fields)
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Activate accounts, assign roles, manage access</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <Icon.Refresh />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Users',    value: stats.total,   color: 'text-gray-900',   bg: 'bg-gray-50   border-gray-200' },
          { label: 'Active',         value: stats.active,  color: 'text-green-700',  bg: 'bg-green-50  border-green-200' },
          { label: 'Pending Review', value: stats.pending, color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200' },
          { label: 'Staff Members',  value: stats.staff,   color: 'text-blue-700',   bg: 'bg-blue-50   border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Search /></span>
          <input
            type="text"
            placeholder="Search name or email…"
            className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Role filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-shrink-0">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${roleFilter === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-shrink-0">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Check />{success}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Alert />{error}
          <button onClick={() => setError('')} className="ml-auto"><Icon.X /></button>
        </div>
      )}

      {/* Pending alert */}
      {!loading && stats.pending > 0 && statusFilter !== 'pending' && (
        <div
          onClick={() => setStatusFilter('pending')}
          className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <Icon.Alert />
          <span><strong>{stats.pending}</strong> user{stats.pending > 1 ? 's' : ''} waiting for activation</span>
          <span className="ml-auto text-xs underline">View →</span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 text-gray-300">
            <Icon.Users />
          </div>
          <p className="text-gray-900 font-medium">No users found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? `No results for "${search}"` : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
          <div className="flex flex-col gap-3">
            {filtered.map(user => (
              <UserRow
                key={user.id}
                user={user}
                currentUserId={profile?.id}
                onEdit={u => setEditUser(u)}
                onActivate={u => setConfirmAction({ user: u, type: 'activate' })}
                onDeactivate={u => setConfirmAction({ user: u, type: 'deactivate' })}
              />
            ))}
          </div>
        </>
      )}

      {/* Edit modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onSave={handleSaveEdit}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* Confirm modals */}
      {confirmAction?.type === 'activate' && (
        <Confirm
          message={`Activate ${confirmAction.user.full_name}? They will be able to log in and access the platform.`}
          confirmLabel="Activate"
          confirmClass="bg-green-600 hover:bg-green-700"
          onConfirm={() => { handleActivate(confirmAction.user); setConfirmAction(null) }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction?.type === 'deactivate' && (
        <Confirm
          message={`Deactivate ${confirmAction.user.full_name}? They will lose access immediately.`}
          confirmLabel="Deactivate"
          confirmClass="bg-gray-700 hover:bg-gray-800"
          onConfirm={() => { handleDeactivate(confirmAction.user); setConfirmAction(null) }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </AppShell>
  )
}
