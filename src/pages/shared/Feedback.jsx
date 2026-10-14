import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── CONFIG ─────────────────────────────────────────────────
const CATEGORIES = {
  bug:        { label: 'Something is broken', short: 'Bug',        icon: '🐞', badge: 'bg-red-50 text-red-600' },
  usability:  { label: 'Hard to use',         short: 'Usability',  icon: '🧭', badge: 'bg-amber-50 text-amber-700' },
  suggestion: { label: 'Idea / improvement',  short: 'Suggestion', icon: '💡', badge: 'bg-blue-50 text-blue-700' },
  praise:     { label: 'What works well',     short: 'Praise',     icon: '👏', badge: 'bg-green-50 text-green-700' },
  other:      { label: 'Other',               short: 'Other',      icon: '💬', badge: 'bg-gray-100 text-gray-600' },
}

const AREAS = [
  'General', 'Dashboard', 'Clients', 'Appointments', 'Messages', 'Documents',
  'Roster / Availability', 'Reports', 'Notifications', 'Settings',
]

const STATUSES = {
  new:       { label: 'New',       badge: 'bg-blue-50 text-blue-700' },
  reviewing: { label: 'Reviewing', badge: 'bg-amber-50 text-amber-700' },
  planned:   { label: 'Planned',   badge: 'bg-purple-50 text-purple-700' },
  done:      { label: 'Done',      badge: 'bg-green-50 text-green-700' },
  dismissed: { label: 'Dismissed', badge: 'bg-gray-100 text-gray-500' },
}

const MAX_LEN = 2000

