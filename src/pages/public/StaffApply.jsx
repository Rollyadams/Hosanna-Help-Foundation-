import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
const labelCls = "block text-xs font-medium text-gray-700 mb-1"

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function SectionTitle({ emoji, title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="font-bold text-gray-900 text-base flex items-center gap-2"><span>{emoji}</span>{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function DropZone({ inputRef, file, onFile, accept, label, multi }) {
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); multi ? onFile(Array.from(e.dataTransfer.files)) : onFile(e.dataTransfer.files[0]) }}
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
    >
      <input ref={inputRef} type="file" className="hidden" accept={accept} multiple={!!multi}
        onChange={e => multi ? onFile(Array.from(e.target.files)) : onFile(e.target.files[0])} />
      {file
        ? <p className="text-sm font-medium text-blue-700">{Array.isArray(file) ? `${file.length} file(s) selected` : `📎 ${file.name}`}</p>
        : <p className="text-sm text-gray-400">{label}</p>
      }
    </div>
  )
}

const STEPS = [
  { label: 'Personal',    emoji: '👤' },
  { label: 'Role',        emoji: '💼' },
  { label: 'Education',   emoji: '🎓' },
  { label: 'Experience',  emoji: '⏳' },
  { label: 'Emergency',   emoji: '🚨' },
  { label: 'Declaration', emoji: '✍️' },
]

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
const EMP_TYPES    = ['Full-Time','Part-Time','Contract','Intern','Temporary']
const GENDERS      = ['Male','Female','Other','Prefer not to say']
const EDU_LEVELS   = ["High School","Diploma","Bachelor's","Master's","PhD","Professional Certification"]

