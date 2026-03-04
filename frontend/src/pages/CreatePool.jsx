// ============================================================
// src/pages/CreatePool.jsx
// Host creates a new subscription pool.
// Password is sent to the backend which encrypts it before
// storing — the raw password never touches the database.
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../lib/apiClient'

const CATEGORIES = [
  'AI & Dev Tools',
  'Entertainment',
  'Creative & Work',
  'Music',
  'Gaming & Storage',
]

const RENEWAL_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

// ── Step indicator ────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Pool Details', 'Pricing', 'Credentials']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
      {steps.map((label, i) => {
        const num    = i + 1
        const active = current === num
        const done   = current > num
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: done ? '#0B3D2E' : active ? '#0B3D2E' : '#F0EDE8',
                border: `2px solid ${done || active ? '#0B3D2E' : '#E2DAD0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 14 : 13,
                fontWeight: 700,
                color: done || active ? '#fff' : '#BBB',
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : num}
              </div>
              <span style={{
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? '#111' : done ? '#0B3D2E' : '#BBB',
                transition: 'color 0.3s',
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 16px',
                background: done ? '#0B3D2E' : '#E2DAD0',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────
function Field({ label, hint, error, required, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label style={{
        display: 'block',
        fontSize: 13, fontWeight: 600, color: '#333',
        marginBottom: 6,
      }}>
        {label}
        {required && <span style={{ color: '#E74C3C', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <div style={{ fontSize: 12, color: '#AAA', marginTop: 5 }}>{hint}</div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#E74C3C', marginTop: 5, fontWeight: 500 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}

// ── Input style ───────────────────────────────────────────────
const inputStyle = (hasError) => ({
  width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 14,
  color: '#111',
  background: '#FAFAFA',
  border: `1.5px solid ${hasError ? '#E74C3C' : '#E2DAD0'}`,
  borderRadius: 10,
  padding: '11px 14px',
  outline: 'none',
  transition: 'all 0.2s',
  boxSizing: 'border-box',
})

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function CreatePool() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [step,       setStep]       = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [form, setForm] = useState({
    service_name:        '',
    category:            '',
    description:         '',
    is_public:           true,
    total_cost:          '',
    split_price:         '',
    max_members:         '',
    renewal_day:         '1',
    service_login_email: '',
    service_password:    '',
  })

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    // Clear error for this field on change
    setFieldErrors(prev => ({ ...prev, [key]: '' }))
  }

  // Auto-calculate split price when total_cost or max_members change
  const handleTotalOrMax = (key, val) => {
    const updated = { ...form, [key]: val }
    if (updated.total_cost && updated.max_members) {
      const suggested = (Number(updated.total_cost) / Number(updated.max_members)).toFixed(0)
      updated.split_price = suggested
    }
    setForm(updated)
    setFieldErrors(prev => ({ ...prev, [key]: '', split_price: '' }))
  }

  // ── Step validation ───────────────────────────────────────
  const validateStep = (s) => {
    const errs = {}
    if (s === 1) {
      if (!form.service_name.trim()) errs.service_name = 'Service name is required.'
      if (!form.category)            errs.category     = 'Please select a category.'
    }
    if (s === 2) {
      if (!form.total_cost || Number(form.total_cost) <= 0)
        errs.total_cost  = 'Enter the full subscription cost.'
      if (!form.split_price || Number(form.split_price) <= 0)
        errs.split_price = 'Enter the price per seat.'
      if (Number(form.split_price) > Number(form.total_cost))
        errs.split_price = 'Split price cannot exceed the total cost.'
      if (!form.max_members || Number(form.max_members) < 2 || Number(form.max_members) > 10)
        errs.max_members = 'Max members must be between 2 and 10.'
    }
    if (s === 3) {
      if (!form.service_login_email.trim())
        errs.service_login_email = 'Login email is required.'
      if (!form.service_password.trim())
        errs.service_password    = 'Password is required.'
    }
    return errs
  }

  const nextStep = () => {
    const errs = validateStep(step)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setStep(s => s + 1)
    setServerError('')
  }

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validateStep(3)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setSubmitting(true)
    setServerError('')

    try {
      const res = await apiClient.post('/api/pools/create', {
        service_name:        form.service_name.trim(),
        category:            form.category,
        description:         form.description.trim() || null,
        total_cost:          Number(form.total_cost),
        split_price:         Number(form.split_price),
        max_members:         Number(form.max_members),
        is_public:           form.is_public,
        renewal_day:         Number(form.renewal_day),
        service_login_email: form.service_login_email.trim(),
        service_password:    form.service_password.trim(),
      })

      // Success — go to dashboard
      navigate('/dashboard', {
        state: { newPool: res.data.pool, message: 'Pool created successfully!' },
      })

    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'NO_PAYOUT_ACCOUNT') {
        setServerError('You need to set up your payout bank account first.')
      } else if (data?.errors) {
        setServerError(data.errors.join(' '))
      } else {
        setServerError(data?.error || 'Failed to create pool. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────
  const savingsPercent = form.total_cost && form.split_price && form.max_members
    ? Math.round(((form.total_cost / form.max_members - Number(form.split_price)) / (form.total_cost / form.max_members)) * 100)
    : 0

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Host'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4EFE6; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .form-card { animation: fadeUp 0.35s ease both; }
        input:focus, select:focus, textarea:focus {
          border-color: #0B3D2E !important;
          box-shadow: 0 0 0 3px rgba(11,61,46,0.1);
          background: #fff !important;
        }
        .toggle-pill { cursor: pointer; user-select: none; }
        @media(max-width:640px){
          .create-layout { flex-direction: column !important; }
          .preview-panel { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#F4EFE6', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── Navbar ─────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(244,239,230,0.94)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #E2DAD0',
          padding: '0 24px',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: '#0B3D2E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 15, fontWeight: 800,
              }}>S</div>
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 17, fontWeight: 700, color: '#111' }}>
                SplitPay<span style={{ color: '#0B3D2E' }}>NG</span>
              </span>
            </div>
            <button onClick={() => navigate('/dashboard')} style={{
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              color: '#666', background: 'none',
              border: '1px solid #E2DAD0', borderRadius: 9,
              padding: '7px 16px', cursor: 'pointer',
            }}>
              ← Back to Dashboard
            </button>
          </div>
        </nav>

        {/* ── Main ───────────────────────────────────────── */}
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>

          {/* Page header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#BBB', marginBottom: 4 }}>
              Host
            </div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, letterSpacing: '-0.8px', color: '#111', marginBottom: 6 }}>
              Create a new pool
            </h1>
            <p style={{ fontSize: 14, color: '#888' }}>
              Share your subscription and earn back your costs every month.
            </p>
          </div>

          <div className="create-layout" style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

            {/* ── Form panel ─────────────────────────────── */}
            <div className="form-card" style={{
              flex: 1,
              background: '#fff',
              border: '1px solid #E2DAD0',
              borderRadius: 20,
              padding: '36px 36px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            }}>

              <Steps current={step} />

              {/* ── STEP 1: Pool Details ─────────────────── */}
              {step === 1 && (
                <div>
                  <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 24 }}>
                    What are you sharing?
                  </h2>

                  <Field label="Service name" required error={fieldErrors.service_name}
                    hint="E.g. Netflix Premium, ChatGPT Plus, Spotify Family">
                    <input
                      style={inputStyle(!!fieldErrors.service_name)}
                      type="text"
                      placeholder="Netflix Premium"
                      value={form.service_name}
                      onChange={e => set('service_name', e.target.value)}
                      maxLength={80}
                    />
                  </Field>

                  <Field label="Category" required error={fieldErrors.category}>
                    <select
                      style={{ ...inputStyle(!!fieldErrors.category), cursor: 'pointer' }}
                      value={form.category}
                      onChange={e => set('category', e.target.value)}
                    >
                      <option value="">Select a category…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>

                  <Field label="Description" hint="Optional — help members understand what's included">
                    <textarea
                      style={{ ...inputStyle(false), resize: 'vertical', minHeight: 80 }}
                      placeholder="All 4 screens, UHD quality, Nigeria region…"
                      value={form.description}
                      onChange={e => set('description', e.target.value)}
                      maxLength={300}
                    />
                  </Field>

                  <Field label="Pool visibility" hint={form.is_public
                    ? 'Anyone on the marketplace can find and join this pool.'
                    : 'Only people you share the invite link with can join.'}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[
                        { val: true,  icon: '🌐', label: 'Public',  sub: 'Open to everyone' },
                        { val: false, icon: '🔒', label: 'Private', sub: 'Invite only' },
                      ].map(opt => (
                        <div
                          key={String(opt.val)}
                          className="toggle-pill"
                          onClick={() => set('is_public', opt.val)}
                          style={{
                            flex: 1, border: `2px solid ${form.is_public === opt.val ? '#0B3D2E' : '#E2DAD0'}`,
                            borderRadius: 12, padding: '12px 16px',
                            background: form.is_public === opt.val ? '#F0F8F5' : '#FAFAFA',
                            transition: 'all 0.18s',
                          }}
                        >
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{opt.label}</div>
                          <div style={{ fontSize: 11.5, color: '#999', marginTop: 2 }}>{opt.sub}</div>
                        </div>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              {/* ── STEP 2: Pricing ──────────────────────── */}
              {step === 2 && (
                <div>
                  <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 24 }}>
                    Set your pricing
                  </h2>

                  <div style={{ display: 'flex', gap: 14 }}>
                    <Field label="Total subscription cost (₦)" required error={fieldErrors.total_cost}
                      hint="What you pay the service each month">
                      <input
                        style={inputStyle(!!fieldErrors.total_cost)}
                        type="number" min="0" placeholder="25600"
                        value={form.total_cost}
                        onChange={e => handleTotalOrMax('total_cost', e.target.value)}
                      />
                    </Field>

                    <Field label="Max members" required error={fieldErrors.max_members}
                      hint="2–10 people including you">
                      <input
                        style={inputStyle(!!fieldErrors.max_members)}
                        type="number" min="2" max="10" placeholder="4"
                        value={form.max_members}
                        onChange={e => handleTotalOrMax('max_members', e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="Price per seat (₦/month)" required error={fieldErrors.split_price}
                    hint="Auto-calculated — you can adjust this">
                    <input
                      style={inputStyle(!!fieldErrors.split_price)}
                      type="number" min="0" placeholder="6400"
                      value={form.split_price}
                      onChange={e => set('split_price', e.target.value)}
                    />
                  </Field>

                  {/* Savings preview */}
                  {savingsPercent > 0 && (
                    <div style={{
                      background: '#E8F5EF', border: '1px solid #C5E0D4',
                      borderRadius: 12, padding: '14px 18px',
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22,
                    }}>
                      <span style={{ fontSize: 22 }}>💰</span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0B3D2E' }}>
                          Members save {savingsPercent}% vs buying alone
                        </div>
                        <div style={{ fontSize: 12, color: '#5A8A72', marginTop: 2 }}>
                          ₦{Number(form.split_price).toLocaleString()} vs ₦{(Number(form.total_cost) / Number(form.max_members)).toLocaleString()} full price
                        </div>
                      </div>
                    </div>
                  )}

                  <Field label="Billing renewal day" required
                    hint="The day of the month members are auto-charged">
                    <select
                      style={{ ...inputStyle(false), cursor: 'pointer' }}
                      value={form.renewal_day}
                      onChange={e => set('renewal_day', e.target.value)}
                    >
                      {RENEWAL_DAYS.map(d => (
                        <option key={d} value={d}>
                          {d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of every month
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              {/* ── STEP 3: Credentials ──────────────────── */}
              {step === 3 && (
                <div>
                  <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 8 }}>
                    Add login credentials
                  </h2>
                  <p style={{ fontSize: 13.5, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
                    These are shared with members after they pay. They're encrypted and stored securely — not even our team can read them.
                  </p>

                  {/* Security callout */}
                  <div style={{
                    background: '#F0F8F5', border: '1px solid #C5E0D4',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 24,
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: 18, marginTop: 1 }}>🔐</span>
                    <div style={{ fontSize: 12.5, color: '#3A7A5A', lineHeight: 1.6 }}>
                      <strong>End-to-end encrypted.</strong> Credentials are encrypted with AES-256-GCM on our server before storage. Only you and confirmed members can access them.
                    </div>
                  </div>

                  <Field label="Login email / username" required error={fieldErrors.service_login_email}
                    hint="The email address used to sign in to the service">
                    <input
                      style={inputStyle(!!fieldErrors.service_login_email)}
                      type="text"
                      placeholder="yournetflix@gmail.com"
                      value={form.service_login_email}
                      onChange={e => set('service_login_email', e.target.value)}
                      autoComplete="off"
                    />
                  </Field>

                  <Field label="Password" required error={fieldErrors.service_password}
                    hint="This will be encrypted before saving">
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{ ...inputStyle(!!fieldErrors.service_password), paddingRight: 48 }}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={form.service_password}
                        onChange={e => set('service_password', e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(x => !x)}
                        style={{
                          position: 'absolute', right: 14, top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none', border: 'none',
                          cursor: 'pointer', fontSize: 16, color: '#AAA',
                        }}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </Field>

                  {/* Final summary */}
                  <div style={{
                    background: '#F9F6F1', border: '1px solid #E2DAD0',
                    borderRadius: 14, padding: '18px 20px', marginTop: 4,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#BBB', marginBottom: 14 }}>
                      Pool Summary
                    </div>
                    {[
                      { label: 'Service',    value: form.service_name || '—' },
                      { label: 'Type',       value: form.is_public ? '🌐 Public' : '🔒 Private' },
                      { label: 'Per seat',   value: form.split_price ? `₦${Number(form.split_price).toLocaleString()}/mo` : '—' },
                      { label: 'Max seats',  value: form.max_members || '—' },
                      { label: 'Renews',     value: form.renewal_day ? `Day ${form.renewal_day} monthly` : '—' },
                    ].map(row => (
                      <div key={row.label} style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 13.5, paddingBottom: 10, marginBottom: 10,
                        borderBottom: '1px solid #EDE8DF',
                      }}>
                        <span style={{ color: '#888' }}>{row.label}</span>
                        <span style={{ fontWeight: 600, color: '#111' }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                      <span style={{ color: '#888' }}>Your earnings</span>
                      <span style={{ fontWeight: 700, color: '#0B3D2E' }}>
                        {form.split_price && form.max_members
                          ? `₦${(Number(form.split_price) * (Number(form.max_members) - 1) * 0.95).toLocaleString()}/mo`
                          : '—'}
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#AAA', marginLeft: 4 }}>after fee</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Server error ──────────────────────────── */}
              {serverError && (
                <div style={{
                  marginTop: 20, background: '#FEF0F0', border: '1px solid #FACACC',
                  borderRadius: 10, padding: '12px 16px',
                  fontSize: 13.5, color: '#C0392B', fontWeight: 500,
                }}>
                  ⚠ {serverError}
                  {serverError.includes('payout bank account') && (
                    <button
                      onClick={() => navigate('/payout-setup')}
                      style={{
                        display: 'block', marginTop: 8,
                        fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                        color: '#0B3D2E', background: 'none', border: 'none',
                        cursor: 'pointer', textDecoration: 'underline',
                      }}
                    >
                      Set up payout account →
                    </button>
                  )}
                </div>
              )}

              {/* ── Navigation buttons ────────────────────── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
                {step > 1 ? (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    style={{
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
                      color: '#666', background: 'none',
                      border: '1.5px solid #E2DAD0', borderRadius: 11,
                      padding: '12px 24px', cursor: 'pointer',
                    }}
                  >
                    ← Back
                  </button>
                ) : <div />}

                {step < 3 ? (
                  <button
                    onClick={nextStep}
                    style={{
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                      color: '#fff', background: '#0B3D2E', border: 'none',
                      borderRadius: 11, padding: '12px 32px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.target.style.background = '#1A5C42'; e.target.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.target.style.background = '#0B3D2E'; e.target.style.transform = 'none' }}
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                      color: submitting ? '#AAA' : '#fff',
                      background: submitting ? '#E8E8E8' : '#0B3D2E',
                      border: 'none', borderRadius: 11,
                      padding: '12px 32px', cursor: submitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {submitting ? 'Creating pool…' : '🚀 Launch Pool'}
                  </button>
                )}
              </div>
            </div>

            {/* ── Preview panel ──────────────────────────── */}
            <div className="preview-panel" style={{ width: 300, flexShrink: 0 }}>
              <div style={{
                background: '#fff', border: '1px solid #E2DAD0',
                borderRadius: 20, padding: '20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                position: 'sticky', top: 80,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#BBB', marginBottom: 16 }}>
                  Live Preview
                </div>

                {/* Preview card */}
                <div style={{ border: '1px solid #E2DAD0', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: '#F0F8F5', border: '1px solid #E2DAD0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      📦
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                        {form.service_name || 'Your Service'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#999' }}>
                        by {profile?.full_name || firstName}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: '#F0EDE8', margin: '0 0 14px' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 24, fontWeight: 800, color: '#111' }}>
                        ₦{form.split_price ? Number(form.split_price).toLocaleString() : '0'}
                      </span>
                      <span style={{ fontSize: 12, color: '#999', marginLeft: 3 }}>/month</span>
                    </div>
                    {savingsPercent > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#0B3D2E',
                        background: '#E8F5EF', borderRadius: 5, padding: '2px 8px',
                      }}>
                        Save {savingsPercent}%
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{ fontSize: 11.5, color: '#999', marginBottom: 6 }}>
                    0 of {form.max_members || '?'} seats filled
                  </div>
                  <div style={{ height: 4, background: '#F0EDE8', borderRadius: 2, marginBottom: 16 }}>
                    <div style={{ width: '0%', height: '100%', background: '#0B3D2E', borderRadius: 2 }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: '#999' }}>
                      Renews day <strong style={{ color: '#555' }}>{form.renewal_day}</strong>
                    </span>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: '#0B3D2E',
                      background: '#E8F5EF', border: '1px solid #C5E0D4',
                      borderRadius: 8, padding: '6px 14px',
                    }}>
                      Join Pool
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#BBB', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    Tips
                  </div>
                  {[
                    'Use the exact service name so members can find it easily.',
                    'Public pools fill 3× faster than private pools.',
                    'Set renewal day to match when your subscription renews.',
                  ].map((tip, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{ color: '#0B3D2E', fontSize: 12, marginTop: 1 }}>•</span>
                      <span style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  )
}