// ── HELPERS ────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Stars({ value, onChange, size = 'text-2xl' }) {
  const readOnly = !onChange
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(value === n ? 0 : n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={`${size} leading-none ${n <= value ? 'text-hhf-gold' : 'text-gray-200'} ${readOnly ? 'cursor-default' : 'hover:scale-110 transition-transform'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ── SUBMIT FORM ────────────────────────────────────────────
function FeedbackForm({ onSubmitted, profile }) {
  const [category, setCategory]   = useState('suggestion')
  const [area, setArea]           = useState('General')
  const [rating, setRating]       = useState(0)
  const [message, setMessage]     = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')

  async function submit(e) {
    e.preventDefault()
    const text = message.trim()
    if (text.length < 5) return setError('Please write a little more so we can act on it.')

    setSending(true); setError('')
    const { data, error: err } = await supabase
      .from('hhf_feedback')
      .insert({
        author_id: profile.id,
        category,
        area,
        rating: rating || null,
        message: text,
        is_anonymous: anonymous,
      })
      .select()
      .single()

    if (err) { setError(err.message); setSending(false); return }

    // Non-blocking side effects: tell admins + write the audit trail.
    try {
      const { data: admins } = await supabase
        .from('hhf_profiles').select('id').eq('role', 'admin').eq('status', 'active')
      const targets = (admins || []).filter(a => a.id !== profile.id)
      if (targets.length) {
        const who = anonymous ? 'A team member' : profile.full_name
        await supabase.from('hhf_notifications').insert(
          targets.map(a => ({
            recipient_id: a.id,
            type:  'feedback_new',
            title: 'New Feedback Received',
            body:  `${who} shared ${category === 'bug' ? 'a bug report' : 'feedback'} about ${area}.`,
            link:  '/admin/feedback',
          }))
        )
      }
      await supabase.from('hhf_audit_logs').insert({
        actor_id: profile.id, action: 'feedback_submitted',
        target_type: 'feedback', target_id: data.id,
      })
    } catch { /* non-blocking */ }

    setMessage(''); setRating(0); setAnonymous(false); setCategory('suggestion'); setArea('General')
    setSending(false)
    onSubmitted(data)
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Share your feedback</p>
        <p className="text-xs text-gray-400 mt-0.5">Tell us what's working, what's frustrating, or what we should build next.</p>
      </div>

      {/* Category */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategory(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              category === key
                ? 'bg-hhf-blue text-white border-hhf-blue'
                : 'bg-white text-gray-600 border-gray-200 hover:border-hhf-blue hover:text-hhf-blue'
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Which part of the app?</label>
          <select className="input-field" value={area} onChange={e => setArea(e.target.value)}>
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Overall experience (optional)</label>
          <Stars value={rating} onChange={setRating} />
        </div>
      </div>

      <div>
        <textarea
          className="input-field min-h-[110px] resize-y"
          placeholder="What happened, or what would make this better? The more specific, the better."
          value={message}
          maxLength={MAX_LEN}
          onChange={e => setMessage(e.target.value)}
        />
        <div className="text-right text-[11px] text-gray-400 mt-1">{message.length}/{MAX_LEN}</div>
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />
        <span>
          Hide my name from admins
          <span className="block text-gray-400">You'll still see your own submission and any replies.</span>
        </span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? 'Sending…' : 'Submit feedback'}
        </button>
      </div>
    </form>
  )
}

// ── SINGLE FEEDBACK CARD ───────────────────────────────────
function FeedbackCard({ item, isAdmin, authorName, isMine, onSave, onDelete }) {
  const cat = CATEGORIES[item.category] || CATEGORIES.other
  const st  = STATUSES[item.status] || STATUSES.new

  const [open, setOpen]         = useState(false)
  const [status, setStatus]     = useState(item.status)
  const [response, setResponse] = useState(item.admin_response || '')
  const [saving, setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const dirty = status !== item.status || response.trim() !== (item.admin_response || '')

  async function save() {
    setSaving(true)
    await onSave(item, { status, response: response.trim() })
    setSaving(false)
  }

  const byline = item.is_anonymous
    ? (isMine ? 'You (hidden from admins)' : 'Anonymous')
    : (isMine ? 'You' : authorName || 'Unknown')

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cat.badge}`}>{cat.icon} {cat.short}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.badge}`}>{st.label}</span>
          {item.area && <span className="text-xs text-gray-400">· {item.area}</span>}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(item.created_at)}</span>
      </div>

      <p className="text-sm text-gray-800 mt-3 whitespace-pre-wrap break-words">{item.message}</p>

      <div className="flex items-center justify-between mt-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-gray-500 truncate">{byline}</span>
          {item.rating > 0 && <Stars value={item.rating} size="text-sm" />}
        </div>
        {isAdmin && (
          <button onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-hhf-blue hover:underline flex-shrink-0">
            {open ? 'Close' : item.admin_response ? 'Edit reply' : 'Review & reply'}
          </button>
        )}
      </div>

      {/* Admin reply — visible to everyone, editable by admins */}
      {item.admin_response && !open && (
        <div className="mt-3 bg-hhf-blue-pale rounded-lg px-3 py-2.5">
          <p className="text-[11px] font-semibold text-hhf-blue mb-0.5">
            Response from admin · {timeAgo(item.responded_at)}
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{item.admin_response}</p>
        </div>
      )}

      {isAdmin && open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUSES).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    status === key ? 'bg-hhf-blue text-white border-hhf-blue' : 'bg-white text-gray-600 border-gray-200 hover:border-hhf-blue'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Reply to the author (optional)</label>
            <textarea
              className="input-field min-h-[80px] resize-y"
              placeholder="Let them know what you're doing about it…"
              maxLength={MAX_LEN}
              value={response}
              onChange={e => setResponse(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            {confirmDel ? (
              <span className="text-xs">
                Delete permanently?{' '}
                <button onClick={() => onDelete(item)} className="font-semibold text-hhf-red hover:underline">Yes, delete</button>
                {' · '}
                <button onClick={() => setConfirmDel(false)} className="text-gray-500 hover:underline">Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="text-xs text-gray-400 hover:text-hhf-red">Delete</button>
            )}
            <button onClick={save} disabled={!dirty || saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PAGE ───────────────────────────────────────────────────
export default function Feedback() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [items, setItems]       = useState([])
  const [names, setNames]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [catFilter, setCatFilter]       = useState('all')
  const [toast, setToast]       = useState('')

  const flash = useCallback(msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true); setLoadError('')

    let q = supabase.from('hhf_feedback').select('*').order('created_at', { ascending: false }).limit(200)
    if (!isAdmin) q = q.eq('author_id', profile.id)

    const { data, error } = await q
    if (error) { setLoadError(error.message); setLoading(false); return }
    setItems(data || [])

    // Admins need author names (feedback.author_id points at auth.users,
    // so we look names up separately rather than via an embedded join).
    if (isAdmin && data?.length) {
      const ids = [...new Set(data.filter(f => !f.is_anonymous).map(f => f.author_id))]
      if (ids.length) {
        const { data: people } = await supabase.from('hhf_profiles').select('id, full_name').in('id', ids)
        setNames(Object.fromEntries((people || []).map(p => [p.id, p.full_name])))
      }
    }
    setLoading(false)
  }, [profile?.id, isAdmin])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount, same pattern used elsewhere in this codebase
  useEffect(() => { load() }, [load])

  // Admin: save status + reply, notify the author, write audit log.
  async function saveReview(item, { status, response }) {
    const patch = {
      status,
      admin_response: response || null,
      ...(response ? { responded_by: profile.id, responded_at: new Date().toISOString() } : {}),
    }
    const { data, error } = await supabase
      .from('hhf_feedback').update(patch).eq('id', item.id).select().single()
    if (error) return flash(`Couldn't save: ${error.message}`)

    setItems(prev => prev.map(f => (f.id === item.id ? data : f)))

    const statusChanged   = status !== item.status
    const responseChanged = (response || '') !== (item.admin_response || '')
    if ((statusChanged || responseChanged) && item.author_id !== profile.id) {
      try {
        await supabase.from('hhf_notifications').insert({
          recipient_id: item.author_id,
          type:  'feedback_update',
          title: responseChanged ? 'Admin replied to your feedback' : 'Your feedback was updated',
          body:  responseChanged
            ? response.slice(0, 140)
            : `Status changed to "${STATUSES[status].label}".`,
          link:  '/staff/feedback',
        })
      } catch { /* non-blocking */ }
    }
    try {
      await supabase.from('hhf_audit_logs').insert({
        actor_id: profile.id, action: 'feedback_reviewed',
        target_type: 'feedback', target_id: item.id,
      })
    } catch { /* non-blocking */ }

    flash('Saved.')
  }

  async function deleteItem(item) {
    const { error } = await supabase.from('hhf_feedback').delete().eq('id', item.id)
    if (error) return flash(`Couldn't delete: ${error.message}`)
    setItems(prev => prev.filter(f => f.id !== item.id))
    flash('Deleted.')
  }

  // ── Derived data ──────────────────────────────────────────
  const stats = useMemo(() => {
    const rated = items.filter(i => i.rating)
    return {
      total:   items.length,
      open:    items.filter(i => i.status === 'new' || i.status === 'reviewing').length,
      planned: items.filter(i => i.status === 'planned').length,
      done:    items.filter(i => i.status === 'done').length,
      avg:     rated.length ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(1) : '–',
    }
  }, [items])

  const visible = useMemo(() => items.filter(i =>
    (statusFilter === 'all' || i.status === statusFilter) &&
    (catFilter === 'all'    || i.category === catFilter)
  ), [items, statusFilter, catFilter])

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isAdmin
            ? 'Review what your team is telling you about the platform.'
            : 'Help us make CareConnect better for you and your clients.'}
        </p>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <FeedbackForm
        profile={profile}
        onSubmitted={row => { setItems(prev => [row, ...prev]); flash('Thank you — feedback sent.') }}
      />

      {/* Admin summary */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            ['Total',        stats.total],
            ['Needs review', stats.open],
            ['Planned',      stats.planned],
            ['Done',         stats.done],
            ['Avg. rating',  stats.avg === '–' ? '–' : `${stats.avg} ★`],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mr-2">{isAdmin ? 'All feedback' : 'My feedback'}</h2>
        {['all', ...Object.keys(STATUSES)].map(key => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === key ? 'bg-hhf-blue text-white border-hhf-blue' : 'bg-white text-gray-500 border-gray-200 hover:border-hhf-blue'
            }`}
          >
            {key === 'all' ? 'All' : STATUSES[key].label}
          </button>
        ))}
        <select
          className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.short}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-10 text-sm text-red-600">
          Couldn't load feedback: {loadError}
          <div className="text-xs text-gray-400 mt-1">Has the <code>hhf_feedback</code> table been created in Supabase?</div>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {items.length === 0 ? 'No feedback yet.' : 'Nothing matches those filters.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(item => (
            <FeedbackCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              isMine={item.author_id === profile.id}
              authorName={names[item.author_id]}
              onSave={saveReview}
              onDelete={deleteItem}
            />
          ))}
        </div>
      )}
    </AppShell>
  )
}