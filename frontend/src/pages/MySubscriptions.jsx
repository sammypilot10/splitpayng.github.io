// ============================================================
// src/pages/MySubscriptions.jsx
// Member's personal dashboard — shows all their active pools,
// billing history, and the 48-hour escrow confirm/dispute card.
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMemberDashboard } from '../hooks/useMemberDashboard'
import EscrowActions from '../components/EscrowActions'

const fmt = (n) => `₦${Number(n).toLocaleString()}`

const STATUS = {
  active:    { label: 'Active',   bg: '#E8F5EF', color: '#0B3D2E', dot: '#00A65A' },
  in_escrow: { label: 'Escrow',   bg: '#FEF3E2', color: '#C97B1A', dot: '#F5A623' },
  pending:   { label: 'Pending',  bg: '#F5F5F5', color: '#666666', dot: '#BBBBBB' },
  failed:    { label: 'Failed',   bg: '#FEF0F0', color: '#C0392B', dot: '#E74C3C' },
  cancelled: { label: 'Cancelled',bg: '#F5F5F5', color: '#999999', dot: '#CCCCCC' },
}

// ── Service icon from Simple Icons CDN ───────────────────────
const SERVICE_SLUGS = {
  'netflix':     { slug: 'netflix',         color: 'E50914' },
  'spotify':     { slug: 'spotify',         color: '1DB954' },
  'chatgpt':     { slug: 'openai',          color: '10A37F' },
  'claude':      { slug: 'anthropic',       color: 'D97757' },
  'youtube':     { slug: 'youtube',         color: 'FF0000' },
  'canva':       { slug: 'canva',           color: '00C4CC' },
  'adobe':       { slug: 'adobe',           color: 'FF0000' },
  'microsoft':   { slug: 'microsoftoffice', color: 'D83B01' },
  'spotify':     { slug: 'spotify',         color: '1DB954' },
  'apple music': { slug: 'applemusic',      color: 'FA243C' },
  'playstation': { slug: 'playstation',     color: '003DA5' },
  'xbox':        { slug: 'xbox',            color: '107C10' },
  'google':      { slug: 'google',          color: '4285F4' },
  'amazon':      { slug: 'amazonprime',     color: '00A8E8' },
  'showmax':     { slug: 'showmax',         color: 'E82929' },
  'cursor':      { slug: 'cursor',          color: '000000' },
  'midjourney':  { slug: 'midjourney',      color: '000000' },
}

function ServiceIcon({ serviceName }) {
  const [failed, setFailed] = useState(false)
  const key = Object.keys(SERVICE_SLUGS).find(k =>
    serviceName?.toLowerCase().includes(k)
  )
  const icon = key ? SERVICE_SLUGS[key] : null

  if (failed || !icon) {
    return (
      <span style={{ fontSize: 20 }}>
        {serviceName?.[0] || '?'}
      </span>
    )
  }

  return (
    <img
      src={`https://cdn.simpleicons.org/${icon.slug}/${icon.color}`}
      alt={serviceName}
      width={24}
      height={24}
      onError={() => setFailed(true)}
      style={{ display: 'block', width: 24, height: 24, objectFit: 'contain' }}
    />
  )
}

