// ============================================================
// src/pages/PayoutSetup.jsx
// Host enters their bank details to receive payouts.
// Flow:
//   1. Fetch list of Nigerian banks from Paystack via backend
//   2. Host enters account number + selects bank
//   3. We call /api/subaccounts/resolve to verify the account
//      and show the account name before they confirm
//   4. On confirm, POST /api/subaccounts/create creates the
//      Paystack subaccount and saves details to their profile
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { useAuth }             from '../context/AuthContext'
import { apiClient }           from '../lib/apiClient'

// ── Field wrapper ─────────────────────────────────────────────
function Field({ label, hint, error, required, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: '#E74C3C', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && !error && <div style={{ fontSize: 12, color: '#AAA', marginTop: 5 }}>{hint}</div>}
      {error && <div style={{ fontSize: 12, color: '#E74C3C', marginTop: 5, fontWeight: 500 }}>⚠ {error}</div>}
    </div>
  )
}

const inputStyle = (hasError) => ({
  width: '100%',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 14, color: '#111',
  background: '#FAFAFA',
  border: `1.5px solid ${hasError ? '#E74C3C' : '#E2DAD0'}`,
  borderRadius: 10, padding: '11px 14px',
  outline: 'none', transition: 'all 0.2s',
  boxSizing: 'border-box',
})

