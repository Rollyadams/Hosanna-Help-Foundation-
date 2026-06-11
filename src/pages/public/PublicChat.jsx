import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const HHF_BLUE  = '#1a5fa8'
const HHF_GREEN = '#2e7d32'

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

// ── STEP 1: VISITOR FORM ────────────────────────────────────
function VisitorForm({ onStart }) {
  const [form, setForm]     = useState({ name: '', email: '', phone: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  function update(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  function validate() {
    const e = {}
    if (!form.name.trim())    e.name    = 'Please enter your name'
    if (!form.email.trim())   e.email   = 'Please enter your email'
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address'
    if (!form.phone.trim())   e.phone   = 'Please enter your phone number'
    if (!form.message.trim()) e.message = 'Please enter a message'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    await onStart(form)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #0d2e5e 0%, #1a5fa8 60%, #1565a0 100%)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">HHF</div>
            <div>
              <div className="font-bold text-lg leading-tight">Hossanah Help Foundation</div>
              <div className="text-white/80 text-sm">Changing One Story at a Time</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-white/90">We're here to help. Start a conversation.</span>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-5">
            Fill in your details and we will connect you with our team right away.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
              <input name="name" value={form.name} onChange={update}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 transition-colors ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
                placeholder="Your full name" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address *</label>
              <input name="email" type="email" value={form.email} onChange={update}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 transition-colors ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                placeholder="your@email.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number *</label>
              <input name="phone" value={form.phone} onChange={update}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 transition-colors ${errors.phone ? 'border-red-400' : 'border-gray-200'}`}
                placeholder="+234 800 000 0000" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">How can we help? *</label>
              <textarea name="message" value={form.message} onChange={update} rows={3}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 transition-colors resize-none ${errors.message ? 'border-red-400' : 'border-gray-200'}`}
                placeholder="Tell us what is on your mind..." />
              {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)' }}>
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connecting...</>
                : <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    Start Conversation
                  </>
              }
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4">
            Your information is kept private and secure.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── STEP 2: LIVE CHAT WINDOW ────────────────────────────────
function ChatWindow({ visitor, convoId }) {
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg]     = useState('')
  const [sending, setSending]   = useState(false)
  const [staffOnline, setStaffOnline] = useState(false)
  const bottomRef = useRef(null)
  const textRef   = useRef(null)

  useEffect(() => {
    loadMessages()
    checkStaffOnline()

    const sub = supabase
      .channel(`public_chat_${convoId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hhf_messages',
        filter: `conversation_id=eq.${convoId}`
      }, payload => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [convoId])

  async function loadMessages() {
    const { data } = await supabase
      .from('hhf_messages')
      .select('id, body, sender_id, is_away_reply, created_at, sender:sender_id(full_name, role)')
      .eq('conversation_id', convoId)
      .order('created_at')
    if (data) setMessages(data)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function checkStaffOnline() {
    const { data } = await supabase
      .from('hhf_profiles')
      .select('online_status')
      .in('role', ['admin', 'staff'])
      .eq('online_status', 'online')
      .limit(1)
    setStaffOnline((data?.length || 0) > 0)
  }

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
            <span className="text-xs text-white/80">{staffOnline ? 'Team online' : "We'll reply soon"}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-white/70">Chatting as</div>
          <div className="text-xs font-semibold text-white truncate max-w-24">{visitor.full_name}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Welcome message */}
        <div className="flex justify-center">
          <div className="bg-white rounded-xl px-4 py-3 text-xs text-gray-500 text-center shadow-sm max-w-xs">
            <div className="font-semibold text-gray-700 mb-1">Welcome to HHF Connect 👋</div>
            A member of our team will be with you shortly.
          </div>
        </div>

        {messages.map(msg => {
          const mine = msg.sender_id === visitor.id
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!mine && (
                  <div className="text-xs text-gray-400 px-1">
                    {msg.sender?.full_name || 'HHF Team'} · {msg.sender?.role}
                  </div>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  mine ? 'bg-blue-600 text-white rounded-br-sm' :
                  msg.is_away_reply ? 'bg-amber-50 border border-amber-200 text-amber-900 italic rounded-bl-sm' :
                  'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                }`}>
                  {msg.is_away_reply && <div className="text-xs font-semibold mb-1 opacity-60">Auto-reply</div>}
                  {msg.body}
                </div>
                <div className="text-xs text-gray-400 px-1">{timeStr(msg.created_at)}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0 flex items-end gap-2">
        <textarea
          ref={textRef}
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Type your message..."
          className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
          style={{ minHeight: '40px', maxHeight: '100px' }}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
        />
        <button onClick={sendMessage} disabled={!newMsg.trim() || sending}
          className="w-10 h-10 rounded-xl text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-all"
          style={{ background: HHF_BLUE }}>
          {sending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
          }
        </button>
      </div>

      {/* Footer */}
      <div className="text-center py-2 bg-white border-t border-gray-50">
        <span className="text-xs text-gray-300">Powered by </span>
        <span className="text-xs font-semibold" style={{ color: HHF_BLUE }}>HHF Connect</span>
      </div>
    </div>
  )
}

// ── MAIN EXPORT ─────────────────────────────────────────────
export default function PublicChat() {
  const [step, setStep]       = useState('form') // form | chat
  const [visitor, setVisitor] = useState(null)
  const [convoId, setConvoId] = useState(null)
  const [error, setError]     = useState('')

  // Check for returning visitor in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('hhf_visitor')
    if (saved) {
      try {
        const { visitor: v, convoId: cid } = JSON.parse(saved)
        setVisitor(v); setConvoId(cid); setStep('chat')
      } catch (_) { localStorage.removeItem('hhf_visitor') }
    }
  }, [])

  async function handleStart(form) {
    setError('')
    try {
      // 1. Check if visitor already exists by email
      const { data: existing } = await supabase
        .from('hhf_guest_profiles')
        .select('id, full_name, email')
        .eq('email', form.email)
        .eq('app', 'hhf')
        .single()

      let visitorProfile = existing

      if (!visitorProfile) {
        // 2. Create guest profile (no auth account needed)
        const { data: newProfile, error: profileErr } = await supabase
          .from('hhf_guest_profiles')
          .insert({
            app:       'hhf',
            email:     form.email,
            full_name: form.name,
            phone:     form.phone,
          })
          .select()
          .single()

        if (profileErr) throw new Error(profileErr.message)
        visitorProfile = newProfile
      } else {
        // Update phone if changed
        await supabase.from('hhf_guest_profiles').update({ phone: form.phone }).eq('id', existing.id)
      }

      // 3. Find an available staff/admin to assign conversation to
      const { data: staff } = await supabase
        .from('hhf_profiles')
        .select('id')
        .in('role', ['admin', 'staff'])
        .eq('status', 'active')
        .order('online_status') // online first
        .limit(1)

      const staffId = staff?.[0]?.id
      if (!staffId) throw new Error('No staff available. Please try again later.')

      // 4. Create or find conversation
      const a = visitorProfile.id < staffId ? visitorProfile.id : staffId
      const b = visitorProfile.id < staffId ? staffId : visitorProfile.id

      let convo
      const { data: existing_convo } = await supabase
        .from('hhf_conversations')
        .select('id')
        .eq('participant_a', a)
        .eq('participant_b', b)
        .single()

      if (existing_convo) {
        convo = existing_convo
      } else {
        const { data: newConvo, error: convoErr } = await supabase
          .from('hhf_conversations')
          .insert({ participant_a: a, participant_b: b })
          .select().single()
        if (convoErr) throw new Error(convoErr.message)
        convo = newConvo
      }

      // 5. Send first message
      await supabase.from('hhf_messages').insert({
        conversation_id: convo.id,
        sender_id:       visitorProfile.id,
        body:            form.message,
        status:          'sent'
      })

      // 6. Create notification for staff
      await supabase.from('hhf_notifications').insert({
        user_id: staffId,
        type:    'new_message',
        title:   `New chat from ${form.name}`,
        body:    form.message.slice(0, 80),
        link:    `/admin/messages?convo=${convo.id}`
      })

      // 7. Check for active away message — fire auto-reply if set
      const { data: awayMsg } = await supabase
        .from('hhf_away_messages')
        .select('body')
        .eq('staff_id', staffId)
        .eq('is_active', true)
        .single()

      if (awayMsg) {
        await supabase.from('hhf_messages').insert({
          conversation_id: convo.id,
          sender_id:       staffId,
          body:            awayMsg.body,
          status:          'sent',
          is_away_reply:   true
        })
      }

      // 8. Save to localStorage for returning visitor
      localStorage.setItem('hhf_visitor', JSON.stringify({ visitor: visitorProfile, convoId: convo.id }))

      setVisitor(visitorProfile)
      setConvoId(convo.id)
      setStep('chat')

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  if (step === 'chat' && visitor && convoId) {
    return <ChatWindow visitor={visitor} convoId={convoId} />
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl shadow-lg">
          {error}
        </div>
      )}
      <VisitorForm onStart={handleStart} />
    </>
  )
}