// ── Single subscription card ──────────────────────────────────
function SubscriptionCard({ membership }) {
  const pool   = membership.pools
  const status = STATUS[membership.payment_status] || STATUS.pending
  const daysUntilBilling = membership.next_billing_date
    ? Math.max(0, Math.round(
        (new Date(membership.next_billing_date) - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : null

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2DAD0',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s, transform 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Card header */}
      <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Service icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: '#F9F6F1', border: '1px solid #E2DAD0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ServiceIcon serviceName={pool?.service_name} />
          </div>
          <div>
            <div style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 15, fontWeight: 700, color: '#111', letterSpacing: '-0.3px',
            }}>
              {pool?.service_name || 'Unknown Service'}
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              {pool?.is_public ? '🌐 Public pool' : '🔒 Private pool'} · Renews day {pool?.renewal_day}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700,
          background: status.bg, color: status.color,
          borderRadius: 7, padding: '4px 10px', flexShrink: 0,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: status.dot }} />
          {status.label}
        </span>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 0,
        borderTop: '1px solid #F5F2EE',
        borderBottom: '1px solid #F5F2EE',
      }}>
        {[
          { label: 'Monthly cost',   value: fmt(pool?.split_price || 0) },
          { label: 'Next billing',   value: daysUntilBilling !== null ? `${daysUntilBilling}d` : '—' },
          { label: 'Card',           value: membership.paystack_card_last4 ? `•••• ${membership.paystack_card_last4}` : 'No card' },
        ].map((item, i) => (
          <div key={item.label} style={{
            flex: 1, padding: '14px 18px', textAlign: 'center',
            borderRight: i < 2 ? '1px solid #F5F2EE' : 'none',
          }}>
            <div style={{ fontSize: 11, color: '#BBB', fontWeight: 500, marginBottom: 4 }}>{item.label}</div>
            <div style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 15, fontWeight: 700, color: '#111',
            }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Host info footer */}
      <div style={{ padding: '12px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: '#E8F5EF', color: '#0B3D2E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
          }}>
            {pool?.profiles?.full_name?.[0]?.toUpperCase() || 'H'}
          </div>
          <span style={{ fontSize: 12, color: '#888' }}>
            Hosted by <strong style={{ color: '#555' }}>{pool?.profiles?.full_name || 'Host'}</strong>
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#CCC' }}>
          Joined {new Date(membership.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function MySubscriptions() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [tab, setTab] = useState('active') // 'active' | 'escrow' | 'history'

  // ── Real data — memberships + escrow items ────────────────
  const { memberships, escrowItems, loading, error, refetch } = useMemberDashboard()

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Member'

  const activeSubs   = memberships.filter(m => m.payment_status === 'active')
  const historySubs  = memberships.filter(m => ['failed', 'cancelled'].includes(m.payment_status))
  const totalMonthly = activeSubs.reduce((sum, m) => sum + parseFloat(m.pools?.split_price || 0), 0)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4EFE6; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .sub-card { animation: fadeUp 0.35s ease both; }
        .sub-card:nth-child(1){animation-delay:0.05s}
        .sub-card:nth-child(2){animation-delay:0.10s}
        .sub-card:nth-child(3){animation-delay:0.15s}
        .sub-card:nth-child(4){animation-delay:0.20s}
        .sub-card:nth-child(5){animation-delay:0.25s}
        @media(max-width:640px){
          .page-header { flex-direction: column !important; align-items: flex-start !important; }
          .summary-row { flex-direction: column !important; }
          .nav-links-desk { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#F4EFE6', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── Navbar ─────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(244,239,230,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #E2DAD0',
          padding: '0 24px',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
            {/* Logo */}
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

            {/* Nav links */}
            <div className="nav-links-desk" style={{ display: 'flex', gap: 28 }}>
              {[
                { label: 'Marketplace',       path: '/' },
                { label: 'My Subscriptions',  path: '/my-subscriptions' },
                { label: 'Host Dashboard',     path: '/dashboard' },
              ].map(link => (
                <a key={link.label} href={link.path} style={{
                  fontSize: 13.5, fontWeight: link.path === '/my-subscriptions' ? 700 : 500,
                  color: link.path === '/my-subscriptions' ? '#0B3D2E' : '#888',
                  textDecoration: 'none',
                }}>
                  {link.label}
                </a>
              ))}
            </div>

            {/* User menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(x => !x)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: '#fff', border: '1px solid #E2DAD0',
                  borderRadius: 10, padding: '7px 14px', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 7, background: '#0B3D2E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>
                  {firstName[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>{firstName}</span>
                <span style={{ fontSize: 10, color: '#BBB' }}>▼</span>
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: '#fff', border: '1px solid #E2DAD0',
                  borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  minWidth: 180, overflow: 'hidden', zIndex: 200,
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EDE8' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#111' }}>{profile?.full_name || firstName}</div>
                    <div style={{ fontSize: 11.5, color: '#BBB', marginTop: 2 }}>{user?.email}</div>
                  </div>
                  <button onClick={handleSignOut} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', background: 'none', border: 'none',
                    padding: '11px 16px', fontSize: 13.5, color: '#C0392B',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}>
                    ↩ Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* ── Main ───────────────────────────────────────────── */}
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px 80px' }}>

          {/* Page header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#BBB', marginBottom: 4 }}>
                Member View
              </div>
              <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, letterSpacing: '-0.8px', color: '#111' }}>
                My Subscriptions
              </h1>
              <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
                You're spending <strong style={{ color: '#0B3D2E' }}>{fmt(totalMonthly)}</strong>/month across {activeSubs.length} active pool{activeSubs.length !== 1 ? 's' : ''}.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 13.5, fontWeight: 600, color: '#fff',
                background: '#0B3D2E', border: 'none',
                borderRadius: 10, padding: '11px 22px',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              + Join New Pool
            </button>
          </div>

          {/* ── Escrow alert banner ───────────────────────────── */}
          {escrowItems.length > 0 && (
            <div style={{
              background: '#FFFBF0', border: '1px solid #F0D5A0',
              borderRadius: 14, padding: '14px 20px', marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 20 }}>⏳</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111' }}>
                  You have {escrowItems.length} subscription{escrowItems.length > 1 ? 's' : ''} awaiting your confirmation
                </div>
                <div style={{ fontSize: 12.5, color: '#C97B1A', marginTop: 2 }}>
                  Test the login credentials and confirm or report within 48 hours to protect your payment.
                </div>
              </div>
            </div>
          )}

          {/* ── Tabs ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 4, background: '#EDE8DF', borderRadius: 11, padding: 4, width: 'fit-content', marginBottom: 28 }}>
            {[
              { key: 'active',  label: `Active (${activeSubs.length})` },
              { key: 'escrow',  label: `Escrow (${escrowItems.length})` },
              { key: 'history', label: `History (${historySubs.length})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 13, fontWeight: 600,
                  background: tab === t.key ? '#fff' : 'transparent',
                  color: tab === t.key ? '#111' : '#888',
                  border: 'none', borderRadius: 8,
                  padding: '8px 18px', cursor: 'pointer',
                  boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.18s',
                  position: 'relative',
                }}
              >
                {t.label}
                {t.key === 'escrow' && escrowItems.length > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#F5A623',
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* ── Loading / Error ───────────────────────────────── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#BBB', fontSize: 14 }}>
              Loading your subscriptions…
            </div>
          )}

          {error && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 14, color: '#C0392B', marginBottom: 12 }}>Failed to load subscriptions.</div>
              <button onClick={refetch} style={{
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                color: '#0B3D2E', background: '#E8F5EF',
                border: '1px solid #C5E0D4', borderRadius: 8,
                padding: '9px 20px', cursor: 'pointer',
              }}>Try again</button>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* ── ACTIVE TAB ──────────────────────────────── */}
              {tab === 'active' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))', gap: 16 }}>
                  {activeSubs.length === 0 ? (
                    <div style={{
                      gridColumn: '1/-1', textAlign: 'center', padding: '60px 24px',
                      background: '#fff', border: '1px solid #E2DAD0', borderRadius: 18,
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>🏊</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 8 }}>
                        No active subscriptions
                      </div>
                      <p style={{ fontSize: 13.5, color: '#999', marginBottom: 24 }}>
                        Browse the marketplace to join a pool.
                      </p>
                      <button onClick={() => navigate('/')} style={{
                        fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
                        color: '#fff', background: '#0B3D2E', border: 'none',
                        borderRadius: 10, padding: '11px 24px', cursor: 'pointer',
                      }}>Browse Marketplace →</button>
                    </div>
                  ) : (
                    activeSubs.map(m => (
                      <div key={m.id} className="sub-card">
                        <SubscriptionCard membership={m} />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── ESCROW TAB ──────────────────────────────── */}
              {tab === 'escrow' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {escrowItems.length === 0 ? (
                    <div style={{
                      textAlign: 'center', padding: '60px 24px',
                      background: '#fff', border: '1px solid #E2DAD0', borderRadius: 18,
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 6 }}>
                        No pending confirmations
                      </div>
                      <p style={{ fontSize: 13.5, color: '#999' }}>All your payments are confirmed.</p>
                    </div>
                  ) : (
                    // ── EscrowActions for each in_escrow membership ──
                    escrowItems.map(m => (
                      <div key={m.id} className="sub-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Show the pool info above the action card */}
                        <SubscriptionCard membership={m} />
                        {/* The confirm / dispute action card */}
                        <EscrowActions membership={m} onResolved={refetch} />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── HISTORY TAB ─────────────────────────────── */}
              {tab === 'history' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))', gap: 16 }}>
                  {historySubs.length === 0 ? (
                    <div style={{
                      gridColumn: '1/-1', textAlign: 'center', padding: '60px 24px',
                      background: '#fff', border: '1px solid #E2DAD0', borderRadius: 18,
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 6 }}>
                        No history yet
                      </div>
                      <p style={{ fontSize: 13.5, color: '#999' }}>Cancelled or failed subscriptions will appear here.</p>
                    </div>
                  ) : (
                    historySubs.map(m => (
                      <div key={m.id} className="sub-card">
                        <SubscriptionCard membership={m} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}