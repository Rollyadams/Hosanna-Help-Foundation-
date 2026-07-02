import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const labelCls = "block text-xs font-medium text-gray-700 mb-1"

function Field({ label, required, children }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}

export default function StaffApply() {
  const [params] = useSearchParams()
  const navigate  = useNavigate()
  const token     = params.get('token')
  const cvRef     = useRef()
  const docsRef   = useRef()

  const [invite, setInvite]   = useState(null)
  const [invalid, setInvalid] = useState(false)
  const [step, setStep]       = useState(1) // 1=personal, 2=professional, 3=account, 4=done
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', date_of_birth: '',
    gender: '', address: '', qualification: '', experience_yrs: '',
    emergency_name: '', emergency_phone: '',
    password: '', confirm: '',
  })
  const [cvFile, setCvFile]     = useState(null)
  const [docFiles, setDocFiles] = useState([])

  // ── Validate token ────────────────────────────────
  useEffect(() => {
    if (!token) { setInvalid(true); return }
    supabase.from('hhf_staff_invites')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single()
      .then(({ data, error }) => {
        if (error || !data) setInvalid(true)
        else { setInvite(data); if (data.email) setForm(f => ({ ...f, email: data.email })) }
      })
  }, [token])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  // ── Step validation ───────────────────────────────
  function validateStep() {
    if (step === 1) {
      if (!form.full_name.trim()) return 'Full name is required.'
      if (!form.phone.trim())     return 'Phone number is required.'
      if (!form.date_of_birth)    return 'Date of birth is required.'
      if (!form.gender)           return 'Please select gender.'
      if (!form.address.trim())   return 'Address is required.'
    }
    if (step === 2) {
      if (!form.qualification.trim()) return 'Qualification is required.'
      if (!cvFile)                    return 'Please upload your CV.'
    }
    if (step === 3) {
      if (!form.email.trim())         return 'Email is required.'
      if (!form.password)             return 'Password is required.'
      if (form.password.length < 8)   return 'Password must be at least 8 characters.'
      if (form.password !== form.confirm) return 'Passwords do not match.'
      if (!form.emergency_name.trim())    return 'Emergency contact name is required.'
      if (!form.emergency_phone.trim())   return 'Emergency contact phone is required.'
    }
    return null
  }

  function nextStep() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  // ── Submit ────────────────────────────────────────
  async function handleSubmit() {
    const err = validateStep()
    if (err) { setError(err); return }
    setSaving(true); setError('')

    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options:  { data: { app: 'hhf', full_name: form.full_name } }
      })
      if (authErr) throw new Error(authErr.message)
      const uid = authData.user?.id
      if (!uid) throw new Error('Account creation failed.')

      // 2. Upload CV
      let cvUrl = null
      if (cvFile) {
        const cvPath = `${uid}/cv-${Date.now()}.${cvFile.name.split('.').pop()}`
        const { error: cvErr } = await supabase.storage.from('hhf-documents').upload(cvPath, cvFile)
        if (cvErr) throw new Error(`CV upload failed: ${cvErr.message}`)
        const { data: cvData } = supabase.storage.from('hhf-documents').getPublicUrl(cvPath)
        cvUrl = cvData?.publicUrl
      }

      // 3. Upload additional docs
      const docsUrls = []
      for (const f of docFiles) {
        const p = `${uid}/docs-${Date.now()}-${f.name}`
        const { error: dErr } = await supabase.storage.from('hhf-documents').upload(p, f)
        if (!dErr) {
          const { data: dData } = supabase.storage.from('hhf-documents').getPublicUrl(p)
          docsUrls.push({ name: f.name, url: dData?.publicUrl })
        }
      }

      // 4. Upsert profile with all application fields
      const { error: profErr } = await supabase.from('hhf_profiles').upsert({
        id:                 uid,
        full_name:          form.full_name,
        email:              form.email,
        phone:              form.phone,
        role:               'staff',
        status:             'pending',
        date_of_birth:      form.date_of_birth || null,
        gender:             form.gender || null,
        address:            form.address || null,
        qualification:      form.qualification || null,
        experience_yrs:     form.experience_yrs ? parseInt(form.experience_yrs) : null,
        emergency_name:     form.emergency_name || null,
        emergency_phone:    form.emergency_phone || null,
        cv_url:             cvUrl,
        docs_urls:          docsUrls,
        invite_token:       token,
        application_status: 'pending',
      }, { onConflict: 'id' })
      if (profErr) throw new Error(profErr.message)

      // 5. Mark invite as used
      await supabase.from('hhf_staff_invites')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('token', token)

      // 6. Notify admins
      const { data: admins } = await supabase
        .from('hhf_profiles').select('id').eq('role', 'admin').eq('status', 'active')
      if (admins?.length) {
        await supabase.from('hhf_notifications').insert(
          admins.map(a => ({
            recipient_id: a.id,
            type:         'new_user_registered',
            title:        'New Staff Application',
            body:         `${form.full_name} has submitted a staff application and is awaiting review.`,
            link:         '/admin/users',
          }))
        )
      }

      setStep(4)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Invalid token ─────────────────────────────────
  if (invalid) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
        <p className="text-sm text-gray-500">This invite link has expired or already been used. Contact HHF admin for a new one.</p>
      </div>
    </div>
  )

  if (!invite) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Verifying invite link…</div>
    </div>
  )

  // ── Done ──────────────────────────────────────────
  if (step === 4) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Application Submitted!</h2>
        <p className="text-sm text-gray-500">Your application has been received. The admin will review it and activate your account. You'll be notified once accepted.</p>
      </div>
    </div>
  )

  // ── Form ──────────────────────────────────────────
  const steps = ['Personal', 'Professional', 'Account']

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #1a5fa8, #2e7d32)' }}>
            <span className="text-white font-bold text-lg">HHF</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Application</h1>
          <p className="text-sm text-gray-500 mt-1">Hossanah Help Foundation</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                step > i+1 ? 'bg-green-500 text-white' :
                step === i+1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > i+1 ? '✓' : i+1}
              </div>
              <span className={`text-xs font-medium ${step === i+1 ? 'text-blue-600' : 'text-gray-400'}`}>{s}</span>
              {i < steps.length-1 && <div className={`flex-1 h-px ${step > i+1 ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          {/* ── Step 1: Personal ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 mb-4">Personal Information</h2>
              <Field label="Full Name" required>
                <input className={inputCls} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="First and last name" />
              </Field>
              <Field label="Phone Number" required>
                <input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+234 800 000 0000" />
              </Field>
              <Field label="Date of Birth" required>
                <input className={inputCls} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
              </Field>
              <Field label="Gender" required>
                <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not">Prefer not to say</option>
                </select>
              </Field>
              <Field label="Residential Address" required>
                <textarea className={inputCls} rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="House no., street, city, state" />
              </Field>
            </div>
          )}

          {/* ── Step 2: Professional ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 mb-4">Professional Details</h2>
              <Field label="Highest Qualification" required>
                <input className={inputCls} value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. B.Sc Psychology, MSW…" />
              </Field>
              <Field label="Years of Experience">
                <input className={inputCls} type="number" min="0" max="50" value={form.experience_yrs} onChange={e => set('experience_yrs', e.target.value)} placeholder="0" />
              </Field>

              {/* CV upload */}
              <Field label="Upload CV / Resume" required>
                <div
                  onClick={() => cvRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${cvFile ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                >
                  <input ref={cvRef} type="file" className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={e => setCvFile(e.target.files[0])} />
                  {cvFile
                    ? <p className="text-sm text-blue-700 font-medium">📄 {cvFile.name}</p>
                    : <p className="text-sm text-gray-400">Tap to upload CV (PDF or Word)</p>
                  }
                </div>
              </Field>

              {/* Additional docs */}
              <Field label="Additional Documents (optional)">
                <div
                  onClick={() => docsRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <input ref={docsRef} type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={e => setDocFiles(Array.from(e.target.files))} />
                  {docFiles.length
                    ? <p className="text-sm text-gray-700">{docFiles.length} file{docFiles.length > 1 ? 's' : ''} selected</p>
                    : <p className="text-sm text-gray-400">Certifications, ID, references (optional)</p>
                  }
                </div>
              </Field>
            </div>
          )}

          {/* ── Step 3: Account + Emergency ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 mb-1">Account & Emergency Contact</h2>
              <Field label="Email Address" required>
                <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="your@email.com" />
              </Field>
              <Field label="Password" required>
                <input className={inputCls} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 8 characters" />
              </Field>
              <Field label="Confirm Password" required>
                <input className={inputCls} type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="Repeat password" />
              </Field>

              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Emergency Contact</p>
                <div className="space-y-3">
                  <Field label="Contact Name" required>
                    <input className={inputCls} value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} placeholder="Full name" />
                  </Field>
                  <Field label="Contact Phone" required>
                    <input className={inputCls} type="tel" value={form.emergency_phone} onChange={e => set('emergency_phone', e.target.value)} placeholder="+234..." />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button onClick={() => { setStep(s => s-1); setError('') }}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Back
              </button>
            )}
            {step < 3
              ? <button onClick={nextStep} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">
                  Next →
                </button>
              : <button onClick={handleSubmit} disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Submitting…' : 'Submit Application'}
                </button>
            }
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          This invite link is single-use and expires in 48 hours.
        </p>
      </div>
    </div>
  )
}
