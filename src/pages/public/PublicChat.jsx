import { useState, useEffect, useRef } from 'react'
import bcrypt from 'bcryptjs'
import { supabase } from '../../lib/supabase'
import { assignStaffForNewConversation, notifyStaffOfConversation, escalateConversation, AWAY_MESSAGE_MINUTES } from '../../lib/roster'
import { joinConversationPresence, leaveConversationPresence, broadcastTyping, isViewerPresent } from '../../lib/presence'

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

function ReadTick({ status, mine }) {
  if (!mine) return null
  const seen = status === 'read'
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="inline-block">
      <path d="M1 5.5L4.5 9L10 2"
        stroke={seen ? '#1a5fa8' : '#9ca3af'}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── VISITOR FORM ────────────────────────────────────────────
function VisitorForm({ onStart, onReturn }) {
  const [mode, setMode]   = useState('new')
  const [form, setForm]   = useState({ name: '', category: '', message: '' })
  const CATEGORIES = ['General Inquiry', 'Medical Assistance', 'Education Support', 'Food Assistance', 'Counseling', 'Other']
  const [ret, setRet]     = useState({ phone: '', password: '' })
  const [errors, setErrors] = useState({})
  const [retError, setRetError] = useState('')
  const [loading, setLoading]   = useState(false)

  function upd(e)    { setForm(f => ({ ...f, [e.target.name]: e.target.value })); setErrors(p => ({ ...p, [e.target.name]: undefined })) }
  function updRet(e) { setRet(r => ({ ...r, [e.target.name]: e.target.value })) }

  function validate() {
    const e = {}
    if (!form.category)       e.category = 'Required'
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
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name (or nickname)</label>
                <input name="name" type="text" value={form.name} onChange={upd}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="What should we call you? (optional)" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">What is this about? *</label>
                <select name="category" value={form.category} onChange={upd}
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 bg-white ${errors.category ? 'border-red-400' : 'border-gray-200'}`}>
                  <option value="">Select a category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
              </div>
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
  const [staffOnline, setStaffOnline] = useState(null) // null = still checking, avoids flashing the wrong state before the first check resolves
  const [showBooking, setShowBooking] = useState(false)
  const [bookingForm, setBookingForm] = useState({ date: '', time: '', note: '' })
  const [bookingSent, setBookingSent] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [savePromptDismissed, setSavePromptDismissed] = useState(false)
  const [hasAccount, setHasAccount] = useState(true) // assume true until checked, to avoid a flash of the prompt
  const [saveForm, setSaveForm] = useState({ phone: '', email: '', password: '', confirm: '' })
  const [saveErrors, setSaveErrors] = useState({})
  const [saveSubmitting, setSaveSubmitting] = useState(false)
  const [saveDone, setSaveDone] = useState(false)
  const [convoStatus, setConvoStatus] = useState('active')
  const [assignedStaffId, setAssignedStaffId] = useState(null)
  const [staffTyping, setStaffTyping] = useState(false)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const stopTypingTimeoutRef = useRef(null)
  const awayTimerRef  = useRef(null)
  const staffReplied  = useRef(false)
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

      // If the visitor is loading (or reloading) the page and the most
      // recent message is already an away-reply — e.g. sent earlier by the
      // server-side cron job while their browser was closed — show the
      // booking card immediately rather than only reacting to a live
      // realtime INSERT, which they'd have missed entirely. Skip this if
      // they've already booked an appointment (bookingSent is only local
      // React state and resets on reload, so we check the real record).
      const lastMsg = data[data.length - 1]
      if (lastMsg?.is_away_reply) {
        const { data: existingAppt } = await supabase
          .from('hhf_appointments')
          .select('id')
          .eq('client_id', visitorRef.current.id)
          .limit(1)
          .maybeSingle()
        if (existingAppt) {
          setBookingSent(true)
        } else {
          setShowBooking(true)
        }
      }
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function checkStaffOnline() {
    const staleCutoff = new Date(Date.now() - 90 * 1000).toISOString()
    const { data } = await supabase
      .from('hhf_profiles')
      .select('id')
      .in('role', ['admin', 'staff'])
      .eq('online_status', 'online')
      .gte('last_seen_at', staleCutoff)
      .limit(1)
    setStaffOnline((data?.length || 0) > 0)
  }

  // Find out whether this guest already saved an account (has a password),
  // so we don't nag someone who's already set one up.
  async function checkHasAccount() {
    const { data } = await supabase
      .from('hhf_guest_profiles')
      .select('password_hash')
      .eq('id', visitorRef.current.id)
      .maybeSingle()
    setHasAccount(!!data?.password_hash)
  }

  async function checkConvoStatus() {
    const { data } = await supabase
      .from('hhf_conversations')
      .select('status, assigned_staff_id, participant_a, participant_b')
      .eq('id', convoId)
      .maybeSingle()
    if (data?.status) setConvoStatus(data.status)
    // Fall back to whichever participant isn't the visitor, in case an
    // older conversation was never given an assigned_staff_id.
    const fallbackStaffId = data?.participant_a === visitorRef.current.id ? data?.participant_b : data?.participant_a
    setAssignedStaffId(data?.assigned_staff_id || fallbackStaffId || null)
  }

  useEffect(() => {
    loadMessages()
    checkStaffOnline()
    checkHasAccount()
    checkConvoStatus()

    // checkStaffOnline() only reflects the moment it's called — without a
    // recheck, "Team online" could stay stuck showing true long after the
    // assigned staff member's heartbeat has actually gone stale (e.g. they
    // locked their phone or closed the app). Poll it periodically so the
    // indicator stays honest for the whole time the visitor has this page
    // open, not just at page load.
    const staffOnlinePoll = setInterval(checkStaffOnline, 45 * 1000)

    const statusSub = supabase
      .channel(`public_chat_status_${convoId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'hhf_conversations',
        filter: `id=eq.${convoId}`
      }, payload => {
        if (payload.new?.status) setConvoStatus(payload.new.status)
        if (payload.new?.assigned_staff_id) setAssignedStaffId(payload.new.assigned_staff_id)
      })
      .subscribe()

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
          // Staff replied — cancel away timer
          if (!msg.is_away_reply) {
            staffReplied.current = true
            if (awayTimerRef.current) clearTimeout(awayTimerRef.current)
          }
        }

        // Show the booking card whenever an away-reply arrives, no matter
        // where it came from. Previously this only happened as a direct
        // side-effect of the visitor's own local setTimeout finishing —
        // which meant away-messages sent by the server-side cron job (which
        // has no connection to any visitor's browser state) never triggered
        // the booking card at all, even though the text of the message
        // still offered one. Reacting to the message itself, via realtime,
        // works regardless of which mechanism actually sent it.
        if (msg.is_away_reply) {
          setShowBooking(true)
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

    return () => {
      supabase.removeChannel(sub)
      supabase.removeChannel(statusSub)
      clearInterval(staffOnlinePoll)
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current)
    }
  }, [convoId])

  // ── PRESENCE: join this conversation's presence channel while it's open
  // on screen, so staff can suppress redundant notifications when they
  // already have this exact chat open, and so we can show a "staff is
  // typing" indicator.
  useEffect(() => {
    const channel = joinConversationPresence(
      convoId,
      { id: visitorRef.current.id, role: 'visitor' },
      {
        onTyping: ({ role, typing }) => {
          if (role !== 'staff') return
          setStaffTyping(typing)
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          if (typing) {
            typingTimeoutRef.current = setTimeout(() => setStaffTyping(false), 4000)
          }
        },
      }
    )
    presenceChannelRef.current = channel

    return () => {
      leaveConversationPresence(channel)
      presenceChannelRef.current = null
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [convoId])

  // Once the visitor has sent a few messages, gently offer to save the
  // conversation so they can pick it back up later — instead of asking for
  // a password up front before they've even gotten help.
  useEffect(() => {
    if (hasAccount || savePromptDismissed || showSavePrompt) return
    const visitorMessages = messages.filter(m => m.sender_id === visitor.id).length
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived UI trigger from message count, same pattern used elsewhere in this file (e.g. the away-message effect)
    if (visitorMessages >= 3) setShowSavePrompt(true)
  }, [messages, hasAccount, savePromptDismissed, showSavePrompt, visitor.id])

  async function sendMessage() {
    const body = newMsg.trim()
    if (!body || sending || convoStatus === 'closed') return
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

    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current)
    broadcastTyping(presenceChannelRef.current, { id: visitor.id, role: 'visitor' }, false)

    // Every visitor message should notify the assigned staff member — not
    // just the first one that created the conversation. Previously only
    // the initial message triggered a notification (in handleStart), so
    // any follow-up message from the visitor went completely unnoticed by
    // staff unless they happened to already have the chat open.
    //
    // Exception: if the assigned staff member is *already looking at this
    // exact conversation* (confirmed via presence), skip the notification —
    // they'll see the message arrive live in the thread, and a bell/badge
    // on top of that would just be redundant noise, not real WhatsApp/
    // Messenger-style behavior.
    const staffAlreadyPresent = isViewerPresent(presenceChannelRef.current, assignedStaffId)
    if (assignedStaffId && !staffAlreadyPresent) {
      await notifyStaffOfConversation({
        staffId: assignedStaffId,
        title: `${visitor.full_name || 'Visitor'} sent a new message`,
        body,
        convoId,
      })
    }

    // Start away/escalation timer on first visitor message (if staff hasn't replied yet)
    if (!staffReplied.current && !awayTimerRef.current) {
      awayTimerRef.current = setTimeout(async () => {
        if (staffReplied.current) return // staff replied in time — skip

        const { data: convoRow } = await supabase
          .from('hhf_conversations')
          .select('participant_a, participant_b, assigned_staff_id')
          .eq('id', convoId)
          .single()

        const currentStaffId = convoRow?.assigned_staff_id
          || (convoRow?.participant_a === visitor.id ? convoRow?.participant_b : convoRow?.participant_a)

        // Try to hand the conversation to someone else who is actually available
        const { staffId: newStaffId } = currentStaffId
          ? await escalateConversation(convoId, currentStaffId)
          : { staffId: null }

        // Send an away message into the chat either way, so the visitor isn't left hanging
        const { data: awayMsg } = await supabase
          .from('hhf_away_messages').select('body').eq('is_active', true).limit(1).maybeSingle()
        const awayBody = awayMsg?.body ||
          "Thanks for reaching out! Our team is currently unavailable. Would you like to book an appointment so the next available staff can follow up with you?"
        const senderForAwayMsg = newStaffId || currentStaffId
        await supabase.from('hhf_messages').insert({
          conversation_id: convoId,
          sender_id: senderForAwayMsg,
          body: awayBody,
          status: 'sent',
          is_away_reply: true,
        })

        // Reset so a fresh timer/escalation cycle can run against the newly assigned staff member
        staffReplied.current = false
        awayTimerRef.current = null

        setShowBooking(true)
      }, AWAY_MESSAGE_MINUTES * 60 * 1000)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function handleTypingChange(e) {
    setNewMsg(e.target.value)
    if (!presenceChannelRef.current) return
    broadcastTyping(presenceChannelRef.current, { id: visitor.id, role: 'visitor' }, true)
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current)
    stopTypingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(presenceChannelRef.current, { id: visitor.id, role: 'visitor' }, false)
    }, 2000)
  }

  function updSaveForm(e) {
    setSaveForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setSaveErrors(p => ({ ...p, [e.target.name]: undefined }))
  }

  function validateSaveForm() {
    const e = {}
    if (!saveForm.phone.trim()) e.phone = 'Required'
    if (!saveForm.password) e.password = 'Required'
    else if (saveForm.password.length < 6) e.password = 'Min 6 characters'
    if (saveForm.password !== saveForm.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  async function saveAccount(e) {
    e.preventDefault()
    const errs = validateSaveForm()
    if (Object.keys(errs).length) { setSaveErrors(errs); return }
    setSaveSubmitting(true)
    setSaveErrors({})
    try {
      // Make sure this phone isn't already tied to a different guest account
      const { data: existing } = await supabase
        .from('hhf_guest_profiles')
        .select('id')
        .eq('phone', saveForm.phone)
        .eq('app', 'hhf')
        .neq('id', visitor.id)
        .maybeSingle()

      if (existing) {
        setSaveErrors({ phone: 'This phone number is already registered to another conversation.' })
        setSaveSubmitting(false)
        return
      }

      const salt = bcrypt.genSaltSync(10)
      const password_hash = bcrypt.hashSync(saveForm.password, salt)

      const { error: updErr } = await supabase
        .from('hhf_guest_profiles')
        .update({ phone: saveForm.phone, email: saveForm.email || null, password_hash })
        .eq('id', visitor.id)

      if (updErr) { setSaveErrors({ phone: updErr.message }); setSaveSubmitting(false); return }

      setHasAccount(true)
      setSaveDone(true)
      setSaveSubmitting(false)
      setTimeout(() => setShowSavePrompt(false), 2000)
    } catch (err) {
      setSaveErrors({ phone: err.message || 'Something went wrong. Please try again.' })
      setSaveSubmitting(false)
    }
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
            <span className={`w-2 h-2 rounded-full ${staffOnline === null ? 'bg-white/50' : staffOnline ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span className="text-xs text-white/80">
              {staffOnline === null ? 'Connecting…' : staffOnline ? 'Team online' : 'We will reply soon'}
            </span>
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

      {/* Persistent reminder to save the conversation — stays available even
          after the one-time inline prompt is dismissed, so the chance to
          create login details is never permanently gone. */}
      {!hasAccount && !showSavePrompt && (
        <button
          onClick={() => { setShowSavePrompt(true); setSavePromptDismissed(false) }}
          className="w-full px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors flex-shrink-0 text-left">
          🔒 Create a secure login so you can revisit this chat anytime — Tap to set up
        </button>
      )}

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

      {/* Appointment booking card — shown after away timer fires */}
      {showBooking && !bookingSent && (
        <div className="mx-3 mb-2 bg-white border border-blue-200 rounded-2xl p-4 shadow-sm flex-shrink-0">
          <p className="text-sm font-semibold text-gray-900 mb-1">📅 Book an Appointment</p>
          <p className="text-xs text-gray-500 mb-3">Our team will follow up with you as soon as possible.</p>
          {bookingError && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{bookingError}</div>
          )}
          <div className="space-y-2">
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={bookingForm.date}
              onChange={e => setBookingForm(f => ({ ...f, date: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Preferred time (e.g. 10:00 AM)"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={bookingForm.time}
              onChange={e => setBookingForm(f => ({ ...f, time: e.target.value }))}
            />
            <textarea
              placeholder="Any additional notes? (optional)"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={bookingForm.note}
              onChange={e => setBookingForm(f => ({ ...f, note: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowBooking(false)}
                className="flex-1 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Dismiss
              </button>
              <button
                onClick={async () => {
                  if (!bookingForm.date) return
                  // Create appointment record
                  const { data: staffRow } = await supabase
                    .from('hhf_conversations').select('participant_a, participant_b').eq('id', convoId).single()
                  const staffId = staffRow?.participant_a === visitor.id ? staffRow?.participant_b : staffRow?.participant_a
                  const scheduledAt = new Date(`${bookingForm.date}T${bookingForm.time.includes(':') ? bookingForm.time.slice(0,5) : '09:00'}`)
                  const { error: apptError } = await supabase.from('hhf_appointments').insert({
                    staff_id:        staffId,
                    client_id:       visitor.id,
                    booked_by:       visitor.id,
                    scheduled_at:    scheduledAt.toISOString(),
                    duration_minutes: 60,
                    service_type:    'Public Chat Follow-up',
                    notes:           bookingForm.note || null,
                    status:          'pending',
                  })
                  if (apptError) {
                    // Don't silently claim success if the insert actually
                    // failed (e.g. an RLS policy gap) — this was the exact
                    // bug that made bookings look confirmed to the visitor
                    // while nothing ever reached staff.
                    setBookingError('Something went wrong requesting that appointment. Please try again, or send us a message directly.')
                    return
                  }
                  // Confirm in chat
                  await supabase.from('hhf_messages').insert({
                    conversation_id: convoId,
                    sender_id:       staffId,
                    body:            `✅ Appointment requested for ${new Date(bookingForm.date).toLocaleDateString('en-NG', { weekday:'long', day:'numeric', month:'long' })}${bookingForm.time ? ' at ' + bookingForm.time : ''}. Our team will confirm shortly.`,
                    status:          'sent',
                    is_away_reply:   true,
                  })
                  setBookingSent(true)
                  setShowBooking(false)
                  setBookingError('')
                }}
                disabled={!bookingForm.date}
                className="flex-1 py-2 text-xs font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                Request Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save conversation prompt — appears after a few messages, not up front */}
      {showSavePrompt && (
        <div className="mx-3 mb-2 bg-white border border-blue-200 rounded-2xl p-4 shadow-sm flex-shrink-0">
          {saveDone ? (
            <p className="text-sm font-medium text-green-700 flex items-center gap-2">
              ✅ Saved! You can continue this conversation anytime from "Continue Chat".
            </p>
          ) : (
            <form onSubmit={saveAccount}>
              <p className="text-sm font-semibold text-gray-900 mb-1">💬 Save this conversation?</p>
              <p className="text-xs text-gray-500 mb-3">
                Add a phone number and password so you can continue this chat later, even after closing the app.
              </p>
              <div className="space-y-2">
                <div>
                  <input
                    name="phone" type="tel" value={saveForm.phone} onChange={updSaveForm}
                    placeholder="+234 800 000 0000"
                    className={`w-full text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${saveErrors.phone ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {saveErrors.phone && <p className="text-xs text-red-500 mt-1">{saveErrors.phone}</p>}
                </div>
                <input
                  name="email" type="email" value={saveForm.email} onChange={updSaveForm}
                  placeholder="Email (optional)"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <input
                    name="password" type="password" value={saveForm.password} onChange={updSaveForm}
                    placeholder="Create a password (min 6 characters)"
                    className={`w-full text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${saveErrors.password ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {saveErrors.password && <p className="text-xs text-red-500 mt-1">{saveErrors.password}</p>}
                </div>
                <div>
                  <input
                    name="confirm" type="password" value={saveForm.confirm} onChange={updSaveForm}
                    placeholder="Confirm password"
                    className={`w-full text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${saveErrors.confirm ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {saveErrors.confirm && <p className="text-xs text-red-500 mt-1">{saveErrors.confirm}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowSavePrompt(false); setSavePromptDismissed(true) }}
                    className="flex-1 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                    Not now
                  </button>
                  <button
                    type="submit" disabled={saveSubmitting}
                    className="flex-1 py-2 text-xs font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                    {saveSubmitting ? 'Saving…' : 'Save Conversation'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {staffTyping && convoStatus !== 'closed' && (
        <div className="px-4 py-1.5 text-xs text-gray-400 flex-shrink-0 flex items-center gap-1.5">
          <span className="flex gap-0.5">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          Typing…
        </div>
      )}

      {/* Input */}
      {convoStatus === 'closed' ? (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex-shrink-0 text-center">
          <p className="text-sm text-gray-500">
            This conversation has been closed by our team. Start a new conversation if you need further help.
          </p>
        </div>
      ) : (
      <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0 flex items-end gap-2">
        <input
          type="file" accept="image/*,.pdf,.doc,.docx"
          className="hidden" id="guest-file-input"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const path = `${convoId}/${Date.now()}_${file.name}`
            const { error } = await supabase.storage.from('hhf-documents').upload(path, file)
            if (error) { alert('Upload failed'); return }
            const { data: msg } = await supabase.from('hhf_messages')
              .insert({ conversation_id: convoId, sender_id: visitor.id, body: null, status: 'sent' })
              .select().single()
            if (msg) {
              await supabase.from('hhf_message_attachments').insert({
                message_id: msg.id, storage_path: path, file_name: file.name,
                file_size: file.size, mime_type: file.type,
                type: file.type.startsWith('image/') ? 'image' : 'document'
              })
            }
            e.target.value = ''
          }}
        />
        <button onClick={() => document.getElementById('guest-file-input').click()}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <textarea ref={textRef} value={newMsg} onChange={handleTypingChange}
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
      )}

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
      // Create a lightweight guest profile — just a name (or "Anonymous" if
      // they skipped it). Phone/email/password are collected later, only if
      // the visitor chooses to save the conversation for later.
      const { data: guest, error: gErr } = await supabase
        .from('hhf_guest_profiles')
        .insert({ app: 'hhf', full_name: form.name?.trim() || 'Anonymous' })
        .select().single()

      if (gErr) throw new Error(gErr.message)

      // Round-robin assign to the least-busy available staff member
      const { staffId } = await assignStaffForNewConversation()

      if (!staffId) throw new Error('No staff available. Please try again later.')

      // Create conversation
      const a = guest.id < staffId ? guest.id : staffId
      const b = guest.id < staffId ? staffId : guest.id

      const { data: convo, error: cErr } = await supabase
        .from('hhf_conversations')
        .insert({
          participant_a: a,
          participant_b: b,
          category: form.category || null,
          assigned_staff_id: staffId,
          assigned_at: new Date().toISOString(),
          status: 'active',
        })
        .select().single()

      if (cErr) throw new Error(cErr.message)

      // Send first message
      await supabase.from('hhf_messages').insert({
        conversation_id: convo.id,
        sender_id: guest.id,
        body: form.message,
        status: 'sent'
      })

      // Notify the assigned staff member (correct recipient_id column, with sound/badge
      // picked up app-wide via the realtime subscription in AppShell)
      await notifyStaffOfConversation({
        staffId,
        title: `New chat from ${form.name}${form.category ? ` — ${form.category}` : ''}`,
        body: form.message,
        convoId: convo.id,
      })

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
