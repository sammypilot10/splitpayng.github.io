// ============================================================
// src/pages/Dashboard.jsx
// Host Command Center — financial overview, pool management,
// member roster with status badges, invite links, remove member.
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/useDashboard'

// ── Status badge config ───────────────────────────────────────
const STATUS = {
  active:     { label: 'Paid',     bg: '#E8F5EF', color: '#0B3D2E', dot: '#00A65A' },
  in_escrow:  { label: 'Escrow',   bg: '#FEF3E2', color: '#C97B1A', dot: '#F5A623' },
  pending:    { label: 'Pending',  bg: '#F5F5F5', color: '#666666', dot: '#BBBBBB' },
  failed:     { label: 'Failed',   bg: '#FEF0F0', color: '#C0392B', dot: '#E74C3C' },
  cancelled:  { label: 'Left',     bg: '#F5F5F5', color: '#999999', dot: '#CCCCCC' },
}

const fmt = (n) => `₦${Number(n).toLocaleString()}`

// ─────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{
      background: accent ? '#0B3D2E' : '#FFFFFF',
      border: '1px solid',
      borderColor: accent ? '#0B3D2E' : '#E2DAD0',
      borderRadius: 16,
      padding: '22px 24px',
      flex: 1,
      minWidth: 0,
      transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.09)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: accent ? 'rgba(255,255,255,0.6)' : '#999' }}>
          {label}
        </span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: accent ? '#fff' : '#111', marginBottom: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: accent ? 'rgba(255,255,255,0.55)' : '#999' }}>{sub}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MEMBER ROW
