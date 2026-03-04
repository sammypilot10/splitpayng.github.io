// ============================================================
// src/pages/RetryPayment.jsx
// Member lands here when their recurring billing fails.
// They can retry the charge on their saved card, or
// pay fresh with a new card via Paystack checkout.
//
// Accessed via: /retry-payment?membership_id=XXX
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase }    from '../lib/supabase'
import { apiClient }   from '../lib/apiClient'

// ── Tiny info row ─────────────────────────────────────────────
function InfoRow({ label, value, highlight }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid #F0EDE8', fontSize: 13.5,
    }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ fontWeight: highlight ? 700 : 600, color: highlight ? '#0B3D2E' : '#111' }}>
        {value}
      </span>
    </div>
  )
}

export default function RetryPayment() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const membershipId   = searchParams.get('membership_id')

  const [membership,   setMembership]   = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [retrying,     setRetrying]     = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)
  const [method,       setMethod]       = useState('saved') // 'saved' | 'new'

  // ── Fetch membership details on mount ─────────────────────
  useEffect(() => {
    if (!membershipId) {
      navigate('/my-subscriptions', { replace: true })
      return
    }
    fetchMembership()
  }, [membershipId])

  const fetchMembership = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        navigate('/auth', { replace: true })
        return
      }

      const { data, error: fetchErr } = await supabase
        .from('memberships')
        .select(`
          id, payment_status, paystack_card_last4, paystack_auth_code,
          pools (
            id, service_name, split_price, is_public, pool_status,
            profiles!pools_owner_id_fkey ( payout_subaccount_code )
          )
        `)
        .eq('id', membershipId)
        .eq('user_id', session.user.id) // ownership check
        .single()

      if (fetchErr || !data) {
        setError('Membership not found or does not belong to you.')
        setLoading(false)
        return
      }

      if (data.payment_status !== 'failed') {
        // Not a failed membership — redirect
        navigate('/my-subscriptions', { replace: true })
        return
      }

      setMembership(data)

      // Default to new card if no saved card
      if (!data.paystack_auth_code || !data.paystack_card_last4) {
        setMethod('new')
      }
    } catch (err) {
      setError('Failed to load membership details.')
    } finally {
      setLoading(false)
    }
  }

  // ── Retry with saved card ─────────────────────────────────
  const handleRetrySavedCard = async () => {
    setRetrying(true)
    setError('')

    try {
      const res = await apiClient.post('/api/payments/retry-saved-card', {
        membership_id: membershipId,
      })

      if (res.data.success) {
        setSuccess(true)
        setTimeout(() => navigate('/my-subscriptions'), 3000)
      } else {
        setError('Card charge failed. Please use a different payment method.')
        setMethod('new')
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Card charge failed. Please try a new card.'
      setError(msg)
      setMethod('new')
    } finally {
      setRetrying(false)
    }
  }

  // ── Retry with new card — opens Paystack checkout ─────────
  const handlePayWithNewCard = async () => {
    setRetrying(true)
    setError('')

    try {
      const res = await apiClient.post('/api/payments/initialize', {
        membership_id: membershipId,
      })
      // Redirect to Paystack checkout
      window.location.href = res.data.authorization_url
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start payment. Please try again.')
      setRetrying(false)
    }
  }

  // ─────────────────────────────────────────────────────────
  const pool           = membership?.pools
  const hasSavedCard   = !!membership?.paystack_auth_code && !!membership?.paystack_card_last4
  const splitPrice     = pool?.split_price ? `₦${Number(pool.split_price).toLocaleString()}` : '—'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4EFE6; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .card { animation: fadeUp 0.35s ease both; }
        input:focus { border-color: #0B3D2E !important; box-shadow: 0 0 0 3px rgba(11,61,46,0.1); }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#F4EFE6', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── Navbar ───────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(244,239,230,0.94)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #E2DAD0', padding: '0 24px',
        }}>
          <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
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
            <button onClick={() => navigate('/my-subscriptions')} style={{
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              color: '#666', background: 'none', border: '1px solid #E2DAD0',
              borderRadius: 9, padding: '7px 16px', cursor: 'pointer',
            }}>
              ← My Subscriptions
            </button>
          </div>
        </nav>

        <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>

          {/* ── Loading ──────────────────────────────────────── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#AAA', fontSize: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '3px solid #E2DAD0', borderTopColor: '#0B3D2E',
                margin: '0 auto 16px', animation: 'spin 0.8s linear infinite',
              }} />
              Loading your subscription…
            </div>
          )}

          {/* ── Error (no membership found) ───────────────────── */}
          {!loading && error && !membership && (
            <div className="card" style={{
              background: '#fff', border: '1px solid #E2DAD0',
              borderRadius: 20, padding: '48px 36px', textAlign: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 10 }}>
                Something went wrong
              </h2>
              <p style={{ fontSize: 13.5, color: '#888', marginBottom: 28 }}>{error}</p>
              <button
                onClick={() => navigate('/my-subscriptions')}
                style={{
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  color: '#fff', background: '#0B3D2E', border: 'none',
                  borderRadius: 11, padding: '12px 28px', cursor: 'pointer',
                }}
              >
                Back to Subscriptions
              </button>
            </div>
          )}

          {/* ── Success ───────────────────────────────────────── */}
          {success && (
            <div className="card" style={{
              background: '#fff', border: '1px solid #E2DAD0',
              borderRadius: 20, padding: '52px 36px', textAlign: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: '#E8F5EF', border: '2px solid #C5E0D4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, margin: '0 auto 24px',
              }}>
                ✅
              </div>
              <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 10 }}>
                Payment successful!
              </h2>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 8 }}>
                Your <strong style={{ color: '#111' }}>{pool?.service_name}</strong> subscription is now active again.
              </p>
              <p style={{ fontSize: 13, color: '#AAA' }}>Redirecting you to your subscriptions…</p>
            </div>
          )}

          {/* ── Main retry UI ─────────────────────────────────── */}
          {!loading && membership && !success && (
            <div className="card">

              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#FEF0F0', border: '1px solid #FACACC',
                  borderRadius: 8, padding: '4px 12px', marginBottom: 14,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E74C3C' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B' }}>Payment Failed</span>
                </div>
                <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(22px,3vw,28px)', fontWeight: 800, letterSpacing: '-0.7px', color: '#111', marginBottom: 8 }}>
                  Renew your subscription
                </h1>
                <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6 }}>
                  Your last payment for <strong style={{ color: '#111' }}>{pool?.service_name}</strong> didn't go through. Complete payment below to restore your access.
                </p>
              </div>

              {/* Subscription summary */}
              <div style={{
                background: '#F9F6F1', border: '1px solid #E2DAD0',
                borderRadius: 16, padding: '20px 22px', marginBottom: 28,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#BBB', marginBottom: 14 }}>
                  Subscription Details
                </div>
                <InfoRow label="Service"       value={pool?.service_name || '—'} />
                <InfoRow label="Amount due"    value={splitPrice} highlight />
                <InfoRow label="Pool type"     value={pool?.is_public ? '🌐 Public' : '🔒 Private'} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, fontSize: 13.5 }}>
                  <span style={{ color: '#888' }}>Status</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 700,
                    background: '#FEF0F0', color: '#C0392B',
                    borderRadius: 6, padding: '3px 10px',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#E74C3C' }} />
                    Payment Failed
                  </span>
                </div>
              </div>

              {/* Payment method selector */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 12 }}>
                  Choose payment method
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Saved card option */}
                  {hasSavedCard && (
                    <div
                      onClick={() => setMethod('saved')}
                      style={{
                        border: `2px solid ${method === 'saved' ? '#0B3D2E' : '#E2DAD0'}`,
                        borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
                        background: method === 'saved' ? '#F0F8F5' : '#FAFAFA',
                        transition: 'all 0.18s',
                        display: 'flex', alignItems: 'center', gap: 14,
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: method === 'saved' ? '#0B3D2E' : '#E8E8E8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, transition: 'all 0.18s', flexShrink: 0,
                      }}>
                        💳
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>
                          Saved card ending in {membership.paystack_card_last4}
                        </div>
                        <div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>
                          Charge your previously used card instantly
                        </div>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: `2px solid ${method === 'saved' ? '#0B3D2E' : '#DDD'}`,
                        background: method === 'saved' ? '#0B3D2E' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {method === 'saved' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    </div>
                  )}

                  {/* New card option */}
                  <div
                    onClick={() => setMethod('new')}
                    style={{
                      border: `2px solid ${method === 'new' ? '#0B3D2E' : '#E2DAD0'}`,
                      borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
                      background: method === 'new' ? '#F0F8F5' : '#FAFAFA',
                      transition: 'all 0.18s',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: method === 'new' ? '#0B3D2E' : '#E8E8E8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, transition: 'all 0.18s', flexShrink: 0,
                    }}>
                      🏧
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>
                        Pay with a different card
                      </div>
                      <div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>
                        Opens Paystack checkout — card, bank transfer, or USSD
                      </div>
                    </div>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${method === 'new' ? '#0B3D2E' : '#DDD'}`,
                      background: method === 'new' ? '#0B3D2E' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {method === 'new' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div style={{
                  background: '#FEF0F0', border: '1px solid #FACACC',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                  fontSize: 13.5, color: '#C0392B', fontWeight: 500,
                }}>
                  ⚠ {error}
                </div>
              )}

              {/* CTA button */}
              <button
                onClick={method === 'saved' ? handleRetrySavedCard : handlePayWithNewCard}
                disabled={retrying}
                style={{
                  width: '100%', fontFamily: 'inherit',
                  fontSize: 15, fontWeight: 700,
                  color: retrying ? '#AAA' : '#fff',
                  background: retrying ? '#E8E8E8' : '#0B3D2E',
                  border: 'none', borderRadius: 13,
                  padding: '15px', cursor: retrying ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: 14,
                }}
                onMouseEnter={e => { if (!retrying) { e.currentTarget.style.background = '#1A5C42'; e.currentTarget.style.transform = 'translateY(-1px)' }}}
                onMouseLeave={e => { e.currentTarget.style.background = retrying ? '#E8E8E8' : '#0B3D2E'; e.currentTarget.style.transform = 'none' }}
              >
                {retrying
                  ? 'Processing…'
                  : method === 'saved'
                    ? `Pay ${splitPrice} with saved card`
                    : `Pay ${splitPrice} with new card`}
              </button>

              <button
                onClick={() => navigate('/my-subscriptions')}
                style={{
                  width: '100%', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500,
                  color: '#AAA', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '8px',
                }}
              >
                Cancel — I'll do this later
              </button>

              {/* Security note */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                justifyContent: 'center', marginTop: 20,
              }}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <span style={{ fontSize: 12, color: '#BBB' }}>
                  Payments are processed securely by Paystack
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}