export default function StaffApply() {
  const [params]  = useSearchParams()
  const token     = params.get('token')
  const cvRef     = useRef(); const idRef = useRef()
  const photoRef  = useRef(); const extraRef = useRef()

  const [invite, setInvite]     = useState(null)
  const [invalid, setInvalid]   = useState(false)
  const [step, setStep]         = useState(1)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [agreed, setAgreed]     = useState(false)
  const [cvFile, setCvFile]     = useState(null)
  const [idFile, setIdFile]     = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [extraFiles, setExtraFiles] = useState([])

  const [form, setForm] = useState({
    full_name:'', date_of_birth:'', gender:'', national_id:'', phone:'', email:'',
    address:'', permanent_address:'',
    job_title:'', department:'', employment_type:'', line_manager:'', start_date:'',
    edu_level:'', institution:'', field_of_study:'', graduation_year:'', certifications:'',
    prev_company_1:'', prev_title_1:'', prev_from_1:'', prev_to_1:'', prev_reason_1:'',
    prev_company_2:'', prev_title_2:'', prev_from_2:'', prev_to_2:'', prev_reason_2:'',
    ref1_name:'', ref1_company:'', ref1_contact:'',
    ref2_name:'', ref2_company:'', ref2_contact:'',
    emg_name:'', emg_relationship:'', emg_phone:'', blood_group:'', medical_notes:'',
    password:'', confirm:'',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  useEffect(() => {
    if (!token) { setInvalid(true); return }
    supabase.from('hhf_staff_invites').select('*').eq('token', token).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single()
      .then(({ data, error }) => {
        if (error || !data) setInvalid(true)
        else { setInvite(data); if (data.email) set('email', data.email) }
      })
  }, [token])

  function validate() {
    if (step === 1) {
      if (!form.full_name.trim())  return 'Full name is required.'
      if (!form.date_of_birth)     return 'Date of birth is required.'
      if (!form.gender)            return 'Gender is required.'
      if (!form.phone.trim())      return 'Phone number is required.'
      if (!form.email.trim())      return 'Email address is required.'
      if (!form.address.trim())    return 'Current address is required.'
    }
    if (step === 3) {
      if (!form.edu_level)         return 'Education level is required.'
      if (!form.institution.trim()) return 'Institution name is required.'
      if (!cvFile)                 return 'Please upload your CV.'
    }
    if (step === 5) {
      if (!form.emg_name.trim())          return 'Emergency contact name is required.'
      if (!form.emg_phone.trim())         return 'Emergency contact phone is required.'
      if (!form.emg_relationship.trim())  return 'Relationship is required.'
    }
    if (step === 6) {
      if (!form.password)                   return 'Password is required.'
      if (form.password.length < 8)         return 'Password must be at least 8 characters.'
      if (form.password !== form.confirm)   return 'Passwords do not match.'
      if (!agreed)                          return 'Please agree to the declaration.'
    }
    return null
  }

  function next() {
    const err = validate()
    if (err) { setError(err); return }
    setError(''); setStep(s => s + 1)
  }

  async function uploadFile(uid, file, folder) {
    if (!file) return null
    const ext  = file.name.split('.').pop()
    const path = `${uid}/${folder}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('hhf-documents').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('hhf-documents').getPublicUrl(path)
    return data?.publicUrl || null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError('')
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { app: 'hhf', full_name: form.full_name } }
      })
      if (authErr) throw new Error(authErr.message)
      const uid = authData.user?.id
      if (!uid) throw new Error('Account creation failed.')

      const [cvUrl, idUrl, photoUrl] = await Promise.all([
        uploadFile(uid, cvFile, 'cv'),
        uploadFile(uid, idFile, 'id'),
        uploadFile(uid, photoFile, 'photo'),
      ])
      const extraUrls = []
      for (const f of extraFiles) {
        const url = await uploadFile(uid, f, 'cert')
        if (url) extraUrls.push({ name: f.name, url })
      }

      const { error: profErr } = await supabase.from('hhf_profiles').upsert({
        id: uid, role: 'staff', status: 'pending', application_status: 'pending',
        invite_token: token, full_name: form.full_name, email: form.email,
        phone: form.phone, date_of_birth: form.date_of_birth || null,
        gender: form.gender || null, address: form.address || null,
        qualification: form.edu_level || null,
        emergency_name: form.emg_name || null, emergency_phone: form.emg_phone || null,
        cv_url: cvUrl,
        docs_urls: [
          ...(idUrl    ? [{ name: 'Government ID',  url: idUrl }]    : []),
          ...(photoUrl ? [{ name: 'Passport Photo', url: photoUrl }] : []),
          ...extraUrls,
        ],
        settings: {
          national_id: form.national_id, permanent_address: form.permanent_address,
          job_title: form.job_title, department: form.department,
          employment_type: form.employment_type, line_manager: form.line_manager,
          start_date: form.start_date, institution: form.institution,
          field_of_study: form.field_of_study, graduation_year: form.graduation_year,
          certifications: form.certifications,
          work_history: [
            { company: form.prev_company_1, title: form.prev_title_1, from: form.prev_from_1, to: form.prev_to_1, reason: form.prev_reason_1 },
            { company: form.prev_company_2, title: form.prev_title_2, from: form.prev_from_2, to: form.prev_to_2, reason: form.prev_reason_2 },
          ].filter(w => w.company),
          references: [
            { name: form.ref1_name, company: form.ref1_company, contact: form.ref1_contact },
            { name: form.ref2_name, company: form.ref2_company, contact: form.ref2_contact },
          ].filter(r => r.name),
          blood_group: form.blood_group, medical_notes: form.medical_notes,
          emg_relationship: form.emg_relationship,
        }
      }, { onConflict: 'id' })
      if (profErr) throw new Error(profErr.message)

      await supabase.from('hhf_staff_invites')
        .update({ used: true, used_at: new Date().toISOString() }).eq('token', token)

      const { data: admins } = await supabase
        .from('hhf_profiles').select('id').eq('role', 'admin').eq('status', 'active')
      if (admins?.length) {
        await supabase.from('hhf_notifications').insert(
          admins.map(a => ({
            recipient_id: a.id, type: 'new_user_registered',
            title: 'New Staff Application',
            body: `${form.full_name} has submitted a staff application and is awaiting review.`,
            link: '/admin/users',
          }))
        )
      }
      setStep(7)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Guards ────────────────────────────────────────
  if (invalid) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
        <p className="text-sm text-gray-500">This invite link has expired or already been used. Contact HHF admin for a new one.</p>
      </div>
    </div>
  )
  if (!invite) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-sm text-gray-400">Verifying invite…</p></div>
  if (step === 7) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Application Submitted!</h2>
        <p className="text-sm text-gray-500">Your application has been received. Admin will review and activate your account.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: 'linear-gradient(135deg,#1a5fa8,#2e7d32)' }}>
            <span className="text-white font-bold text-lg">HHF</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Staff Employment Form</h1>
          <p className="text-xs text-gray-400 mt-1">Hossanah Help Foundation · Step {step} of 6</p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-200 rounded-full mb-5 overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${Math.round((step/6)*100)}%` }} />
        </div>

        {/* Step pills */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s.label} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${step===i+1 ? 'bg-blue-600 text-white' : step>i+1 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              <span>{s.emoji}</span><span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <SectionTitle emoji="👤" title="Personal Information" />
              <Field label="Full Name" required><input className={inputCls} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="First and last name" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of Birth" required><input className={inputCls} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></Field>
                <Field label="Gender" required>
                  <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select…</option>
                    {GENDERS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="National ID / Tax Number"><input className={inputCls} value={form.national_id} onChange={e => set('national_id', e.target.value)} placeholder="NIN, BVN, or Tax ID" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone Number" required><input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+234..." /></Field>
                <Field label="Email Address" required><input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.com" /></Field>
              </div>
              <Field label="Current Residential Address" required><textarea className={inputCls} rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="House no., street, city, state" /></Field>
              <Field label="Permanent Address" hint="Leave blank if same as above"><textarea className={inputCls} rows={2} value={form.permanent_address} onChange={e => set('permanent_address', e.target.value)} placeholder="If different from current address" /></Field>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <SectionTitle emoji="💼" title="Role & Employment Details" subtitle="Fill what you know. HR will confirm the rest." />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Job Title / Position"><input className={inputCls} value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder="e.g. Counsellor" /></Field>
                <Field label="Department"><input className={inputCls} value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Outreach" /></Field>
              </div>
              <Field label="Employment Type">
                <div className="flex flex-wrap gap-2 mt-1">
                  {EMP_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => set('employment_type', t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.employment_type===t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Line Manager"><input className={inputCls} value={form.line_manager} onChange={e => set('line_manager', e.target.value)} placeholder="Supervisor name" /></Field>
                <Field label="Proposed Start Date"><input className={inputCls} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <SectionTitle emoji="🎓" title="Educational Background" subtitle="List highest qualification first." />
              <Field label="Highest Level of Education" required>
                <select className={inputCls} value={form.edu_level} onChange={e => set('edu_level', e.target.value)}>
                  <option value="">Select…</option>
                  {EDU_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Institution Name" required><input className={inputCls} value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="University / College name" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Field of Study"><input className={inputCls} value={form.field_of_study} onChange={e => set('field_of_study', e.target.value)} placeholder="e.g. Psychology" /></Field>
                <Field label="Graduation Year"><input className={inputCls} type="number" min="1970" max="2030" value={form.graduation_year} onChange={e => set('graduation_year', e.target.value)} placeholder="2020" /></Field>
              </div>
              <Field label="Professional Certifications / Licenses"><textarea className={inputCls} rows={2} value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="List any relevant certifications…" /></Field>
              <Field label="Upload CV / Resume" required><DropZone inputRef={cvRef} file={cvFile} onFile={setCvFile} accept=".pdf,.doc,.docx" label="Tap to upload CV (PDF or Word)" /></Field>
              <Field label="Additional Certificates (optional)"><DropZone inputRef={extraRef} file={extraFiles.length ? extraFiles : null} onFile={setExtraFiles} accept=".pdf,.jpg,.jpeg,.png" label="Tap to upload certificates" multi /></Field>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-5">
              <SectionTitle emoji="⏳" title="Work Experience & References" subtitle="Most recent first. Skip if not applicable." />
              {[1,2].map(n => (
                <div key={n} className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Position {n}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Company Name"><input className={inputCls} value={form[`prev_company_${n}`]} onChange={e => set(`prev_company_${n}`, e.target.value)} placeholder="Employer" /></Field>
                    <Field label="Job Title"><input className={inputCls} value={form[`prev_title_${n}`]} onChange={e => set(`prev_title_${n}`, e.target.value)} placeholder="Your role" /></Field>
                    <Field label="From"><input className={inputCls} type="month" value={form[`prev_from_${n}`]} onChange={e => set(`prev_from_${n}`, e.target.value)} /></Field>
                    <Field label="To"><input className={inputCls} type="month" value={form[`prev_to_${n}`]} onChange={e => set(`prev_to_${n}`, e.target.value)} /></Field>
                  </div>
                  <Field label="Reason for Leaving"><input className={inputCls} value={form[`prev_reason_${n}`]} onChange={e => set(`prev_reason_${n}`, e.target.value)} placeholder="Optional" /></Field>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Professional References</p>
                {[1,2].map(n => (
                  <div key={n} className="bg-gray-50 rounded-xl p-4 space-y-3 mb-3">
                    <p className="text-xs font-medium text-gray-500">Reference {n}</p>
                    <Field label="Full Name"><input className={inputCls} value={form[`ref${n}_name`]} onChange={e => set(`ref${n}_name`, e.target.value)} placeholder="Referee name" /></Field>
                    <Field label="Company / Organisation"><input className={inputCls} value={form[`ref${n}_company`]} onChange={e => set(`ref${n}_company`, e.target.value)} /></Field>
                    <Field label="Phone / Email"><input className={inputCls} value={form[`ref${n}_contact`]} onChange={e => set(`ref${n}_contact`, e.target.value)} /></Field>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="space-y-4">
              <SectionTitle emoji="🚨" title="Emergency & Medical" />
              <Field label="Emergency Contact Full Name" required><input className={inputCls} value={form.emg_name} onChange={e => set('emg_name', e.target.value)} placeholder="Contact person" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Relationship" required><input className={inputCls} value={form.emg_relationship} onChange={e => set('emg_relationship', e.target.value)} placeholder="e.g. Spouse" /></Field>
                <Field label="Phone Number" required><input className={inputCls} type="tel" value={form.emg_phone} onChange={e => set('emg_phone', e.target.value)} placeholder="+234..." /></Field>
              </div>
              <Field label="Blood Group">
                <select className={inputCls} value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
                  <option value="">Unknown</option>
                  {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Known Medical Conditions / Allergies"><textarea className={inputCls} rows={2} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="Optional — only if relevant to work" /></Field>
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Uploads</p>
                <Field label="Valid Government-Issued ID"><DropZone inputRef={idRef} file={idFile} onFile={setIdFile} accept=".pdf,.jpg,.jpeg,.png" label="Passport, Driver's License or NIN slip" /></Field>
                <Field label="Passport-Sized Photograph"><DropZone inputRef={photoRef} file={photoFile} onFile={setPhotoFile} accept=".jpg,.jpeg,.png" label="Recent passport photo (JPG or PNG)" /></Field>
              </div>
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="space-y-4">
              <SectionTitle emoji="✍️" title="Account & Declaration" />
              <Field label="Create Password" required hint="Min. 8 characters"><input className={inputCls} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 8 characters" /></Field>
              <Field label="Confirm Password" required><input className={inputCls} type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="Repeat password" /></Field>
              {form.password && (
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${form.password.length>=i*3 ? form.password.length>=12 ? 'bg-green-500' : 'bg-amber-400' : 'bg-gray-100'}`} />
                  ))}
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4 mt-2">
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong>Declaration:</strong> I certify that all information provided is accurate, complete, and true to the best of my knowledge. I authorise Hossanah Help Foundation to verify my references and conduct background checks as required.
                </p>
                <label className="flex items-start gap-3 mt-3 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0" />
                  <span className="text-xs text-gray-700">I agree to the declaration statement above.</span>
                </label>
              </div>
            </div>
          )}

          {error && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</div>}

          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button onClick={() => { setStep(s => s-1); setError('') }} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">← Back</button>
            )}
            {step < 6
              ? <button onClick={next} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700">Next →</button>
              : <button onClick={handleSubmit} disabled={saving || !agreed} className="flex-1 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50">{saving ? 'Submitting…' : 'Submit Application'}</button>
            }
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">Single-use invite · Expires 48 hours after issue</p>
      </div>
    </div>
  )
}