// ─────────────────────────────────────────────────────────────
function MemberRow({ member, onRemove, removing }) {
  const s   = STATUS[member.payment_status] || STATUS.pending
  const initials = member.profiles.full_name
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid #F5F2EE',
      transition: 'background 0.15s',
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: '#E8F5EF', color: '#0B3D2E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Name + card */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {member.profiles.full_name}
        </div>
        <div style={{ fontSize: 11.5, color: '#BBB' }}>
          {member.paystack_card_last4 ? `•••• ${member.paystack_card_last4}` : 'No card saved'}
        </div>
      </div>

      {/* Status badge */}
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.2px',
        background: s.bg, color: s.color,
        borderRadius: 6, padding: '3px 9px',
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
        {s.label}
      </span>

      {/* Remove */}
      <button
        onClick={() => onRemove(member.id, member.profiles.full_name)}
        disabled={removing === member.id}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: removing === member.id ? '#DDD' : '#CCC',
          fontSize: 16, padding: '2px 6px', borderRadius: 6,
          transition: 'all 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { if (removing !== member.id) e.target.style.color = '#E74C3C' }}
        onMouseLeave={e => { e.target.style.color = removing === member.id ? '#DDD' : '#CCC' }}
        title={`Remove ${member.profiles.full_name}`}
      >
        {removing === member.id ? '…' : '×'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// POOL CARD
// ─────────────────────────────────────────────────────────────
function PoolCard({ pool, onRemoveMember }) {
  const [copied,   setCopied]   = useState(false)
  const [removing, setRemoving] = useState(null)
  const [expanded, setExpanded] = useState(true)

  const paidCount   = pool.memberships.filter(m => ['active', 'in_escrow'].includes(m.payment_status)).length
  const fillPct     = Math.round((paidCount / pool.max_members) * 100)
  const seatsLeft   = pool.max_members - pool.memberships.length
  const collected   = paidCount * pool.split_price

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${pool.id}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRemove = async (membershipId, name) => {
    if (!confirm(`Remove ${name} from this pool?`)) return
    setRemoving(membershipId)
    try {
      // Real Supabase call:
      const { error } = await supabase
        .from('memberships')
        .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', membershipId)
      if (error) throw error
      onRemoveMember(pool.id, membershipId)
    } catch (err) {
      alert('Failed to remove member. Please try again.')
    }
    setRemoving(null)
  }

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2DAD0',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'}
    >
      {/* Pool header */}
      <div style={{ padding: '20px 22px', borderBottom: '1px solid #F5F2EE' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: pool.iconBg, border: '1px solid #E2DAD0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {pool.icon}
            </div>
            <div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: '-0.3px' }}>
                {pool.service_name}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                {pool.is_public ? '🌐 Public pool' : '🔒 Private pool'} · Renews day {pool.renewal_day}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2px',
            background: '#E8F5EF', color: '#0B3D2E', border: '1px solid #C5E0D4',
            borderRadius: 6, padding: '3px 9px',
          }}>
            ACTIVE
          </span>
        </div>

        {/* Financial row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Per seat',   value: fmt(pool.split_price) },
            { label: 'Collected',  value: fmt(collected) },
            { label: 'Seats left', value: `${seatsLeft} of ${pool.max_members}` },
          ].map(i => (
            <div key={i.label}>
              <div style={{ fontSize: 11, color: '#BBB', fontWeight: 500, marginBottom: 2 }}>{i.label}</div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 700, color: '#111' }}>{i.value}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11.5, color: '#999' }}>{paidCount} of {pool.max_members} members paid</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0B3D2E' }}>{fillPct}%</span>
          </div>
          <div style={{ height: 5, background: '#F0EDE8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: fillPct === 100 ? '#00A65A' : '#0B3D2E',
              width: `${fillPct}%`, transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Members section */}
      <div style={{ padding: '0 22px' }}>
        <button
          onClick={() => setExpanded(x => !x)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'none', border: 'none',
            padding: '14px 0', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600, color: '#666',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <span>MEMBERS ({pool.memberships.length})</span>
          <span style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', fontSize: 10 }}>▼</span>
        </button>

        {expanded && (
          <div style={{ paddingBottom: 8 }}>
            {pool.memberships.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                onRemove={handleRemove}
                removing={removing}
              />
            ))}
            {seatsLeft > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 0', color: '#CCC', fontSize: 13,
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px dashed #DDD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>+</div>
                <span style={{ color: '#CCC', fontSize: 12.5 }}>{seatsLeft} open seat{seatsLeft > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action footer */}
      <div style={{
        display: 'flex', gap: 10, padding: '14px 22px',
        borderTop: '1px solid #F5F2EE', background: '#FAFAF8',
      }}>
        <button
          onClick={copyInviteLink}
          style={{
            flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 13, fontWeight: 600,
            color: copied ? '#0B3D2E' : '#444',
            background: copied ? '#E8F5EF' : '#fff',
            border: '1px solid',
            borderColor: copied ? '#C5E0D4' : '#E2DAD0',
            borderRadius: 9, padding: '9px 0',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied!' : '🔗 Copy Invite Link'}
        </button>
        <button style={{
          flex: 1, fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 13, fontWeight: 600, color: '#fff',
          background: '#0B3D2E', border: '1px solid #0B3D2E',
          borderRadius: 9, padding: '9px 0', cursor: 'pointer',
        }}>
          ⚙ Manage Pool
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  // ── Real data from Supabase via useDashboard hook ─────────
  const { pools, stats, loading, error, refetch } = useDashboard()
  const [menuOpen, setMenuOpen] = useState(false)

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Host'

  const handleRemoveMember = (poolId, membershipId) => {
    // Optimistically remove from UI, hook's real-time listener
    // will sync the server state automatically
    refetch()
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const totalMonthly = stats?.totalMonthly || 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F4EFE6; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .dash-card { animation: fadeUp 0.4s ease both; }
        .dash-card:nth-child(1) { animation-delay: 0.05s; }
        .dash-card:nth-child(2) { animation-delay: 0.10s; }
        .dash-card:nth-child(3) { animation-delay: 0.15s; }
        .dash-card:nth-child(4) { animation-delay: 0.20s; }
        @media (max-width: 640px) {
          .stats-row { flex-direction: column !important; }
          .pool-grid { grid-template-columns: 1fr !important; }
          .nav-links-desktop { display: none !important; }
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
          <div style={{
            maxWidth: 1200, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 62,
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: '#0B3D2E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontFamily: "'Bricolage Grotesque',sans-serif",
                fontSize: 15, fontWeight: 800,
              }}>S</div>
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 17, fontWeight: 700, color: '#111' }}>
                SplitPay<span style={{ color: '#0B3D2E' }}>NG</span>
              </span>
            </div>

            {/* Desktop nav */}
            <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              {['Dashboard', 'Marketplace', 'Payouts'].map(n => (
                <a key={n} href="#" style={{ fontSize: 13.5, fontWeight: 500, color: n === 'Dashboard' ? '#0B3D2E' : '#888', textDecoration: 'none' }}>
                  {n === 'Dashboard' ? <strong>{n}</strong> : n}
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
                  borderRadius: 10, padding: '7px 14px',
                  cursor: 'pointer', transition: 'all 0.15s',
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
                  {[
                    { icon: '⚙', label: 'Settings',     action: () => {} },
                    { icon: '💳', label: 'Payout Setup', action: () => navigate('/payout-setup') },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', background: 'none', border: 'none',
                      padding: '11px 16px', fontSize: 13.5, color: '#333',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F9F6F1'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                  <button onClick={handleSignOut} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', background: 'none', border: 'none',
                    borderTop: '1px solid #F0EDE8',
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

        {/* ── Main content ───────────────────────────────────── */}
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 80px' }}>

          {/* Page header */}
          <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#BBB', marginBottom: 4 }}>
                Command Center
              </div>
              <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(24px,3vw,32px)', fontWeight: 800, letterSpacing: '-0.8px', color: '#111' }}>
                Good morning, {firstName} 👋
              </h1>
              <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
                You're earning <strong style={{ color: '#0B3D2E' }}>{fmt(totalMonthly)}</strong> this month across {pools.length} active pool{pools.length !== 1 ? 's' : ''}.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 13.5, fontWeight: 600, color: '#fff',
                background: '#0B3D2E', border: 'none',
                borderRadius: 10, padding: '11px 22px',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = '#1A5C42'; e.target.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.target.style.background = '#0B3D2E'; e.target.style.transform = 'none' }}
            >
              + Create New Pool
            </button>
          </div>

          {/* ── Stats row ─────────────────────────────────────── */}
          <div className="stats-row" style={{ display: 'flex', gap: 14, marginBottom: 36, flexWrap: 'wrap' }}>
            <div className="dash-card" style={{ flex: 1, minWidth: 200 }}>
              <StatCard
                label="Next Payout"
                value={fmt(stats?.nextPayout || 0)}
                sub="Est. this cycle · after platform fee"
                icon="💸"
                accent
              />
            </div>
            <div className="dash-card" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Monthly Total" value={fmt(stats?.totalMonthly || 0)} sub="Across all active members" icon="📈" />
            </div>
            <div className="dash-card" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Pending Collection" value={fmt(stats?.pendingCollections || 0)} sub={`${stats?.pendingCount || 0} members haven't paid yet`} icon="⏳" />
            </div>
            <div className="dash-card" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Active Pools" value={`${pools.length}`} sub={`${stats?.totalMembers || 0} total members`} icon="🏊" />
            </div>
          </div>

          {/* ── Section label ─────────────────────────────────── */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#BBB', marginBottom: 6 }}>
              Your Pools
            </div>
            <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: '#111' }}>
              Active Pool Roster
            </h2>
          </div>

          {/* ── Pool grid ─────────────────────────────────────── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#BBB' }}>Loading your pools…</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#C0392B', fontSize: 14 }}>
              Failed to load pools. <button onClick={refetch} style={{ color: '#0B3D2E', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Try again</button>
            </div>
          ) : pools.length === 0 ? (
            <div style={{
              background: '#fff', border: '1px solid #E2DAD0', borderRadius: 18,
              padding: '60px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🏊</div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>No pools yet</div>
              <p style={{ fontSize: 14, color: '#999', marginBottom: 24 }}>Create your first pool and start splitting subscriptions.</p>
              <button style={{
                fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#fff',
                background: '#0B3D2E', border: 'none', borderRadius: 10, padding: '12px 28px', cursor: 'pointer',
              }}>+ Create Pool</button>
            </div>
          ) : (
            <div
              className="pool-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
                gap: 18,
              }}
            >
              {pools.map((pool, i) => (
                <div key={pool.id} className="dash-card" style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
                  <PoolCard pool={pool} onRemoveMember={handleRemoveMember} />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}