import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'
import { joinConversationPresence, leaveConversationPresence, broadcastTyping } from '../../lib/presence'

// ── HELPERS ────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const d = new Date(ts), now = new Date(), diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800) return d.toLocaleDateString('en-NG', { weekday: 'short' })
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function formatDate(ts) {
  const d = new Date(ts), today = new Date(), yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

function initials(name = '') { return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }
const COLORS = ['bg-blue-100 text-blue-700','bg-green-100 text-green-700','bg-purple-100 text-purple-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700','bg-teal-100 text-teal-700']
function avatarColor(id = '') { return COLORS[id.charCodeAt(0) % COLORS.length] }

function Avatar({ name, id, size = 'md', online = false }) {
  const s = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  return (
    <div className="relative flex-shrink-0">
      <div className={`${s} rounded-full flex items-center justify-center font-bold ${avatarColor(id)}`}>{initials(name)}</div>
      {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />}
    </div>
  )
}

// ── READ TICK ──────────────────────────────────────────────
// Simple: grey tick = sent, blue tick = seen
function ReadTick({ status }) {
  const seen = status === 'read'
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="inline-block">
      <path d="M1 5.5L4.5 9L10 2" 
        stroke={seen ? '#1a5fa8' : '#9ca3af'} 
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function groupByDate(msgs) {
  const groups = [], seen = new Set()
  msgs.forEach(msg => {
    const d = new Date(msg.created_at).toDateString()
    if (!seen.has(d)) { groups.push({ type: 'date', label: formatDate(msg.created_at) }); seen.add(d) }
    groups.push({ type: 'message', data: msg })
  })
  return groups
}

// ── DB HELPERS ─────────────────────────────────────────────
const ONLINE_STALE_AFTER_MS = 90 * 1000 // keep in sync with roster.js / AuthContext.jsx heartbeat window

async function buildSenderMap(ids) {
  if (!ids.length) return {}
  const staleCutoff = Date.now() - ONLINE_STALE_AFTER_MS
  const [{ data: reg }, { data: guests }] = await Promise.all([
    supabase.from('hhf_profiles').select('id, full_name, role, online_status, last_seen_at').in('id', ids),
    supabase.from('hhf_guest_profiles').select('id, full_name').in('id', ids)
  ])
  const map = {}
  ;(reg || []).forEach(s => {
    // Only show as online if the heartbeat is actually fresh — a stale
    // online_status flag (e.g. after a crashed tab) no longer counts.
    const trulyOnline = s.online_status === 'online' && s.last_seen_at && new Date(s.last_seen_at).getTime() > staleCutoff
    map[s.id] = { ...s, online_status: trulyOnline ? 'online' : 'offline' }
  })
  ;(guests || []).forEach(s => { map[s.id] = { ...s, role: 'visitor', online_status: 'offline' } })
  return map
}

function getAttachmentUrl(path) {
  const { data } = supabase.storage.from('hhf-documents').getPublicUrl(path)
  return data?.publicUrl
}

// ── MAIN ───────────────────────────────────────────────────
export default function Messaging() {
  const { profile, isAdmin } = useAuth()
  const role = profile?.role

  const [conversations, setConversations] = useState([])
  const [activeConvo, setActiveConvo]     = useState(null)
  const [queueTab, setQueueTab]           = useState('pending') // pending | active | closed
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeReport, setCloseReport]     = useState({ staff_report: '', follow_up: '' })
  const [closingSaving, setClosingSaving] = useState(false)
  const [closeError, setCloseError]       = useState('')
  const [visitorTyping, setVisitorTyping] = useState(false)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const [messages, setMessages]           = useState([])
  const [newMessage, setNewMessage]       = useState('')
  const [sending, setSending]             = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [search, setSearch]               = useState('')
  const [showInfo, setShowInfo]           = useState(false)
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [loadingMsgs, setLoadingMsgs]     = useState(false)
  const [showNewConvo, setShowNewConvo]   = useState(false)
  const [users, setUsers]                 = useState([])
  const [userSearch, setUserSearch]       = useState('')

  const bottomRef      = useRef(null)
  const fileRef        = useRef(null)
  const textRef        = useRef(null)
  const activeConvoRef = useRef(null)
  const pollRef        = useRef(null)

  useEffect(() => { activeConvoRef.current = activeConvo }, [activeConvo])

  // ── FETCH MESSAGES FROM DB (source of truth) ──────────────
  const fetchMessages = useCallback(async (convoId) => {
    const { data, error } = await supabase
      .from('hhf_messages')
      .select('id, body, status, read_at, is_away_reply, created_at, sender_id, attachments:hhf_message_attachments(id, file_name, storage_path, mime_type, file_size)')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true })

    if (error || !data) return

    const senderMap = await buildSenderMap([...new Set(data.map(m => m.sender_id).filter(Boolean))])
    const enriched  = data.map(m => ({ ...m, sender: senderMap[m.sender_id] || null }))
    setMessages(enriched)
    return enriched
  }, [])

  // ── MARK MESSAGES SEEN ───────────────────────────────────
  const markRead = useCallback(async (convoId) => {
    if (!profile) return
    const { data: unread } = await supabase
      .from('hhf_messages')
      .select('id')
      .eq('conversation_id', convoId)
      .neq('sender_id', profile.id)
      .neq('status', 'read')
    if (unread?.length) {
      await supabase.rpc('hhf_mark_messages_read', { message_ids: unread.map(m => m.id) })
    }
  }, [profile])

  // ── POLL STATUS EVERY 3s (reliable tick updates) ──────────
  const pollStatus = useCallback(async (convoId) => {
    if (!convoId) return
    const { data } = await supabase
      .from('hhf_messages')
      .select('id, status, read_at')
      .eq('conversation_id', convoId)
    if (data) {
      setMessages(prev => prev.map(msg => {
        const upd = data.find(d => d.id === msg.id)
        if (!upd) return msg
        // Only move forward: sent → read
        if (msg.status !== 'read' && upd.status === 'read') {
          return { ...msg, status: 'read', read_at: upd.read_at }
        }
        return msg
      }))
    }
  }, [])

  const startPolling = useCallback((convoId) => {
    stopPolling()
    // Poll every 3 seconds
    pollRef.current = setInterval(() => pollStatus(convoId), 3000)
    // Also poll immediately when tab becomes visible again
    const onFocus = () => pollStatus(convoId)
    window.addEventListener('focus', onFocus)
    window.addEventListener('visibilitychange', onFocus)
    // Store cleanup
    pollRef.cleanup = () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('visibilitychange', onFocus)
    }
  }, [pollStatus])

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (pollRef.cleanup) { pollRef.cleanup(); pollRef.cleanup = null }
  }

  // ── LOAD CONVERSATIONS ────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!profile) return
    setLoadingConvos(true)
    let q = supabase
      .from('hhf_conversations')
      .select('id, last_message_at, last_message_preview, participant_a, participant_b, status, priority, source, assigned_staff_id')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    // Staff only see conversations either assigned to them (public-chat
    // routing) or that they're a direct participant in (conversations they
    // started themselves via "+ New Conversation" never set
    // assigned_staff_id at all) — previously there was no filter here,
    // meaning any staff member could see every other staff/admin's
    // conversations. Admins retain full visibility, matching their
    // oversight role.
    if (!isAdmin) {
      q = q.or(`assigned_staff_id.eq.${profile.id},participant_a.eq.${profile.id},participant_b.eq.${profile.id}`)
    }

    const { data } = await q

    if (!data) { setLoadingConvos(false); return }

    const allIds    = [...new Set(data.flatMap(c => [c.participant_a, c.participant_b]))]
    const senderMap = await buildSenderMap(allIds)

    const enriched = data.map(c => {
      const pA = senderMap[c.participant_a] || { id: c.participant_a, full_name: 'Unknown', role: 'visitor' }
      const pB = senderMap[c.participant_b] || { id: c.participant_b, full_name: 'Unknown', role: 'visitor' }
      return { ...c, participant_a: pA, participant_b: pB, other: pA.id === profile.id ? pB : pA }
    })

    setConversations(enriched)
    setLoadingConvos(false)

    // Auto-open from URL
    const cid = new URLSearchParams(window.location.search).get('convo')
    if (cid && !activeConvoRef.current) {
      const found = enriched.find(c => c.id === cid)
      if (found) openConversation(found)
    }
  }, [profile, isAdmin])

  // ── OPEN CONVERSATION ─────────────────────────────────────
  async function openConversation(convo) {
    stopPolling()
    setActiveConvo(convo)
    setShowInfo(false)
    setMessages([])
    setLoadingMsgs(true)
    window.history.replaceState(null, '', `?convo=${convo.id}`)

    // 1. Subscribe to Realtime FIRST
    // (channel set up in useEffect watching activeConvo)

    // 2. Fetch from DB (source of truth)
    await fetchMessages(convo.id)
    setLoadingMsgs(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    // 3. Mark incoming as read
    await markRead(convo.id)

    // 4. Start polling for tick updates
    startPolling(convo.id)
  }

  // ── SUBSCRIBE TO CONVERSATIONS ────────────────────────────
  useEffect(() => {
    if (!profile) return
    loadConversations()

    const sub = supabase.channel('hhf_convo_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hhf_conversations' }, loadConversations)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hhf_messages' }, loadConversations)
      .subscribe()

    return () => { supabase.removeChannel(sub); stopPolling() }
  }, [profile])

  // ── SUBSCRIBE TO ACTIVE CONVERSATION MESSAGES ─────────────
  useEffect(() => {
    if (!activeConvo) return

    const sub = supabase
      .channel(`hhf_chat_${activeConvo.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hhf_messages',
        filter: `conversation_id=eq.${activeConvo.id}`
      }, async payload => {
        // New message arrived — fetch full message with sender
        const { data } = await supabase
          .from('hhf_messages')
          .select('id, body, status, read_at, is_away_reply, created_at, sender_id, attachments:hhf_message_attachments(id, file_name, storage_path, mime_type, file_size)')
          .eq('id', payload.new.id)
          .single()

        if (data) {
          const senderMap = await buildSenderMap([data.sender_id])
          const enriched  = { ...data, sender: senderMap[data.sender_id] || null }
          setMessages(prev => prev.find(m => m.id === enriched.id) ? prev : [...prev, enriched])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

          // Mark as read if from other person
          if (data.sender_id !== profile.id) {
            await supabase.rpc('hhf_mark_messages_read', { message_ids: [data.id] })
          }
        }
      })
      .subscribe((status) => {
        // On reconnect, re-fetch to catch missed messages
        if (status === 'SUBSCRIBED') {
          fetchMessages(activeConvo.id).then(() => markRead(activeConvo.id))
        }
      })

    return () => supabase.removeChannel(sub)
  }, [activeConvo?.id])

  // ── PRESENCE: join this conversation's presence channel while it's open
  // on screen, so the visitor side can suppress redundant notifications and
  // so we can show a typing indicator when the visitor is composing.
  useEffect(() => {
    if (!activeConvo || !profile) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting typing state when switching to a newly-opened conversation, same pattern used elsewhere in this file
    setVisitorTyping(false)
    const channel = joinConversationPresence(
      activeConvo.id,
      { id: profile.id, role: 'staff' },
      {
        onTyping: ({ role, typing }) => {
          if (role !== 'visitor') return
          setVisitorTyping(typing)
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          if (typing) {
            // Safety expiry in case a "stopped typing" event is ever missed
            typingTimeoutRef.current = setTimeout(() => setVisitorTyping(false), 4000)
          }
        },
      }
    )
    presenceChannelRef.current = channel

    return () => {
      leaveConversationPresence(channel)
      presenceChannelRef.current = null
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      setVisitorTyping(false)
    }
  }, [activeConvo?.id, profile])

  // ── CLEANUP ON UNMOUNT ────────────────────────────────────
  useEffect(() => () => stopPolling(), [])

  // ── SEND MESSAGE ──────────────────────────────────────────
  async function sendMessage() {
    const body = newMessage.trim()
    if (!body || !activeConvo || sending || activeConvo.status === 'closed') return
    setSending(true)
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current)
    if (presenceChannelRef.current) broadcastTyping(presenceChannelRef.current, { id: profile.id, role: 'staff' }, false)
    await supabase.from('hhf_messages').insert({
      conversation_id: activeConvo.id,
      sender_id: profile.id,
      body,
      status: 'sent'
    })
    setNewMessage('')
    textRef.current?.focus()
    setSending(false)
  }

  // ── FILE UPLOAD ───────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !activeConvo) return
    setUploading(true)
    const path = `${activeConvo.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('hhf-documents').upload(path, file)
    if (upErr) { setUploading(false); alert('Upload failed: ' + upErr.message); return }
    const { data: msg } = await supabase.from('hhf_messages')
      .insert({ conversation_id: activeConvo.id, sender_id: profile.id, body: null, status: 'sent' })
      .select().single()
    if (msg) {
      await supabase.from('hhf_message_attachments').insert({
        message_id: msg.id, storage_path: path, file_name: file.name,
        file_size: file.size, mime_type: file.type,
        type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'document'
      })
    }
    setUploading(false)
    e.target.value = ''
  }

  // ── NEW CONVERSATION ──────────────────────────────────────
  async function loadUsers() {
    let q = supabase.from('hhf_profiles').select('id, full_name, role, online_status, last_seen_at').eq('status', 'active').neq('id', profile.id)
    if (!isAdmin) {
      const { data: a } = await supabase.from('hhf_staff_assignments').select('client_id').eq('staff_id', profile.id)
      const ids = (a || []).map(x => x.client_id)
      if (!ids.length) { setUsers([]); return }
      q = q.in('id', ids)
    }
    const { data } = await q.order('full_name')
    const staleCutoff = Date.now() - ONLINE_STALE_AFTER_MS
    const withFreshOnline = (data || []).map(u => ({
      ...u,
      online_status: u.online_status === 'online' && u.last_seen_at && new Date(u.last_seen_at).getTime() > staleCutoff
        ? 'online' : 'offline',
    }))
    setUsers(withFreshOnline)
  }

  async function startConversation(userId) {
    const a = profile.id < userId ? profile.id : userId
    const b = profile.id < userId ? userId : profile.id
    let { data: ex } = await supabase.from('hhf_conversations').select('id').eq('participant_a', a).eq('participant_b', b).maybeSingle()
    if (!ex) {
      const { data } = await supabase.from('hhf_conversations').insert({ participant_a: a, participant_b: b }).select().single()
      ex = data
    }
    setShowNewConvo(false); setUserSearch('')
    await loadConversations()
    if (ex) setTimeout(() => {
      setConversations(prev => { const f = prev.find(c => c.id === ex.id); if (f) openConversation(f); return prev })
    }, 400)
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const stopTypingTimeoutRef = useRef(null)
  function handleTypingChange(e) {
    setNewMessage(e.target.value)
    if (!profile || !presenceChannelRef.current) return
    broadcastTyping(presenceChannelRef.current, { id: profile.id, role: 'staff' }, true)
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current)
    stopTypingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(presenceChannelRef.current, { id: profile.id, role: 'staff' }, false)
    }, 2000)
  }

  // ── QUEUE ACTIONS ─────────────────────────────────────────
  async function setPriority(convoId, priority) {
    await supabase.from('hhf_conversations').update({ priority }).eq('id', convoId)
    setConversations(prev => prev.map(c => c.id === convoId ? { ...c, priority } : c))
    if (activeConvo?.id === convoId) setActiveConvo(c => ({ ...c, priority }))
  }

  async function closeConversation() {
    if (!activeConvo) return
    setClosingSaving(true)
    try {
      const { error: updErr } = await supabase.from('hhf_conversations').update({
        status:       'closed',
        staff_report: closeReport.staff_report || null,
        follow_up:    closeReport.follow_up    || null,
        closed_at:    new Date().toISOString(),
        closed_by:    profile.id,
      }).eq('id', activeConvo.id)

      if (updErr) throw new Error(updErr.message)

      await supabase.from('hhf_audit_logs').insert({
        actor_id: profile.id, action: 'conversation_closed',
        target_type: 'conversation', target_id: activeConvo.id,
        details: { report: closeReport.staff_report, follow_up: closeReport.follow_up }
      }).catch(() => {})

      setConversations(prev => prev.map(c => c.id === activeConvo.id ? { ...c, status: 'closed' } : c))
      setActiveConvo(c => c ? { ...c, status: 'closed' } : c)
      setShowCloseModal(false)
      setCloseReport({ staff_report: '', follow_up: '' })
    } catch (err) {
      setCloseError(err.message || 'Could not close this conversation. Please try again.')
    } finally {
      setClosingSaving(false)
    }
  }

  // Queue filtered lists
  const isStaffOrAdmin = role === 'staff' || role === 'admin'
  const queueFiltered = isStaffOrAdmin
    ? conversations.filter(c => (c.status || 'pending') === queueTab)
    : conversations

  const filtered  = conversations.filter(c => (c.other?.full_name || '').toLowerCase().includes(search.toLowerCase()))
  const otherUser = activeConvo?.other

  return (
    <AppShell>
      <div className="h-[calc(100vh-112px)] flex rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">

        {/* SIDEBAR */}
        <div className={`w-full md:w-72 flex-shrink-0 border-r border-gray-100 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">
                {isStaffOrAdmin ? 'Chat Queue' : 'Messages'}
              </h2>
              <button onClick={() => { setShowNewConvo(true); loadUsers() }}
                className="w-7 h-7 bg-hhf-blue text-white rounded-lg flex items-center justify-center hover:bg-hhf-blue-light">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>

            {/* Queue tabs — staff/admin only */}
            {isStaffOrAdmin && (
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-3">
                {[
                  { key: 'pending', label: 'Pending', color: 'text-amber-600' },
                  { key: 'active',  label: 'Active',  color: 'text-green-600' },
                  { key: 'closed',  label: 'Closed',  color: 'text-gray-500'  },
                ].map(tab => {
                  const count = conversations.filter(c => (c.status || 'pending') === tab.key).length
                  return (
                    <button key={tab.key} onClick={() => setQueueTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-colors ${queueTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {tab.label}
                      {count > 0 && <span className={`text-xs font-bold ${queueTab === tab.key ? tab.color : 'text-gray-400'}`}>{count}</span>}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="relative">
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-hhf-blue"
                placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-hhf-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <p className="text-sm text-gray-400">No conversations yet</p>
              </div>
            ) : (isStaffOrAdmin ? queueFiltered : conversations)
                .filter(c => (c.other?.full_name || '').toLowerCase().includes(search.toLowerCase()))
                .map(convo => (
              <div key={convo.id} onClick={() => openConversation(convo)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${activeConvo?.id === convo.id ? 'bg-hhf-blue-pale border-l-2 border-l-hhf-blue' : ''} ${convo.priority === 'important' && activeConvo?.id !== convo.id ? 'border-l-2 border-l-red-400' : ''}`}>
                <Avatar name={convo.other?.full_name} id={convo.other?.id || ''} online={convo.other?.online_status === 'online'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm text-gray-900 truncate">{convo.other?.full_name || 'Unknown'}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {convo.priority === 'important' && <span className="text-xs">🔴</span>}
                      <span className="text-xs text-gray-400">{timeAgo(convo.last_message_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-gray-400 truncate">{convo.last_message_preview || 'No messages yet'}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 capitalize ${
                      convo.source === 'public_chat'  ? 'bg-amber-50 text-amber-600' :
                      convo.other?.role === 'client'  ? 'bg-hhf-blue-pale text-hhf-blue' :
                      convo.other?.role === 'staff'   ? 'bg-blue-50 text-blue-700' :
                      convo.other?.role === 'visitor' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>{convo.source === 'public_chat' ? 'public' : convo.other?.role || 'visitor'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHAT WINDOW */}
        {activeConvo ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
              <button className="md:hidden p-1 text-gray-400"
                onClick={() => { setActiveConvo(null); stopPolling(); window.history.replaceState(null, '', '?') }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <Avatar name={otherUser?.full_name} id={otherUser?.id || ''} online={otherUser?.online_status === 'online'} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{otherUser?.full_name}</div>
                <div className={`text-xs ${otherUser?.online_status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                  {otherUser?.online_status === 'online' ? '● Online' : '○ Offline'}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Priority toggle — staff/admin */}
                {isStaffOrAdmin && activeConvo?.status !== 'closed' && (
                  <button
                    onClick={() => setPriority(activeConvo.id, activeConvo.priority === 'important' ? 'normal' : 'important')}
                    title={activeConvo?.priority === 'important' ? 'Mark normal' : 'Mark important'}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${activeConvo?.priority === 'important' ? 'bg-red-50 text-red-500' : 'text-gray-400 hover:bg-gray-100'}`}>
                    🔴
                  </button>
                )}
                {/* Close conversation — staff/admin */}
                {isStaffOrAdmin && activeConvo?.status !== 'closed' && (
                  <button
                    onClick={() => setShowCloseModal(true)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                    Close
                  </button>
                )}
                {activeConvo?.status === 'closed' && (
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-lg">Closed</span>
                )}
                <button onClick={() => setShowInfo(!showInfo)}
                  className={`p-2 rounded-lg ${showInfo ? 'bg-hhf-blue-pale text-hhf-blue' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-1">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-hhf-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12"><p className="text-sm text-gray-400">No messages yet. Say hello!</p></div>
              ) : groupByDate(messages).map((item, idx) => {
                if (item.type === 'date') return (
                  <div key={`d-${idx}`} className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">{item.label}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )
                const msg  = item.data
                const mine = msg.sender_id === profile.id
                const att  = msg.attachments?.[0]
                return (
                  <div key={msg.id} className={`flex gap-2 items-end ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!mine && <Avatar name={msg.sender?.full_name || '?'} id={msg.sender?.id || ''} size="sm" />}
                    <div className={`max-w-[70%] flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                      {att && (
                        att.mime_type?.startsWith('image/') ? (
                          <img src={getAttachmentUrl(att.storage_path)} alt={att.file_name}
                            className="rounded-xl max-w-full max-h-48 object-cover cursor-pointer border border-gray-200"
                            onClick={() => window.open(getAttachmentUrl(att.storage_path), '_blank')} />
                        ) : (
                          <a href={getAttachmentUrl(att.storage_path)} target="_blank" rel="noreferrer"
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${mine ? 'bg-hhf-blue text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="truncate max-w-40">{att.file_name}</span>
                          </a>
                        )
                      )}
                      {msg.body && (
                        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          mine ? 'bg-hhf-blue text-white rounded-br-sm' :
                          msg.is_away_reply ? 'bg-amber-50 border border-amber-200 text-amber-900 italic rounded-bl-sm' :
                          'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                        }`}>
                          {msg.is_away_reply && <div className="text-xs font-semibold mb-1 opacity-60">Auto-reply</div>}
                          {msg.body}
                        </div>
                      )}
                      <div className={`flex items-center gap-1 text-xs text-gray-400 ${mine ? 'flex-row-reverse' : ''}`}>
                        <span>{new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span>
                        {mine && <ReadTick status={msg.status} />}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {visitorTyping && activeConvo?.status !== 'closed' && (
              <div className="px-4 py-1.5 text-xs text-gray-400 flex-shrink-0 flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                {activeConvo?.other?.full_name || 'Visitor'} is typing…
              </div>
            )}

            {activeConvo?.status === 'closed' ? (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0 text-center">
                <p className="text-sm text-gray-500">
                  This conversation has been closed.
                  {isStaffOrAdmin && ' Reopen it from the conversation list if you need to send another message.'}
                </p>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0 flex items-end gap-2">
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="p-2 text-gray-400 hover:text-hhf-blue hover:bg-hhf-blue-pale rounded-lg disabled:opacity-50">
                  {uploading
                    ? <div className="w-5 h-5 border-2 border-hhf-blue border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                      </svg>
                  }
                </button>
                <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
                <textarea ref={textRef} value={newMessage} onChange={handleTypingChange}
                  onKeyDown={handleKey} rows={1} placeholder="Type a message... (Enter to send)"
                  className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-hhf-blue max-h-28"
                  style={{ minHeight: '40px' }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px' }}
                />
                <button onClick={sendMessage} disabled={!newMessage.trim() || sending}
                  className="w-10 h-10 bg-hhf-blue text-white rounded-xl flex items-center justify-center hover:bg-hhf-blue-light disabled:opacity-40">
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                  }
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-hhf-blue-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-hhf-blue" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 12 2z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Select a conversation</h3>
              <p className="text-sm text-gray-400">Choose from the list to start messaging</p>
            </div>
          </div>
        )}

        {/* INFO PANEL */}
        {showInfo && otherUser && (
          <div className="w-64 border-l border-gray-100 bg-white flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-sm">Info</span>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-4 flex flex-col items-center">
              <Avatar name={otherUser.full_name} id={otherUser.id || ''} size="lg" online={otherUser.online_status === 'online'} />
              <div className="mt-3 font-semibold text-gray-900">{otherUser.full_name}</div>
              <span className={`mt-1 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                otherUser.role === 'client'  ? 'bg-hhf-blue-pale text-hhf-blue' :
                otherUser.role === 'visitor' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700'
              }`}>{otherUser.role}</span>
              <div className="mt-4 w-full text-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Messages</div>
                <div className="text-gray-700">{messages.length} total</div>
              </div>
            </div>
          </div>
        )}

        {/* NEW CONVERSATION MODAL */}
        {showNewConvo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-semibold">New Conversation</h3>
                <button onClick={() => { setShowNewConvo(false); setUserSearch('') }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-hhf-blue mb-3"
                  placeholder="Search by name..." value={userSearch} onChange={e => setUserSearch(e.target.value)} autoFocus />
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {users.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                    <button key={u.id} onClick={() => startConversation(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-hhf-blue-pale text-left">
                      <Avatar name={u.full_name} id={u.id} size="sm" online={u.online_status === 'online'} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{u.full_name}</div>
                        <div className="text-xs text-gray-400 capitalize">{u.role}</div>
                      </div>
                    </button>
                  ))}
                  {users.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">No users found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CLOSE + REPORT MODAL ── */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={e => e.target === e.currentTarget && setShowCloseModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Close Conversation</h3>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {closeError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-lg">{closeError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Staff Report <span className="text-gray-400">(summary of this conversation)</span></label>
                <textarea
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="What was discussed? What was the outcome?"
                  value={closeReport.staff_report}
                  onChange={e => setCloseReport(r => ({ ...r, staff_report: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Follow-up Actions <span className="text-gray-400">(optional)</span></label>
                <textarea
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Any actions needed? e.g. Schedule appointment, refer to specialist…"
                  value={closeReport.follow_up}
                  onChange={e => setCloseReport(r => ({ ...r, follow_up: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowCloseModal(false); setCloseError('') }}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={closeConversation} disabled={closingSaving}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50">
                  {closingSaving ? 'Closing…' : 'Close Conversation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
