import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ─── HELPERS ──────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const d = new Date(ts), now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800) return d.toLocaleDateString('en-NG', { weekday: 'short' })
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(ts) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700',
]
function avatarColor(id = '') {
  const idx = id.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

// ─── AVATAR ───────────────────────────────────────────────
function Avatar({ name, id, size = 'md', online = false }) {
  const s = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  return (
    <div className="relative flex-shrink-0">
      <div className={`${s} rounded-full flex items-center justify-center font-bold ${avatarColor(id)}`}>
        {initials(name)}
      </div>
      {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />}
    </div>
  )
}

// ─── FILE ICON ─────────────────────────────────────────────
function FileIcon({ mime }) {
  if (mime?.startsWith('image/')) return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function Messaging() {
  const { profile, isAdmin } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [conversations, setConversations] = useState([])
  const [activeConvo, setActiveConvo]     = useState(null)
  const [messages, setMessages]           = useState([])
  const [otherUser, setOtherUser]         = useState(null)
  const [newMessage, setNewMessage]       = useState('')
  const [sending, setSending]             = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [search, setSearch]               = useState('')
  const [showInfo, setShowInfo]           = useState(false)
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [showNewConvo, setShowNewConvo]   = useState(false)
  const [users, setUsers]                 = useState([])
  const [userSearch, setUserSearch]       = useState('')
  const [loadingMsgs, setLoadingMsgs]     = useState(false)

  const bottomRef  = useRef(null)
  const fileRef    = useRef(null)
  const textRef    = useRef(null)

  // ── Load conversations ───────────────────────────────────
  useEffect(() => {
    if (!profile) return
    loadConversations()

    const sub = supabase
      .channel('hhf_convos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hhf_conversations' }, loadConversations)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hhf_messages' }, () => loadConversations())
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [profile])

  async function loadConversations() {
    if (!profile) return
    setLoadingConvos(true)

    // Step 1: Get raw conversations
    let query = supabase
      .from('hhf_conversations')
      .select('id, last_message_at, last_message_preview, participant_a, participant_b')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (!isAdmin) {
      query = query.or(`participant_a.eq.${profile.id},participant_b.eq.${profile.id}`)
    }

    const { data, error } = await query
    if (!error && data) {
      // Step 2: Collect all unique participant IDs
      const allIds = [...new Set(data.flatMap(c => [c.participant_a, c.participant_b]))]

      // Step 3: Fetch registered profiles
      const { data: profiles } = await supabase
        .from('hhf_profiles')
        .select('id, full_name, role, online_status')
        .in('id', allIds)

      // Step 4: Fetch guest profiles
      const { data: guests } = await supabase
        .from('hhf_guest_profiles')
        .select('id, full_name, email')
        .in('id', allIds)

      // Step 5: Build lookup map
      const profileMap = {}
      ;(profiles || []).forEach(p => { profileMap[p.id] = { ...p } })
      ;(guests || []).forEach(g => { profileMap[g.id] = { ...g, role: 'visitor', online_status: 'offline' } })

      // Step 6: Enrich conversations
      const enriched = data.map(c => {
        const pA = profileMap[c.participant_a] || { id: c.participant_a, full_name: 'Unknown', role: 'visitor' }
        const pB = profileMap[c.participant_b] || { id: c.participant_b, full_name: 'Unknown', role: 'visitor' }
        const other = pA.id === profile.id ? pB : pA
        return { ...c, participant_a: pA, participant_b: pB, other }
      })
      setConversations(enriched)

      // Auto-restore from URL on refresh
      const params = new URLSearchParams(window.location.search)
      const cid = params.get('convo')
      if (cid) {
        const found = enriched.find(c => c.id === cid)
        if (found && (!activeConvo || activeConvo.id !== cid)) openConversation(found)
      }
    }
    setLoadingConvos(false)
  }

  // ── Load users for new conversation ─────────────────────
  async function loadUsers() {
    let query = supabase.from('hhf_profiles').select('id, full_name, role, online_status').eq('status', 'active').neq('id', profile.id)
    if (!isAdmin) {
      // Staff: only load their assigned clients
      const { data: assignments } = await supabase.from('hhf_staff_assignments').select('client_id').eq('staff_id', profile.id)
      const ids = assignments?.map(a => a.client_id) || []
      if (ids.length === 0) { setUsers([]); return }
      query = query.in('id', ids)
    }
    const { data } = await query.order('full_name')
    setUsers(data || [])
  }

  // ── Open conversation ────────────────────────────────────
  async function openConversation(convo) {
    setActiveConvo(convo)
    setOtherUser(convo.other)
    setShowInfo(false)
    setLoadingMsgs(true)
    window.history.replaceState(null, '', `?convo=${convo.id}`)
    await loadMessages(convo.id)
    markRead(convo.id)
  }

  // ── Load messages ────────────────────────────────────────
  async function loadMessages(convoId) {
    const { data, error } = await supabase
      .from('hhf_messages')
      .select('id, body, status, read_at, is_away_reply, created_at, sender_id, attachments:hhf_message_attachments(id, file_name, storage_path, mime_type, file_size, type)')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      // Fetch sender names from both tables
      const senderIds = [...new Set(data.map(m => m.sender_id).filter(Boolean))]
      const { data: regSenders } = await supabase.from('hhf_profiles').select('id, full_name, role').in('id', senderIds)
      const { data: guestSenders } = await supabase.from('hhf_guest_profiles').select('id, full_name').in('id', senderIds)
      const senderMap = {}
      ;(regSenders || []).forEach(s => { senderMap[s.id] = s })
      ;(guestSenders || []).forEach(s => { senderMap[s.id] = { ...s, role: 'visitor' } })
      const enriched = data.map(m => ({ ...m, sender: senderMap[m.sender_id] || null }))
      setMessages(enriched)
    }
    setLoadingMsgs(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // ── Realtime messages ────────────────────────────────────
  useEffect(() => {
    if (!activeConvo) return
    const sub = supabase
      .channel(`hhf_msgs_${activeConvo.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hhf_messages',
        filter: `conversation_id=eq.${activeConvo.id}`
      }, payload => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        markRead(activeConvo.id)
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeConvo])

  // ── Mark messages read ───────────────────────────────────
  async function markRead(convoId) {
    await supabase
      .from('hhf_messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('conversation_id', convoId)
      .neq('sender_id', profile.id)
      .neq('status', 'read')
  }

  // ── Send message ─────────────────────────────────────────
  async function sendMessage() {
    const body = newMessage.trim()
    if (!body || !activeConvo || sending) return
    setSending(true)

    const { error } = await supabase.from('hhf_messages').insert({
      conversation_id: activeConvo.id,
      sender_id: profile.id,
      body,
      status: 'sent'
    })

    if (!error) {
      setNewMessage('')
      textRef.current?.focus()
    }
    setSending(false)
  }

  // ── Handle file upload ───────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !activeConvo) return
    setUploading(true)

    const ext  = file.name.split('.').pop()
    const path = `${activeConvo.id}/${Date.now()}_${file.name}`

    const { error: upErr } = await supabase.storage
      .from('hhf-documents').upload(path, file, { upsert: false })

    if (upErr) { setUploading(false); alert('Upload failed: ' + upErr.message); return }

    const { data: msg, error: msgErr } = await supabase.from('hhf_messages').insert({
      conversation_id: activeConvo.id,
      sender_id: profile.id,
      body: null,
      status: 'sent'
    }).select().single()

    if (!msgErr && msg) {
      await supabase.from('hhf_message_attachments').insert({
        message_id:   msg.id,
        storage_path: path,
        file_name:    file.name,
        file_size:    file.size,
        mime_type:    file.type,
        type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'document'
      })
    }

    setUploading(false)
    e.target.value = ''
  }

  // ── Get file URL ─────────────────────────────────────────
  function getFileUrl(path) {
    const { data } = supabase.storage.from('hhf-documents').getPublicUrl(path)
    return data?.publicUrl
  }

  // ── New conversation (admin/staff) ───────────────────────
  async function startConversation(userId) {
    if (!profile) return
    const a = profile.id < userId ? profile.id : userId
    const b = profile.id < userId ? userId : profile.id

    const { data: existing } = await supabase
      .from('hhf_conversations')
      .select('*')
      .eq('participant_a', a).eq('participant_b', b).single()

    if (existing) {
      const convo = conversations.find(c => c.id === existing.id)
      if (convo) openConversation(convo)
      return
    }

    const { data: newConvo } = await supabase.from('hhf_conversations')
      .insert({ participant_a: a, participant_b: b })
      .select().single()

    if (newConvo) {
      await loadConversations()
      setTimeout(() => {
        const found = conversations.find(c => c.id === newConvo.id)
        if (found) openConversation(found)
      }, 500)
    }
  }

  // ── Key handler ──────────────────────────────────────────
  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Group messages by date ───────────────────────────────
  function groupByDate(msgs) {
    const groups = []
    let currentDate = null
    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toDateString()
      if (date !== currentDate) {
        groups.push({ type: 'date', label: formatDate(msg.created_at) })
        currentDate = date
      }
      groups.push({ type: 'message', data: msg })
    })
    return groups
  }

  const filtered = conversations.filter(c =>
    (c.other?.full_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell>
      <div className="h-[calc(100vh-112px)] flex rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">

        {/* ── SIDEBAR ── */}
        <div className={`w-full md:w-72 flex-shrink-0 border-r border-gray-100 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Messages</h2>
              <button
                onClick={() => { setShowNewConvo(true); loadUsers() }}
                className="w-7 h-7 bg-hhf-blue text-white rounded-lg flex items-center justify-center hover:bg-hhf-blue-light transition-colors"
                title="New conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-hhf-blue"
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Conversation list */}
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
            ) : filtered.map(convo => (
              <div
                key={convo.id}
                onClick={() => openConversation(convo)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 hover:bg-gray-50 ${activeConvo?.id === convo.id ? 'bg-hhf-blue-pale border-l-2 border-l-hhf-blue' : ''}`}
              >
                <Avatar name={convo.other?.full_name} id={convo.other?.id}
                  online={convo.other?.online_status === 'online'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm text-gray-900 truncate">{convo.other?.full_name || 'Unknown'}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(convo.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-gray-400 truncate">{convo.last_message_preview || 'No messages yet'}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      convo.other?.role === 'client' ? 'bg-hhf-blue-pale text-hhf-blue' :
                      convo.other?.role === 'staff' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{convo.other?.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CHAT WINDOW ── */}
        {activeConvo ? (
          <div className={`flex-1 flex flex-col min-w-0 ${activeConvo ? 'flex' : 'hidden md:flex'}`}>

            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
              <button className="md:hidden p-1 text-gray-400 hover:text-gray-600" onClick={() => setActiveConvo(null)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <Avatar name={otherUser?.full_name} id={otherUser?.id} size="md"
                online={otherUser?.online_status === 'online'} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{otherUser?.full_name}</div>
                <div className={`text-xs ${otherUser?.online_status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                  {otherUser?.online_status === 'online' ? '● Online' :
                   otherUser?.online_status === 'busy' ? '● In session' :
                   otherUser?.online_status === 'away' ? '● Away' : '○ Offline'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <span className="text-xs bg-hhf-blue text-white px-2 py-0.5 rounded-full">Admin view</span>
                )}
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={`p-2 rounded-lg transition-colors ${showInfo ? 'bg-hhf-blue-pale text-hhf-blue' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-1">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-hhf-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-hhf-blue-pale rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-hhf-blue" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
                </div>
              ) : groupByDate(messages).map((item, idx) => {
                if (item.type === 'date') return (
                  <div key={`date-${idx}`} className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 bg-gray-50 px-2">{item.label}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )

                const msg  = item.data
                const mine = msg.sender_id === profile.id
                const att  = msg.attachments?.[0]

                return (
                  <div key={msg.id} className={`flex gap-2 items-end ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!mine && <Avatar name={msg.sender?.full_name} id={msg.sender?.id} size="sm" />}

                    <div className={`max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {/* Attachment */}
                      {att && (
                        att.mime_type?.startsWith('image/') ? (
                          <img
                            src={getFileUrl(att.storage_path)}
                            alt={att.file_name}
                            className="rounded-xl max-w-full max-h-48 object-cover cursor-pointer border border-gray-200"
                            onClick={() => window.open(getFileUrl(att.storage_path), '_blank')}
                          />
                        ) : (
                          <a
                            href={getFileUrl(att.storage_path)}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${mine ? 'bg-hhf-blue text-white hover:bg-hhf-blue-light' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <FileIcon mime={att.mime_type} />
                            <div className="min-w-0">
                              <div className="truncate max-w-[180px]">{att.file_name}</div>
                              {att.file_size && <div className={`text-xs ${mine ? 'text-blue-200' : 'text-gray-400'}`}>{(att.file_size / 1024).toFixed(0)} KB</div>}
                            </div>
                          </a>
                        )
                      )}

                      {/* Text body */}
                      {msg.body && (
                        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          mine ? 'bg-hhf-blue text-white rounded-br-md' :
                          msg.is_away_reply ? 'bg-amber-50 border border-amber-200 text-amber-900 italic rounded-bl-md' :
                          'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                        }`}>
                          {msg.is_away_reply && <div className="text-xs font-semibold mb-1 opacity-70">Auto-reply</div>}
                          {msg.body}
                        </div>
                      )}

                      {/* Timestamp + read status */}
                      <div className={`flex items-center gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {mine && (
                          <span className={`text-xs ${msg.status === 'read' ? 'text-hhf-blue' : 'text-gray-300'}`}>
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-end gap-2">
                {/* Attachment button */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="p-2 text-gray-400 hover:text-hhf-blue hover:bg-hhf-blue-pale rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                  title="Attach file"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-hhf-blue border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                    </svg>
                  )}
                </button>
                <input ref={fileRef} type="file" className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />

                {/* Text input */}
                <textarea
                  ref={textRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  placeholder="Type a message... (Enter to send)"
                  className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-hhf-blue transition-colors max-h-28 overflow-y-auto"
                  style={{ minHeight: '40px' }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px' }}
                />

                {/* Send button */}
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="w-10 h-10 bg-hhf-blue text-white rounded-xl flex items-center justify-center hover:bg-hhf-blue-light transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Empty state (desktop)
          <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-hhf-blue-pale rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-hhf-blue" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Select a conversation</h3>
              <p className="text-sm text-gray-400">Choose from the list to start messaging</p>
            </div>
          </div>
        )}

        {/* ── INFO PANEL ── */}
        {showInfo && otherUser && (
          <div className="w-64 border-l border-gray-100 bg-white flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-900">Info</span>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-4 flex flex-col items-center border-b border-gray-100">
              <Avatar name={otherUser.full_name} id={otherUser.id} size="lg"
                online={otherUser.online_status === 'online'} />
              <div className="mt-3 font-semibold text-gray-900 text-center">{otherUser.full_name}</div>
              <div className="mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  otherUser.role === 'client' ? 'bg-hhf-blue-pale text-hhf-blue' :
                  otherUser.role === 'staff' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>{otherUser.role}</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Status</div>
                <div className="text-sm text-gray-700 capitalize">{otherUser.online_status}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Messages</div>
                <div className="text-sm text-gray-700">{messages.length} total</div>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* ── NEW CONVERSATION MODAL ── */}
        {showNewConvo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">New Conversation</h3>
                <button onClick={() => { setShowNewConvo(false); setUserSearch('') }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <input
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-hhf-blue mb-3"
                  placeholder="Search by name..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  autoFocus
                />
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {users.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase())).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No users found</p>
                  ) : users.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                    <button
                      key={u.id}
                      onClick={() => { startConversation(u.id); setShowNewConvo(false); setUserSearch('') }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-hhf-blue-pale transition-colors text-left"
                    >
                      <Avatar name={u.full_name} id={u.id} size="sm" online={u.online_status === 'online'} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{u.full_name}</div>
                        <div className="text-xs text-gray-400 capitalize">{u.role}</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
    </AppShell>
  )
}
