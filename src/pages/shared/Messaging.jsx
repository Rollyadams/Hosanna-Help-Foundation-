import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── HELPERS ────────────────────────────────────────────────
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

function ReadTick({ status }) {
  if (status === 'read') return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" className="inline-block text-hhf-blue">
      <path d="M1 5.5L4.5 9L10.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 5.5L10.5 9L16.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (status === 'delivered') return (
    <svg width="18" height="11" viewBox="0 0 18 11" fill="none" className="inline-block text-gray-400">
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

function groupByDate(msgs) {
  const groups = []
  let cur = null
  msgs.forEach(msg => {
    const d = new Date(msg.created_at).toDateString()
    if (d !== cur) { groups.push({ type: 'date', label: formatDate(msg.created_at) }); cur = d }
    groups.push({ type: 'message', data: msg })
  })
  return groups
}

// ── MAIN COMPONENT ─────────────────────────────────────────
export default function Messaging() {
  const { profile, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()

  const [conversations, setConversations] = useState([])
  const [activeConvo, setActiveConvo]     = useState(null)
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

  const bottomRef = useRef(null)
  const fileRef   = useRef(null)
  const textRef   = useRef(null)
  const activeConvoRef = useRef(null)

  // Keep ref in sync for use inside callbacks
  useEffect(() => { activeConvoRef.current = activeConvo }, [activeConvo])

  // ── Build sender lookup from both profile tables ──────────
  async function buildSenderMap(senderIds) {
    const ids = [...new Set(senderIds.filter(Boolean))]
    if (!ids.length) return {}
    const [{ data: reg }, { data: guests }] = await Promise.all([
      supabase.from('hhf_profiles').select('id, full_name, role, online_status').in('id', ids),
      supabase.from('hhf_guest_profiles').select('id, full_name').in('id', ids)
    ])
    const map = {}
    ;(reg    || []).forEach(s => { map[s.id] = s })
    ;(guests || []).forEach(s => { map[s.id] = { ...s, role: 'visitor', online_status: 'offline' } })
    return map
  }

  // ── Load conversations ────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!profile) return
    setLoadingConvos(true)

    const { data, error } = await supabase
      .from('hhf_conversations')
      .select('id, last_message_at, last_message_preview, participant_a, participant_b')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error || !data) { setLoadingConvos(false); return }

    const allIds = [...new Set(data.flatMap(c => [c.participant_a, c.participant_b]))]
    const senderMap = await buildSenderMap(allIds)

    const enriched = data.map(c => {
      const pA = senderMap[c.participant_a] || { id: c.participant_a, full_name: 'Unknown', role: 'visitor' }
      const pB = senderMap[c.participant_b] || { id: c.participant_b, full_name: 'Unknown', role: 'visitor' }
      const other = pA.id === profile.id ? pB : pA
      return { ...c, participant_a: pA, participant_b: pB, other }
    })

    setConversations(enriched)
    setLoadingConvos(false)

    // Auto-open from URL
    const cid = new URLSearchParams(window.location.search).get('convo')
    if (cid && !activeConvoRef.current) {
      const found = enriched.find(c => c.id === cid)
      if (found) openConversation(found)
    }
  }, [profile])

  useEffect(() => {
    if (!profile) return
    loadConversations()

    const sub = supabase.channel('hhf_convo_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hhf_conversations' }, loadConversations)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hhf_messages' }, loadConversations)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [profile])

  // ── Load messages ─────────────────────────────────────────
  async function loadMessages(convoId) {
    setLoadingMsgs(true)
    const { data, error } = await supabase
      .from('hhf_messages')
      .select('id, body, status, read_at, is_away_reply, created_at, sender_id, attachments:hhf_message_attachments(id, file_name, storage_path, mime_type, file_size, type)')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      const senderMap = await buildSenderMap(data.map(m => m.sender_id))
      const enriched = data.map(m => ({ ...m, sender: senderMap[m.sender_id] || null }))
      setMessages(enriched)
    }
    setLoadingMsgs(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // ── Mark messages as read ─────────────────────────────────
  async function markMessagesRead(convoId) {
    if (!profile) return
    const { data: unread } = await supabase
      .from('hhf_messages')
      .select('id')
      .eq('conversation_id', convoId)
      .neq('sender_id', profile.id)
      .neq('status', 'read')

    if (unread && unread.length > 0) {
      const ids = unread.map(m => m.id)
      await supabase.rpc('hhf_mark_messages_read', { message_ids: ids })
      // Update local state immediately
      setMessages(prev => prev.map(m =>
        ids.includes(m.id) ? { ...m, status: 'read', read_at: new Date().toISOString() } : m
      ))
    }
  }

  // ── Open conversation ─────────────────────────────────────
  async function openConversation(convo) {
    setActiveConvo(convo)
    setShowInfo(false)
    window.history.replaceState(null, '', `?convo=${convo.id}`)
    await loadMessages(convo.id)
    markMessagesRead(convo.id)
  }

  // ── Realtime messages ─────────────────────────────────────
  useEffect(() => {
    if (!activeConvo) return

    const sub = supabase
      .channel(`hhf_msgs_${activeConvo.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hhf_messages',
        filter: `conversation_id=eq.${activeConvo.id}`
      }, async payload => {
        const senderMap = await buildSenderMap([payload.new.sender_id])
        const newMsg = { ...payload.new, sender: senderMap[payload.new.sender_id] || null, attachments: [] }
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        // Mark as read if it's from the other person
        if (payload.new.sender_id !== profile.id) {
          await supabase.rpc('hhf_mark_messages_read', { message_ids: [payload.new.id] })
          setMessages(prev => prev.map(m =>
            m.id === payload.new.id ? { ...m, status: 'read', read_at: new Date().toISOString() } : m
          ))
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'hhf_messages',
        filter: `conversation_id=eq.${activeConvo.id}`
      }, payload => {
        // Other person read our message — update tick
        setMessages(prev => prev.map(m =>
          m.id === payload.new.id
            ? { ...m, status: payload.new.status, read_at: payload.new.read_at }
            : m
        ))
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [activeConvo?.id])

  // ── Send message ──────────────────────────────────────────
  async function sendMessage() {
    const body = newMessage.trim()
    if (!body || !activeConvo || sending) return
    setSending(true)
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

  // ── File upload ───────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !activeConvo) return
    setUploading(true)
    const path = `${activeConvo.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('hhf-documents').upload(path, file)
    if (upErr) { setUploading(false); alert('Upload failed: ' + upErr.message); return }
    const { data: msg } = await supabase.from('hhf_messages').insert({
      conversation_id: activeConvo.id, sender_id: profile.id, body: null, status: 'sent'
    }).select().single()
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

  // ── Start new conversation ────────────────────────────────
  async function loadUsers() {
    let query = supabase.from('hhf_profiles').select('id, full_name, role, online_status').eq('status', 'active').neq('id', profile.id)
    if (!isAdmin) {
      const { data: assignments } = await supabase.from('hhf_staff_assignments').select('client_id').eq('staff_id', profile.id)
      const ids = assignments?.map(a => a.client_id) || []
      if (!ids.length) { setUsers([]); return }
      query = query.in('id', ids)
    }
    const { data } = await query.order('full_name')
    setUsers(data || [])
  }

  async function startConversation(userId) {
    const a = profile.id < userId ? profile.id : userId
    const b = profile.id < userId ? userId : profile.id
    let { data: existing } = await supabase.from('hhf_conversations').select('*').eq('participant_a', a).eq('participant_b', b).single()
    if (!existing) {
      const { data } = await supabase.from('hhf_conversations').insert({ participant_a: a, participant_b: b }).select().single()
      existing = data
    }
    setShowNewConvo(false)
    setUserSearch('')
    await loadConversations()
    if (existing) {
      setTimeout(() => {
        setConversations(prev => {
          const found = prev.find(c => c.id === existing.id)
          if (found) openConversation(found)
          return prev
        })
      }, 500)
    }
  }

  function getFileUrl(path) {
    const { data } = supabase.storage.from('hhf-documents').getPublicUrl(path)
    return data?.publicUrl
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const filtered = conversations.filter(c =>
    (c.other?.full_name || '').toLowerCase().includes(search.toLowerCase())
  )
  const otherUser = activeConvo?.other

  return (
    <AppShell>
      <div className="h-[calc(100vh-112px)] flex rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">

        {/* ── SIDEBAR ── */}
        <div className={`w-full md:w-72 flex-shrink-0 border-r border-gray-100 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Messages</h2>
              <button onClick={() => { setShowNewConvo(true); loadUsers() }}
                className="w-7 h-7 bg-hhf-blue text-white rounded-lg flex items-center justify-center hover:bg-hhf-blue-light transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
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
            ) : filtered.map(convo => (
              <div key={convo.id} onClick={() => openConversation(convo)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${activeConvo?.id === convo.id ? 'bg-hhf-blue-pale border-l-2 border-l-hhf-blue' : ''}`}>
                <Avatar name={convo.other?.full_name} id={convo.other?.id || ''} online={convo.other?.online_status === 'online'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm text-gray-900 truncate">{convo.other?.full_name || 'Unknown'}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(convo.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p className="text-xs text-gray-400 truncate">{convo.last_message_preview || 'No messages yet'}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      convo.other?.role === 'client' ? 'bg-hhf-blue-pale text-hhf-blue' :
                      convo.other?.role === 'staff'  ? 'bg-blue-50 text-blue-700' :
                      convo.other?.role === 'visitor' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>{convo.other?.role || 'visitor'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CHAT WINDOW ── */}
        {activeConvo ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
              <button className="md:hidden p-1 text-gray-400" onClick={() => { setActiveConvo(null); window.history.replaceState(null, '', '/admin/messages') }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <Avatar name={otherUser?.full_name} id={otherUser?.id || ''} online={otherUser?.online_status === 'online'} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{otherUser?.full_name}</div>
                <div className={`text-xs ${otherUser?.online_status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                  {otherUser?.online_status === 'online' ? '● Online' : otherUser?.online_status === 'busy' ? '● In session' : '○ Offline'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && <span className="text-xs bg-hhf-blue text-white px-2 py-0.5 rounded-full">Admin view</span>}
                <button onClick={() => setShowInfo(!showInfo)}
                  className={`p-2 rounded-lg transition-colors ${showInfo ? 'bg-hhf-blue-pale text-hhf-blue' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-1">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-hhf-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
                </div>
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
                          <img src={getFileUrl(att.storage_path)} alt={att.file_name}
                            className="rounded-xl max-w-full max-h-48 object-cover cursor-pointer border border-gray-200"
                            onClick={() => window.open(getFileUrl(att.storage_path), '_blank')} />
                        ) : (
                          <a href={getFileUrl(att.storage_path)} target="_blank" rel="noreferrer"
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${mine ? 'bg-hhf-blue text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0 flex items-end gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="p-2 text-gray-400 hover:text-hhf-blue hover:bg-hhf-blue-pale rounded-lg transition-colors flex-shrink-0 disabled:opacity-50">
                {uploading ? <div className="w-5 h-5 border-2 border-hhf-blue border-t-transparent rounded-full animate-spin" /> :
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                }
              </button>
              <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
              <textarea ref={textRef} value={newMessage} onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKey} rows={1} placeholder="Type a message... (Enter to send)"
                className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-hhf-blue transition-colors max-h-28"
                style={{ minHeight: '40px' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px' }}
              />
              <button onClick={sendMessage} disabled={!newMessage.trim() || sending}
                className="w-10 h-10 bg-hhf-blue text-white rounded-xl flex items-center justify-center hover:bg-hhf-blue-light transition-colors disabled:opacity-40 flex-shrink-0">
                {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                }
              </button>
            </div>
          </div>
        ) : (
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
              <span className="font-semibold text-sm">Info</span>
              <button onClick={() => setShowInfo(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-4 flex flex-col items-center border-b border-gray-100">
              <Avatar name={otherUser.full_name} id={otherUser.id || ''} size="lg" online={otherUser.online_status === 'online'} />
              <div className="mt-3 font-semibold text-gray-900">{otherUser.full_name}</div>
              <span className={`mt-1 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                otherUser.role === 'client' ? 'bg-hhf-blue-pale text-hhf-blue' :
                otherUser.role === 'visitor' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700'
              }`}>{otherUser.role}</span>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div><div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Messages</div><div className="text-gray-700">{messages.length} total</div></div>
            </div>
          </div>
        )}

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
                <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-hhf-blue mb-3"
                  placeholder="Search by name..." value={userSearch} onChange={e => setUserSearch(e.target.value)} autoFocus />
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {users.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase())).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No users found</p>
                  ) : users.filter(u => u.full_name.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                    <button key={u.id} onClick={() => startConversation(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-hhf-blue-pale transition-colors text-left">
                      <Avatar name={u.full_name} id={u.id} size="sm" online={u.online_status === 'online'} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{u.full_name}</div>
                        <div className="text-xs text-gray-400 capitalize">{u.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