// ── Steps ─────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Bank Details', 'Verify Account', 'Confirm']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
      {steps.map((label, i) => {
        const num    = i + 1
        const active = current === num
        const done   = current > num
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: done ? '#0B3D2E' : active ? '#0B3D2E' : '#F0EDE8',
                border: `2px solid ${done || active ? '#0B3D2E' : '#E2DAD0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: done ? 13 : 12, fontWeight: 700,
                color: done || active ? '#fff' : '#BBB',
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : num}
              </div>
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#111' : done ? '#0B3D2E' : '#BBB' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '0 14px', background: done ? '#0B3D2E' : '#E2DAD0', transition: 'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function PayoutSetup() {
  const navigate = useNavigate()
  const { profile, user, fetchProfile } = useAuth()

  const [step,          setStep]          = useState(1)
  const [banks,         setBanks]         = useState([])
  const [loadingBanks,  setLoadingBanks]  = useState(true)
  const [bankSearch,    setBankSearch]    = useState('')
  const [showBankList,  setShowBankList]  = useState(false)

  const [accountNumber, setAccountNumber] = useState('')
  const [selectedBank,  setSelectedBank]  = useState(null) // { code, name }
  const [resolvedName,  setResolvedName]  = useState('')

  const [resolving,   setResolving]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [success,     setSuccess]     = useState(false)

  // Already has payout account
  const hasAccount = !!profile?.payout_subaccount_code

  // ── Fetch bank list on mount ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Check via backend (avoids Supabase RLS/session issues)
      try {
        const meRes = await apiClient.get('/api/subaccounts/me')
        if (meRes.data?.hasAccount) {
          setStep(3)
          setLoadingBanks(false)
          return
        }
      } catch (e) {
        // Not set up yet, continue to bank form
      }
      // Load bank list
      try {
        const res = await apiClient.get('/api/subaccounts/banks')
        const seen = new Set()
        const unique = (res.data.banks || []).filter(b => {
          if (seen.has(b.code)) return false
          seen.add(b.code)
          return true
        })
        setBanks(unique)
      } catch (err) {
        setServerError('Could not load bank list. Please refresh the page.')
      } finally {
        setLoadingBanks(false)
      }
    }
    init()
  }, [])

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  )

  // ── Step 1: Resolve account number ────────────────────────
  const handleResolve = async () => {
    const errs = {}
    if (!accountNumber.trim() || accountNumber.length !== 10)
      errs.accountNumber = 'Enter a valid 10-digit account number.'
    if (!selectedBank)
      errs.bank = 'Please select your bank.'
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setResolving(true)
    setServerError('')

    try {
      const res = await apiClient.post('/api/subaccounts/resolve', {
        account_number: accountNumber.trim(),
        bank_code:      selectedBank.code,
      })
      setResolvedName(res.data.account_name)
      setStep(2)
    } catch (err) {
      setServerError(
        err.response?.data?.error ||
        'Could not verify this account. Check your account number and bank, then try again.'
      )
    } finally {
      setResolving(false)
    }
  }

  // ── Step 2: Confirm and create subaccount ─────────────────
  const handleConfirm = async () => {
    setSubmitting(true)
    setServerError('')

    try {
      await apiClient.post('/api/subaccounts/create', {
        bank_code:      selectedBank.code,
        account_number: accountNumber.trim(),
        account_name:   resolvedName,
      })
      if (user?.id) fetchProfile(user.id)
      setSuccess(true)
      setStep(3)
    } catch (err) {
      const data = err.response?.data
      if (data?.subaccount_code || err.response?.status === 409) {
        // Already exists — treat as success
        if (user?.id) fetchProfile(user.id)
        setSuccess(true)
        setStep(3)
      } else {
        setServerError(data?.error || 'Failed to set up payout account. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4EFE6; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .setup-card { animation: fadeUp 0.35s ease both; }
        input:focus, select:focus { border-color: #0B3D2E !important; box-shadow: 0 0 0 3px rgba(11,61,46,0.1); background: #fff !important; }
        .bank-item:hover { background: #F4EFE6 !important; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#F4EFE6', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── Navbar ───────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(244,239,230,0.94)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #E2DAD0', padding: '0 24px',
        }}>
          <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
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
              color: '#666', background: 'none', border: '1px solid #E2DAD0',
              borderRadius: 9, padding: '7px 16px', cursor: 'pointer',
            }}>
              ← Back to Dashboard
            </button>
          </div>
        </nav>

        {/* ── Main ─────────────────────────────────────────── */}
        <main style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px 80px' }}>

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#BBB', marginBottom: 4 }}>
              Host Settings
            </div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(22px,3vw,28px)', fontWeight: 800, letterSpacing: '-0.8px', color: '#111', marginBottom: 6 }}>
              Payout Bank Account
            </h1>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
              Set up where your earnings get sent. SplitPayNG uses Paystack to transfer funds directly to your Nigerian bank account after each billing cycle.
            </p>
          </div>

          {/* Already set up banner */}
          {hasAccount && step !== 3 && (
            <div style={{
              background: '#E8F5EF', border: '1px solid #C5E0D4',
              borderRadius: 14, padding: '16px 20px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0B3D2E' }}>Payout account already set up</div>
                <div style={{ fontSize: 12.5, color: '#5A8A72', marginTop: 2 }}>
                  You can update your bank account below. Your new account will be used for all future payouts.
                </div>
              </div>
            </div>
          )}

          <div className="setup-card" style={{
            background: '#fff', border: '1px solid #E2DAD0',
            borderRadius: 20, padding: '36px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          }}>

            <Steps current={step} />

            {/* ── STEP 1: Bank Details ─────────────────────── */}
            {step === 1 && (
              <div>
                <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 24 }}>
                  Enter your bank details
                </h2>

                {/* How it works callout */}
                <div style={{
                  background: '#F9F6F1', border: '1px solid #E2DAD0',
                  borderRadius: 12, padding: '14px 18px', marginBottom: 28,
                  display: 'flex', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>💸</span>
                  <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                    After a member confirms access, <strong>80%</strong> of their payment is transferred to this account automatically. The 20% platform fee covers escrow protection, fraud prevention, and platform costs.
                  </div>
                </div>

                {/* Account number */}
                <Field label="Account number" required error={fieldErrors.accountNumber}
                  hint="Your 10-digit NUBAN account number">
                  <input
                    style={inputStyle(!!fieldErrors.accountNumber)}
                    type="text"
                    inputMode="numeric"
                    placeholder="0123456789"
                    value={accountNumber}
                    maxLength={10}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      setAccountNumber(val)
                      setFieldErrors(prev => ({ ...prev, accountNumber: '' }))
                      // Clear resolved name if account changes
                      if (resolvedName) setResolvedName('')
                    }}
                  />
                </Field>

                {/* Bank selector */}
                <Field label="Bank" required error={fieldErrors.bank}>
                  <div style={{ position: 'relative' }}>
                    <div
                      onClick={() => setShowBankList(x => !x)}
                      style={{
                        ...inputStyle(!!fieldErrors.bank),
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: selectedBank ? '#fff' : '#FAFAFA',
                      }}
                    >
                      <span style={{ color: selectedBank ? '#111' : '#BBB' }}>
                        {selectedBank ? selectedBank.name : loadingBanks ? 'Loading banks…' : 'Select your bank…'}
                      </span>
                      <span style={{ color: '#BBB', fontSize: 11 }}>▼</span>
                    </div>

                    {showBankList && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: '#fff', border: '1.5px solid #E2DAD0',
                        borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        zIndex: 100, overflow: 'hidden',
                        maxHeight: 280,
                      }}>
                        {/* Search input */}
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE8' }}>
                          <input
                            autoFocus
                            style={{
                              ...inputStyle(false),
                              padding: '8px 12px', fontSize: 13,
                              background: '#F9F6F1',
                            }}
                            placeholder="Search bank…"
                            value={bankSearch}
                            onChange={e => setBankSearch(e.target.value)}
                          />
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 200 }}>
                          {filteredBanks.length === 0 ? (
                            <div style={{ padding: '16px', fontSize: 13, color: '#AAA', textAlign: 'center' }}>
                              No banks found
                            </div>
                          ) : (
                            filteredBanks.map(bank => (
                              <div
                                key={bank.code}
                                className="bank-item"
                                onClick={() => {
                                  setSelectedBank({ code: bank.code, name: bank.name })
                                  setShowBankList(false)
                                  setBankSearch('')
                                  setFieldErrors(prev => ({ ...prev, bank: '' }))
                                }}
                                style={{
                                  padding: '11px 16px', cursor: 'pointer',
                                  fontSize: 13.5, color: '#111',
                                  background: selectedBank?.code === bank.code ? '#F0F8F5' : 'transparent',
                                  fontWeight: selectedBank?.code === bank.code ? 600 : 400,
                                  transition: 'background 0.15s',
                                }}
                              >
                                {bank.name}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Field>

                {serverError && (
                  <div style={{
                    background: '#FEF0F0', border: '1px solid #FACACC',
                    borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                    fontSize: 13.5, color: '#C0392B', fontWeight: 500,
                  }}>
                    ⚠ {serverError}
                  </div>
                )}

                <button
                  onClick={handleResolve}
                  disabled={resolving || loadingBanks}
                  style={{
                    width: '100%', fontFamily: 'inherit',
                    fontSize: 14, fontWeight: 600,
                    color: resolving ? '#AAA' : '#fff',
                    background: resolving ? '#E8E8E8' : '#0B3D2E',
                    border: 'none', borderRadius: 11,
                    padding: '13px', cursor: resolving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {resolving ? 'Verifying account…' : 'Verify Account →'}
                </button>
              </div>
            )}

            {/* ── STEP 2: Confirm ──────────────────────────── */}
            {step === 2 && (
              <div>
                <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 8 }}>
                  Confirm your account
                </h2>
                <p style={{ fontSize: 13.5, color: '#888', marginBottom: 28, lineHeight: 1.6 }}>
                  Please confirm this is the correct account before we save it. All future payouts will go here.
                </p>

                {/* Account confirmation card */}
                <div style={{
                  background: '#F0F8F5', border: '2px solid #C5E0D4',
                  borderRadius: 16, padding: '24px', marginBottom: 28,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: '#0B3D2E', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      🏦
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 17, fontWeight: 800, color: '#111' }}>
                        {resolvedName}
                      </div>
                      <div style={{ fontSize: 13, color: '#5A8A72', marginTop: 2 }}>
                        Account verified ✓
                      </div>
                    </div>
                  </div>

                  {[
                    { label: 'Bank',           value: selectedBank?.name },
                    { label: 'Account number', value: accountNumber },
                    { label: 'Account name',   value: resolvedName },
                    { label: 'Platform fee',   value: '20% per transaction' },
                    { label: 'Payout timing',  value: 'After member confirms access' },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '9px 0', borderBottom: '1px solid rgba(11,61,46,0.1)',
                      fontSize: 13.5,
                    }}>
                      <span style={{ color: '#5A8A72' }}>{row.label}</span>
                      <span style={{ fontWeight: 600, color: '#111' }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {serverError && (
                  <div style={{
                    background: '#FEF0F0', border: '1px solid #FACACC',
                    borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                    fontSize: 13.5, color: '#C0392B', fontWeight: 500,
                  }}>
                    ⚠ {serverError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => { setStep(1); setServerError('') }}
                    style={{
                      flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
                      color: '#666', background: 'none',
                      border: '1.5px solid #E2DAD0', borderRadius: 11,
                      padding: '12px', cursor: 'pointer',
                    }}
                  >
                    ← Change Details
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    style={{
                      flex: 2, fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                      color: submitting ? '#AAA' : '#fff',
                      background: submitting ? '#E8E8E8' : '#0B3D2E',
                      border: 'none', borderRadius: 11,
                      padding: '12px', cursor: submitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {submitting ? 'Saving…' : '✓ Confirm & Save Account'}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Success ──────────────────────────── */}
            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: '#E8F5EF', border: '2px solid #C5E0D4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, margin: '0 auto 24px',
                }}>
                  🎉
                </div>
                <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 10 }}>
                  Payout account set up!
                </h2>
                <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 8 }}>
                  <strong style={{ color: '#111' }}>{resolvedName}</strong> at <strong style={{ color: '#111' }}>{selectedBank?.name}</strong> is now your payout account.
                </p>
                <p style={{ fontSize: 13.5, color: '#888', lineHeight: 1.7, marginBottom: 36 }}>
                  Every time a member confirms access, <strong style={{ color: '#0B3D2E' }}>80% of their payment</strong> will be automatically transferred to this account — usually within minutes.
                </p>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate('/create-pool')}
                    style={{
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                      color: '#fff', background: '#0B3D2E',
                      border: 'none', borderRadius: 11, padding: '12px 28px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.target.style.background = '#1A5C42' }}
                    onMouseLeave={e => { e.target.style.background = '#0B3D2E' }}
                  >
                    🚀 Create Your First Pool
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                      fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
                      color: '#666', background: 'none',
                      border: '1.5px solid #E2DAD0', borderRadius: 11,
                      padding: '12px 24px', cursor: 'pointer',
                    }}
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Security note */}
          {step < 3 && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              marginTop: 20, padding: '0 4px',
            }}>
              <span style={{ fontSize: 16, marginTop: 1 }}>🔒</span>
              <p style={{ fontSize: 12.5, color: '#AAA', lineHeight: 1.6 }}>
                Your bank details are securely handled by <strong>Paystack</strong> — Nigeria's leading payment processor. SplitPayNG does not store your full account credentials.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}