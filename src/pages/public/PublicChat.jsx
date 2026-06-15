import { useState, useEffect, useRef } from 'react'
import bcrypt from 'bcryptjs'
import { supabase } from '../../lib/supabase'

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

function ReadTick({ status, mine }) {
  if (!mine) return null
  if (status === 'read') return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" className="inline-block text-blue-500">
      <path d="M1 5.5L4.5 9L10.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 5.5L10.5 9L16.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="inline-block text-gray-400">
      <path d="M1 5.5L4.5 9L10 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── VISITOR FORM ────────────────────────────────────────────
function VisitorForm({ onStart, onReturn }) {
  const [mode, setMode]   = useState('new')
  const [form, setForm]   = useState({ name: '', phone: '', email: '', password: '', confirm: '', message: '' })
  const [ret, setRet]     = useState({ phone: '', password: '' })
  const [errors, setErrors] = useState({})
  const [retError, setRetError] = useState('')
  const [loading, setLoading]   = useState(false)

  function upd(e)    { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setErrors(p => ({ ...p, [e.target.name]: undefined })) }
  function updRet(e) { setRet(r => ({ ...r, [e.target.name]: e.target.value })) }

  function validate() {
    const e = {}
    if (!form.name.trim())    e.name    = 'Required'
    if (!form.phone.trim())   e.phone   = 'Required'
    if (!form.password)       e.password = 'Required'
    if (form.password.length < 6) e.password = 'Min 6 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    if (!form.message.trim()) e.message = 'Required'
    return e
  }

  async function handleNew(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    await onStart(form)
    setLoading(false)
  }

  async function handleReturn(e) {
    e.preventDefault()
    setRetError('')
    setLoading(true)
    await onReturn(ret, setRetError)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">HHF</div>
            <div>
              <div className="font-bold text-lg">Hossanah Help Foundation</div>
              <div className="text-white/80 text-sm">Changing One Story at a Time</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-white/90">We are here to help. Start a conversation.</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button onClick={() => setMode('new')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${mode === 'new' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>
            New Conversation
          </button>
          <button onClick={() => setMode('return')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${mode === 'return' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>
            Continue Chat
          </button>
        </div>

        <div className="p-6">
          {mode === 'new' ? (
            <form onSubmit={handleNew} className="space-y-4">
              {[
                { label: 'Full Name *', name: 'name', type: 'text', placeholder: 'Your full name' },
                { label: 'Phone Number *', name: 'phone', type: 'tel', placeholder: '+234 800 000 0000' },
                { label: 'Email Address (optional)', name: 'email', type: 'email', placeholder: 'your@email.com' },
                { label: 'Create Password *', name: 'password', type: 'password', placeholder: 'Min 6 characters' },
                { label: 'Confirm Password *', name: 'confirm', type: 'password', placeholder: 'Repeat password' },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
                  <input name={f.name} type={f.type} value={form[f.name]} onChange={upd}
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 ${errors[f.name] ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder={f.placeholder} />
                  {errors[f.name] && <p className="text-xs text-red-500 mt-1">{errors[f.name]}</p>}
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">How can we help? *</label>
                <textarea name="message" value={form.message} onChange={upd} rows={3}
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 resize-none ${errors.message ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="Tell us what is on your mind..." />
                {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)' }}>
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {loading ? 'Connecting...' : 'Start Conversation'}
              </button>
              <p className="text-center text-xs text-gray-400">Your information is kept private and secure.</p>
            </form>
          ) : (
            <form onSubmit={handleReturn} className="space-y-4">
              <p className="text-sm text-gray-500">Enter your phone number and password to continue your previous conversation.</p>
              {retError && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-lg">{retError}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
                <input name="phone" value={ret.phone} onChange={updRet} required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="+234 800 000 0000" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <input name="password" type="password" value={ret.password} onChange={updRet} required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Your chat password" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#1a5fa8' }}>
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Continue My Conversation'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CHAT WINDOW ─────────────────────────────────────────────
function ChatWindow({ visitor, convoId }) {
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg]     = useState('')
  const [sending, setSending]   = useState(false)
  const [staffOnline, setStaffOnline] = useState(false)
  const bottomRef = useRef(null)
  const textRef   = useRef(null)
  const visitorRef = useRef(visitor)

  useEffect(() => { visitorRef.current = visitor }, [visitor])

  // Mark all unread messages from staff as read
  async function markAllRead(msgs) {
    const unread = msgs
      .filter(m => m.sender_id !== visitorRef.current.id && m.status !== 'read')
      .map(m => m.id)
    if (unread.length > 0) {
      await supabase.rpc('hhf_mark_messages_read', { message_ids: unread })
      setMessages(prev => prev.map(m =>
        unread.includes(m.id) ? { ...m, status: 'read', read_at: new Date().toISOString() } : m
      ))
    }
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('hhf_messages')
      .select('id, body, sender_id, is_away_reply, created_at, status, read_at, attachments:hhf_message_attachments(id, file_name, storage_path, mime_type, file_size)')
      .eq('conversation_id', convoId)
      .order('created_at')
    if (data) {
      setMessages(data)
      markAllRead(data)
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function checkStaffOnline() {
    const { data } = await supabase
      .from('hhf_profiles')
      .select('id')
      .in('role', ['admin', 'staff'])
      .eq('online_status', 'online')
      .limit(1)
    setStaffOnline((data?.length || 0) > 0)
  }

  useEffect(() => {
    loadMessages()
    checkStaffOnline()

    const sub = supabase
      .channel(`public_chat_${convoId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hhf_messages',
        filter: `conversation_id=eq.${convoId}`
      }, async payload => {
        const msg = payload.new
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        // If this is a staff message, mark it read immediately
        if (msg.sender_id !== visitorRef.current.id) {
          await supabase.rpc('hhf_mark_messages_read', { message_ids: [msg.id] })
          setMessages(prev => prev.map(m =>
            m.id === msg.id ? { ...m, status: 'read', read_at: new Date().toISOString() } : m
          ))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'hhf_messages',
        filter: `conversation_id=eq.${convoId}`
      }, payload => {
        // Staff read our message — update tick
        setMessages(prev => prev.map(m =>
          m.id === payload.new.id
            ? { ...m, status: payload.new.status, read_at: payload.new.read_at }
            : m
        ))
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [convoId])

  async function sendMessage() {
    const body = newMsg.trim()
    if (!body || sending) return
    setSending(true)
    await supabase.from('hhf_messages').insert({
      conversation_id: convoId,
      sender_id: visitor.id,
      body,
      status: 'sent'
    })
    setNewMsg('')
    textRef.current?.focus()
    setSending(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f4f8' }}>
      {/* Header */}
      <div className="text-white px-4 py-3 flex items-center gap-3 flex-shrink-0"
           style={{ background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)' }}>
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">HHF</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Hossanah Help Foundation</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${staffOnline ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-xs text-white/80">{staffOnline ? 'Team online' : 'We will reply soon'}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-white/70">Chatting as</div>
          <div className="text-xs font-semibold text-white truncate max-w-24">{visitor.full_name}</div>
          <button
            onClick={() => { localStorage.removeItem('hhf_visitor_session'); window.location.href = '/chat?new=1' }}
            className="text-xs text-white/50 hover:text-white/80 underline mt-0.5 block">
            Not you?
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex justify-center">
          <div className="bg-white rounded-xl px-4 py-3 text-xs text-gray-500 text-center shadow-sm max-w-xs">
            <div className="font-semibold text-gray-700 mb-1">Welcome to HHF Connect</div>
            A member of our team will be with you shortly.
          </div>
        </div>

        {messages.map(msg => {
          const mine = msg.sender_id === visitor.id
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && (
                  <div className="text-xs text-gray-400 px-1">HHF Team</div>
                )}
                {(() => {
                  const att = msg.attachments?.[0]
                  if (att) {
                    const { data: urlData } = supabase.storage.from('hhf-documents').getPublicUrl(att.storage_path)
                    const url = urlData?.publicUrl
                    if (att.mime_type?.startsWith('image/')) return (
                      <img src={url} alt={att.file_name}
                        className="rounded-xl max-w-full max-h-48 object-cover cursor-pointer border border-gray-200"
                        onClick={() => window.open(url, '_blank')} />
                    )
                    return (
                      <a href={url} target="_blank" rel="noreferrer"
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${mine ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="truncate max-w-40">{att.file_name}</span>
                      </a>
                    )
                  }
                  return (
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      mine ? 'bg-blue-600 text-white rounded-br-sm' :
                      msg.is_away_reply ? 'bg-amber-50 border border-amber-200 text-amber-900 italic rounded-bl-sm' :
                      'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                    }`}>
                      {msg.is_away_reply && <div className="text-xs font-semibold mb-1 opacity-60">Auto-reply</div>}
                      {msg.body}
                    </div>
                  )
                })()}
                <div className={`flex items-center gap-1 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs text-gray-400">{timeStr(msg.created_at)}</span>
                  <ReadTick status={msg.status} mine={mine} />
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0 flex items-end gap-2">
        <textarea ref={textRef} value={newMsg} onChange={e => setNewMsg(e.target.value)}
          onKeyDown={handleKey} rows={1} placeholder="Type your message..."
          className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
          style={{ minHeight: '40px', maxHeight: '100px' }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
        />
        <button onClick={sendMessage} disabled={!newMsg.trim() || sending}
          className="w-10 h-10 rounded-xl text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          style={{ background: '#1a5fa8' }}>
          {sending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
          }
        </button>
      </div>

      <div className="text-center py-2 bg-white border-t border-gray-50">
        <span className="text-xs text-gray-300">Powered by </span>
        <span className="text-xs font-semibold" style={{ color: '#1a5fa8' }}>HHF Connect</span>
      </div>
    </div>
  )
}

// ── MAIN ────────────────────────────────────────────────────
export default function PublicChat() {
  const [step, setStep]       = useState('loading')
  const [visitor, setVisitor] = useState(null)
  const [convoId, setConvoId] = useState(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') === '1') {
      localStorage.removeItem('hhf_visitor_session')
      setStep('form'); return
    }
    const saved = localStorage.getItem('hhf_visitor_session')
    if (saved) {
      try {
        const { visitor: v, convoId: cid } = JSON.parse(saved)
        if (v?.id && cid) { setVisitor(v); setConvoId(cid); setStep('chat'); return }
      } catch (_) { localStorage.removeItem('hhf_visitor_session') }
    }
    setStep('form')
  }, [])

  async function handleStart(form) {
    setError('')
    try {
      // Check phone not already registered
      const { data: existing } = await supabase
        .from('hhf_guest_profiles')
        .select('id, full_name, phone')
        .eq('phone', form.phone)
        .eq('app', 'hhf')
        .maybeSingle()

      if (existing) {
        setError('This phone number is already registered. Please use "Continue Chat" to log in.')
        return
      }

      // Hash password
      const salt = bcrypt.genSaltSync(10)
      const password_hash = bcrypt.hashSync(form.password, salt)

      // Create guest profile
      const { data: guest, error: gErr } = await supabase
        .from('hhf_guest_profiles')
        .insert({ app: 'hhf', full_name: form.name, phone: form.phone, email: form.email || null, password_hash })
        .select().single()

      if (gErr) throw new Error(gErr.message)

      // Find available staff/admin
      const { data: onlineStaff } = await supabase
        .from('hhf_profiles')
        .select('id')
        .in('role', ['admin', 'staff'])
        .eq('status', 'active')
        .eq('online_status', 'online')
        .limit(1)

      let staffId = onlineStaff?.[0]?.id

      if (!staffId) {
        const { data: anyStaff } = await supabase
          .from('hhf_profiles')
          .select('id')
          .in('role', ['admin', 'staff'])
          .eq('status', 'active')
          .limit(1)
        staffId = anyStaff?.[0]?.id
      }

      if (!staffId) throw new Error('No staff available. Please try again later.')

      // Create conversation
      const a = guest.id < staffId ? guest.id : staffId
      const b = guest.id < staffId ? staffId : guest.id

      const { data: convo, error: cErr } = await supabase
        .from('hhf_conversations')
        .insert({ participant_a: a, participant_b: b })
        .select().single()

      if (cErr) throw new Error(cErr.message)

      // Send first message
      await supabase.from('hhf_messages').insert({
        conversation_id: convo.id,
        sender_id: guest.id,
        body: form.message,
        status: 'sent'
      })

      // Notify staff
      await supabase.from('hhf_notifications').insert({
        user_id: staffId,
        type: 'new_message',
        title: `New chat from ${form.name}`,
        body: form.message.slice(0, 80),
        link: `/admin/messages?convo=${convo.id}`
      })

      // Check away message
      const { data: awayMsg } = await supabase
        .from('hhf_away_messages')
        .select('body')
        .eq('staff_id', staffId)
        .eq('is_active', true)
        .maybeSingle()

      if (awayMsg) {
        await supabase.from('hhf_messages').insert({
          conversation_id: convo.id,
          sender_id: staffId,
          body: awayMsg.body,
          status: 'sent',
          is_away_reply: true
        })
      }

      // Save session
      const session = { visitor: { id: guest.id, full_name: guest.full_name, phone: guest.phone }, convoId: convo.id }
      localStorage.setItem('hhf_visitor_session', JSON.stringify(session))

      setVisitor(guest)
      setConvoId(convo.id)
      setStep('chat')

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  async function handleReturn(form, setRetError) {
    try {
      const { data: guest } = await supabase
        .from('hhf_guest_profiles')
        .select('id, full_name, phone, password_hash')
        .eq('phone', form.phone)
        .eq('app', 'hhf')
        .maybeSingle()

      if (!guest)             { setRetError('Phone number not found. Please start a new conversation.'); return }
      if (!guest.password_hash) { setRetError('No password set. Please start a new conversation.'); return }

      const valid = bcrypt.compareSync(form.password, guest.password_hash)
      if (!valid) { setRetError('Incorrect password. Please try again.'); return }

      const { data: convo } = await supabase
        .from('hhf_conversations')
        .select('id')
        .or(`participant_a.eq.${guest.id},participant_b.eq.${guest.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!convo) { setRetError('No conversation found for this account.'); return }

      const session = { visitor: { id: guest.id, full_name: guest.full_name, phone: guest.phone }, convoId: convo.id }
      localStorage.setItem('hhf_visitor_session', JSON.stringify(session))

      setVisitor(guest)
      setConvoId(convo.id)
      setStep('chat')

    } catch (err) {
      setRetError('Something went wrong. Please try again.')
    }
  }

  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)' }}>
      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (step === 'chat' && visitor && convoId) {
    return <ChatWindow visitor={visitor} convoId={convoId} />
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl shadow-lg">
          {error}
          <button onClick={() => setError('')} className="float-right text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      <VisitorForm onStart={handleStart} onReturn={handleReturn} />
    </>
  )
}
