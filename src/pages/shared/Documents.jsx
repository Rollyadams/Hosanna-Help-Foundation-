import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── HELPERS ────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function fileIcon(mime = '') {
  if (mime.includes('pdf'))   return { icon: '📄', color: 'bg-red-50 text-red-600' }
  if (mime.includes('image')) return { icon: '🖼️', color: 'bg-purple-50 text-purple-600' }
  if (mime.includes('word') || mime.includes('document')) return { icon: '📝', color: 'bg-blue-50 text-blue-600' }
  if (mime.includes('sheet') || mime.includes('excel'))   return { icon: '📊', color: 'bg-green-50 text-green-600' }
  return { icon: '📎', color: 'bg-gray-50 text-gray-600' }
}

const ACCESS_LABELS = { private: 'Private', staff: 'Staff only', all: 'All users' }

// ── ICONS ──────────────────────────────────────────────────
const Icon = {
  Upload:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.11"/></svg>,
  Trash:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  X:        () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Alert:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Lock:     () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Globe:    () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>,
  Filter:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
}

// ── MODAL ──────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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

// ── UPLOAD FORM ────────────────────────────────────────────
function UploadForm({ profile, onUploaded, onClose }) {
  const inputRef   = useRef()
  const [file, setFile]         = useState(null)
  const [label, setLabel]       = useState('')
  const [access, setAccess]     = useState('private')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError]       = useState('')

  function handleFile(f) {
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return }
    setFile(f)
    setLabel(f.name.replace(/\.[^.]+$/, ''))
    setError('')
  }

  async function handleUpload() {
    if (!file) return setError('Please select a file.')
    if (!label.trim()) return setError('Please enter a label.')
    setUploading(true); setError(''); setProgress(10)

    const ext  = file.name.split('.').pop()
    const path = `${profile.id}/${Date.now()}.${ext}`

    // Upload to storage
    const { error: upErr } = await supabase.storage
      .from('hhf-documents')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (upErr) { setError(upErr.message); setUploading(false); setProgress(0); return }

    setProgress(70)

    // Get public URL (synchronous — no await needed)
    const { data: urlData } = supabase.storage.from('hhf-documents').getPublicUrl(path)

    setProgress(85)

    // Save record — use upsert-style insert with explicit returning
    const { data: inserted, error: dbErr } = await supabase
      .from('hhf_documents')
      .insert({
        owner_id:     profile.id,
        uploaded_by:  profile.id,
        label:        label.trim(),
        file_path:    path,
        file_url:     urlData?.publicUrl || '',
        file_type:    file.type || 'application/octet-stream',
        file_size:    file.size,
        access_level: access,
      })
      .select()
      .single()

    if (dbErr) {
      // DB failed — clean up the uploaded file
      await supabase.storage.from('hhf-documents').remove([path]).catch(() => {})
      setError(`DB error: ${dbErr.message}`)
      setUploading(false)
      setProgress(0)
      return
    }

    setProgress(100)

    // Audit log (fire and forget)
    supabase.from('hhf_audit_logs').insert({
      actor_id: profile.id, action: 'document_uploaded',
      target_type: 'document', target_id: inserted?.id,
      details: { label: label.trim(), access }
    }).catch(() => {})

    setUploading(false)
    onUploaded()
    onClose()
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
      >
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
          onChange={e => handleFile(e.target.files[0])} />
        {file ? (
          <div>
            <p className="text-2xl mb-1">{fileIcon(file.type).icon}</p>
            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{fmtSize(file.size)}</p>
          </div>
        ) : (
          <div>
            <div className="text-gray-300 flex justify-center mb-2"><Icon.Upload /></div>
            <p className="text-sm text-gray-500">Tap to select file</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images · Max 10 MB</p>
          </div>
        )}
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Document Label *</label>
        <input
          type="text"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Assessment Form, ID Copy…"
        />
      </div>

      {/* Access level */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Who can see this?</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'private', label: 'Only Me',   icon: '🔒' },
            { value: 'staff',   label: 'Staff too', icon: '👥' },
            { value: 'all',     label: 'Everyone',  icon: '🌐' },
          ].map(a => (
            <button key={a.value} type="button" onClick={() => setAccess(a.value)}
              className={`py-2.5 text-xs font-medium rounded-xl border transition-colors ${access === a.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
              <div>{a.icon}</div>
              <div className="mt-0.5">{a.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {uploading && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <Icon.Alert />{error}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleUpload} disabled={uploading || !file}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

// ── DOC CARD ───────────────────────────────────────────────
function DocCard({ doc, canDelete, onDelete, onDownload }) {
  const { icon, color } = fileIcon(doc.file_type)
  const accessIcon = doc.access_level === 'private' ? <Icon.Lock /> : <Icon.Globe />

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${color}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{doc.label}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400">{fmtSize(doc.file_size)}</span>
            <span className="text-gray-200">·</span>
            <span className="text-xs text-gray-400">{fmtDate(doc.created_at)}</span>
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              {accessIcon}
              <span className="ml-0.5">{ACCESS_LABELS[doc.access_level]}</span>
            </span>
          </div>
          {doc.uploader_name && (
            <p className="text-xs text-gray-400 mt-0.5">By {doc.uploader_name}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onDownload(doc)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Icon.Download />
          </button>
          {canDelete && (
            <button onClick={() => onDelete(doc)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Icon.Trash />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────
export default function Documents() {
  const { profile } = useAuth()
  const role = profile?.role

  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [filter, setFilter]     = useState('all') // all | mine | shared

  // ── LOAD ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError('')
    let q = supabase.from('hhf_documents').select('*').order('created_at', { ascending: false })

    if (role === 'client') {
      // Clients see their own docs + docs shared with 'all'
      q = q.or(`owner_id.eq.${profile.id},access_level.eq.all`)
    } else if (role === 'staff') {
      // Staff see staff-level + all docs
      q = q.or(`uploaded_by.eq.${profile.id},access_level.in.(staff,all)`)
    }
    // admin sees everything

    const { data, error: err } = await q
    if (err) { setError(err.message); setLoading(false); return }

    // Enrich with uploader names
    const uploaderIds = [...new Set((data||[]).map(d => d.uploaded_by).filter(Boolean))]
    let nameMap = {}
    if (uploaderIds.length) {
      const { data: profiles } = await supabase.from('hhf_profiles').select('id, full_name').in('id', uploaderIds)
      ;(profiles||[]).forEach(p => { nameMap[p.id] = p.full_name })
    }

    setDocs((data||[]).map(d => ({ ...d, uploader_name: nameMap[d.uploaded_by] })))
    setLoading(false)
  }, [profile, role])

  useEffect(() => { load() }, [load])

  // ── FILTER ────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    if (filter === 'mine')   return d.owner_id === profile?.id
    if (filter === 'shared') return d.owner_id !== profile?.id
    return true
  })

  // ── DOWNLOAD ────────────────────────────────────────────
  async function handleDownload(doc) {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank')
      return
    }
    // Fallback: generate signed URL
    const { data } = await supabase.storage.from('hhf-documents').createSignedUrl(doc.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // ── DELETE ────────────────────────────────────────────────
  async function handleDelete(doc) {
    setDeleting(doc.id)
    // Remove from storage
    await supabase.storage.from('hhf-documents').remove([doc.file_path]).catch(() => {})
    // Remove record
    const { error: err } = await supabase.from('hhf_documents').delete().eq('id', doc.id)
    if (err) { setError(err.message); setDeleting(null); return }

    await supabase.from('hhf_audit_logs').insert({
      actor_id: profile.id, action: 'document_deleted',
      target_type: 'document', target_id: doc.id,
      details: { label: doc.label }
    }).catch(() => {})

    setDeleting(null)
    load()
  }

  const canDelete = (doc) => role === 'admin' || doc.owner_id === profile?.id

  const stats = {
    total: docs.length,
    mine:  docs.filter(d => d.owner_id === profile?.id).length,
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload and access files securely</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors flex-shrink-0">
          <Icon.Upload /> Upload
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-2xl font-bold text-gray-900">{loading ? '—' : stats.total}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Documents</div>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
          <div className="text-2xl font-bold text-blue-700">{loading ? '—' : stats.mine}</div>
          <div className="text-xs text-gray-500 mt-0.5">My Uploads</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
        {[['all','All'],['mine','Mine'],['shared','Shared']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Alert />{error}
          <button onClick={() => setError('')} className="ml-auto"><Icon.X /></button>
        </div>
      )}

      {/* Storage setup notice for admin */}
      {role === 'admin' && !loading && docs.length === 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
          <Icon.Alert />
          <div>
            <p className="font-medium">Storage bucket needed</p>
            <p className="text-xs mt-0.5">Create a bucket named <code className="bg-amber-100 px-1 rounded">hhf-documents</code> in Supabase Storage, then set it to public or configure RLS.</p>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
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
          <div className="text-5xl mb-4">📁</div>
          <p className="text-gray-900 font-medium">No documents yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Upload files to share securely</p>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
            <Icon.Upload /> Upload Document
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(doc => (
            <DocCard
              key={doc.id}
              doc={doc}
              canDelete={canDelete(doc)}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <Modal title="Upload Document" onClose={() => setShowUpload(false)}>
          <UploadForm profile={profile} onUploaded={load} onClose={() => setShowUpload(false)} />
        </Modal>
      )}
    </AppShell>
  )
}
