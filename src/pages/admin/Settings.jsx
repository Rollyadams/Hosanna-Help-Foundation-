import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'

// ── ICONS ──────────────────────────────────────────────────
const Icon = {
  Save:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Check:  () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  Alert:  () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Eye:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  User:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Bell:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Lock:   () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Org:    () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
}

// ── TOGGLE ─────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

// ── SECTION ────────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── INPUT ──────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"

// ── MAIN ───────────────────────────────────────────────────
export default function Settings() {
  const { profile, refreshProfile } = useAuth()

  // Profile
  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')

  // Password
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [showPw, setShowPw]         = useState(false)

  // Notification prefs (stored in hhf_profiles.settings jsonb)
  const [notifPrefs, setNotifPrefs] = useState({
    new_message:           true,
    appointment_confirmed: true,
    appointment_cancelled: true,
    new_user_registered:   true,
    document_shared:       false,
  })

  // UI state
  const [saving, setSaving]         = useState(false)
  const [savingPw, setSavingPw]     = useState(false)
  const [success, setSuccess]       = useState('')
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setPhone(profile.phone || '')
    setEmail(profile.email || '')
    if (profile.settings?.notif_prefs) {
      setNotifPrefs(p => ({ ...p, ...profile.settings.notif_prefs }))
    }
  }, [profile])

  function flash(msg, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000) }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  }

  // ── SAVE PROFILE ─────────────────────────────────────────
  async function saveProfile() {
    if (!fullName.trim()) return flash('Full name is required.', true)
    setSaving(true)
    const { error: err } = await supabase
      .from('hhf_profiles')
      .update({
        full_name:  fullName.trim(),
        phone:      phone.trim() || null,
        settings:   { ...(profile?.settings || {}), notif_prefs: notifPrefs },
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    setSaving(false)
    if (err) return flash(err.message, true)

    // Refresh profile in context so header name updates live
    if (typeof refreshProfile === 'function') refreshProfile()

    await supabase.from('hhf_audit_logs').insert({
      actor_id: profile.id, action: 'profile_updated',
      target_type: 'profile', target_id: profile.id,
    }).catch(() => {})

    flash('Profile saved successfully.')
  }

  // ── CHANGE PASSWORD ───────────────────────────────────────
  async function changePassword() {
    if (!newPw) return flash('Enter a new password.', true)
    if (newPw.length < 8) return flash('Password must be at least 8 characters.', true)
    if (newPw !== confirmPw) return flash('Passwords do not match.', true)

    setSavingPw(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)

    if (err) return flash(err.message, true)

    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    flash('Password updated successfully.')
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and platform preferences</p>
      </div>

      {/* Banners */}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Check />{success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <Icon.Alert />{error}
        </div>
      )}

      <div className="flex flex-col gap-5">

        {/* ── Profile ── */}
        <Section title="My Profile" icon={<Icon.User />}>
          <div className="space-y-4">
            <Field label="Full Name">
              <input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            </Field>
            <Field label="Email Address">
              <input className={`${inputCls} bg-gray-50 text-gray-400 cursor-not-allowed`} value={email} readOnly />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here. Contact Supabase Auth to update.</p>
            </Field>
            <Field label="Phone Number">
              <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234..." type="tel" />
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <span className={`text-xs px-2 py-1 rounded-full border font-medium capitalize
                ${profile?.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {profile?.role}
              </span>
              <span className="text-xs text-gray-400">Role · managed by system</span>
            </div>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : <><Icon.Save /> Save Profile</>}
            </button>
          </div>
        </Section>

        {/* ── Notification Prefs ── */}
        <Section title="Notification Preferences" icon={<Icon.Bell />}>
          <div className="divide-y divide-gray-50">
            <Toggle
              checked={notifPrefs.new_message}
              onChange={v => setNotifPrefs(p => ({ ...p, new_message: v }))}
              label="New Messages"
              description="Notify when a new message arrives"
            />
            <Toggle
              checked={notifPrefs.appointment_confirmed}
              onChange={v => setNotifPrefs(p => ({ ...p, appointment_confirmed: v }))}
              label="Appointment Confirmed"
              description="When an appointment is approved"
            />
            <Toggle
              checked={notifPrefs.appointment_cancelled}
              onChange={v => setNotifPrefs(p => ({ ...p, appointment_cancelled: v }))}
              label="Appointment Cancelled"
              description="When an appointment is cancelled"
            />
            <Toggle
              checked={notifPrefs.new_user_registered}
              onChange={v => setNotifPrefs(p => ({ ...p, new_user_registered: v }))}
              label="New User Registered"
              description="When a new user signs up (admin only)"
            />
            <Toggle
              checked={notifPrefs.document_shared}
              onChange={v => setNotifPrefs(p => ({ ...p, document_shared: v }))}
              label="Document Shared"
              description="When a document is shared with you"
            />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : <><Icon.Save /> Save Preferences</>}
          </button>
        </Section>

        {/* ── Password ── */}
        <Section title="Change Password" icon={<Icon.Lock />}>
          <div className="space-y-4">
            <Field label="New Password">
              <div className="relative">
                <input
                  className={inputCls}
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <Icon.EyeOff /> : <Icon.Eye />}
                </button>
              </div>
            </Field>
            <Field label="Confirm New Password">
              <input
                className={inputCls}
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
              />
            </Field>

            {/* Strength indicator */}
            {newPw && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      newPw.length >= i * 3
                        ? newPw.length >= 12 ? 'bg-green-500'
                        : newPw.length >= 8  ? 'bg-amber-400'
                        : 'bg-red-400'
                        : 'bg-gray-100'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {newPw.length < 8 ? 'Too short' : newPw.length < 12 ? 'Acceptable' : 'Strong'}
                </p>
              </div>
            )}

            <button
              onClick={changePassword}
              disabled={savingPw || !newPw || !confirmPw}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              {savingPw ? 'Updating…' : <><Icon.Lock /> Update Password</>}
            </button>
          </div>
        </Section>

        {/* ── Platform Info ── */}
        <Section title="Platform Info" icon={<Icon.Org />}>
          <div className="space-y-3">
            {[
              { label: 'Platform',      value: 'HHF CareConnect' },
              { label: 'Organisation',  value: 'Hossanah Help Foundation' },
              { label: 'Website',       value: 'hhfoundation.com.ng' },
              { label: 'Built by',      value: 'Rollyadams Techworld Nigeria' },
              { label: 'Stack',         value: 'React + Vite · Supabase · Vercel' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
                <span className="text-xs text-gray-700 font-medium text-right">{value}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </AppShell>
  )
}
