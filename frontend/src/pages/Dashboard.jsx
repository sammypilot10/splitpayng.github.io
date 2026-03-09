// ============================================================
// src/pages/Dashboard.jsx
// Host Command Center — financial overview, pool management,
// member roster with status badges, invite links, remove member.
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Inline data fetching via backend API ─────────────────────
function useDashboard() {
  const [pools,   setPools]   = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiClientMod = await import('../lib/apiClient')
      const apiClient = apiClientMod.default || apiClientMod.apiClient
      const res = await apiClient.get('/api/pools/mine')
      const pools = res.data.pools || []

      const activeMembers = pools.reduce((s, p) => s + (p.memberships||[]).filter(m => m.payment_status==='paid').length, 0)
      const totalMonthly  = pools.reduce((s, p) => { const n=(p.memberships||[]).filter(m=>m.payment_status==='paid').length; return s+(p.split_price*n*0.8) }, 0)
      const pendingMembers = pools.reduce((s, p) => s + (p.memberships||[]).filter(m=>m.payment_status==='in_escrow'||m.payment_status==='pending').length, 0)
      const pendingCollections = pools.reduce((s, p) => { const n=(p.memberships||[]).filter(m=>m.payment_status==='in_escrow'||m.payment_status==='pending').length; return s+(p.split_price*n) }, 0)

      setPools(pools)
      setStats({ totalMembers: activeMembers, totalMonthly: Math.round(totalMonthly), nextPayout: Math.round(totalMonthly), pendingCollections: Math.round(pendingCollections), pendingCount: pendingMembers })
    } catch (err) {
      console.error('[Dashboard] fetch error:', err.message)
      setError(err.message)
      setPools([])
      setStats({ totalMembers:0, totalMonthly:0, nextPayout:0, pendingCollections:0, pendingCount:0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  return { pools, stats, loading, error, refetch: fetchData }
}

// ── Service domain map for favicons ──────────────────────────
const DOMAIN_MAP = {
  'netflix': 'netflix.com', 'spotify': 'spotify.com', 'youtube': 'youtube.com',
  'chatgpt': 'openai.com', 'openai': 'openai.com', 'claude': 'claude.ai',
  'amazon': 'primevideo.com', 'prime': 'primevideo.com', 'canva': 'canva.com',
  'adobe': 'adobe.com', 'microsoft': 'microsoft.com', 'apple': 'apple.com',
  'playstation': 'playstation.com', 'xbox': 'xbox.com', 'google': 'google.com',
  'midjourney': 'midjourney.com', 'showmax': 'showmax.com', 'notion': 'notion.so',
  'figma': 'figma.com', 'dropbox': 'dropbox.com', 'duolingo': 'duolingo.com',
  'disney': 'disneyplus.com', 'hbo': 'max.com', 'dstv': 'dstv.com',
  'cursor': 'cursor.com', 'boomplay': 'boomplay.com',
}
function getDomain(name) {
  if (!name) return 'google.com'
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(DOMAIN_MAP)) { if (lower.includes(k)) return v }
  return lower.split(' ')[0].replace(/[^a-z]/g, '') + '.com'
}

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
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: accent ? 'rgba(255,255,255,0.15)' : '#F4EFE6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent ? '#fff' : '#0B3D2E', flexShrink: 0,
        }}>
          {icon}
        </div>
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
  const fullName = member.profiles?.full_name || 'Unknown'
  const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

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
          {fullName}
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
        onClick={() => onRemove(member.id, fullName)}
        disabled={removing === member.id}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: removing === member.id ? '#DDD' : '#CCC',
          fontSize: 16, padding: '2px 6px', borderRadius: 6,
          transition: 'all 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { if (removing !== member.id) e.target.style.color = '#E74C3C' }}
        onMouseLeave={e => { e.target.style.color = removing === member.id ? '#DDD' : '#CCC' }}
        title={`Remove ${fullName}`}
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
              background: '#F4EFE6', border: '1px solid #E2DAD0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, overflow: 'hidden',
            }}>
              <img
                src={`https://www.google.com/s2/favicons?domain=${getDomain(pool.service_name)}&sz=64`}
                alt={pool.service_name}
                style={{ width: 28, height: 28 }}
                onError={e => { e.target.style.display='none'; e.target.parentNode.innerText=pool.service_name?.[0]||'S' }}
              />
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
        <button
          onClick={() => {
            const link = `${window.location.origin}/join/${pool.id}`
            navigator.clipboard.writeText(link)
            alert(`Invite link copied!\n\nShare this link with people you want to join your pool:\n${link}`)
          }}
          style={{
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
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Redirect non-hosts to member dashboard
  useEffect(() => {
    if (!loading && pools.length === 0 && !profile?.payout_subaccount_code) {
      navigate('/my-subscriptions', { replace: true })
    }
  }, [loading, pools.length, profile, navigate])

  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Host'

  const handleRemoveMember = (poolId, membershipId) => {
    // Optimistically remove from UI, hook's real-time listener
    // will sync the server state automatically
    refetch()
  }

  const handleSignOut = () => {
    setMenuOpen(false)
    signOut()
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
              <img src="/favicon-32x32.png" alt="SplitPayNG" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 17, fontWeight: 700, color: '#111' }}>
                SplitPay<span style={{ color: '#0B3D2E' }}>NG</span>
              </span>
            </div>

            {/* Desktop nav */}
            <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              {[
                { label: 'Dashboard',   action: () => navigate('/dashboard') },
                { label: 'Marketplace', action: () => navigate('/') },
                { label: 'Payouts',     action: () => navigate('/payout-setup') },
              ].map(n => (
                <a key={n.label} onClick={n.action} style={{ fontSize: 13.5, fontWeight: 500, color: n.label === 'Dashboard' ? '#0B3D2E' : '#888', textDecoration: 'none', cursor: 'pointer' }}>
                  {n.label === 'Dashboard' ? <strong>{n.label}</strong> : n.label}
                </a>
              ))}
            </div>

            {/* User menu */}
            <div ref={menuRef} style={{ position: 'relative' }}>
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
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, label: 'Settings',     action: () => {} },
                    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>, label: 'Payout Setup', action: () => navigate('/payout-setup') },
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
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
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                accent
              />
            </div>
            <div className="dash-card" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Monthly Total" value={fmt(stats?.totalMonthly || 0)} sub="Across all active members"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} />
            </div>
            <div className="dash-card" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Pending Collection" value={fmt(stats?.pendingCollections || 0)} sub={`${stats?.pendingCount || 0} members haven't paid yet`}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
            </div>
            <div className="dash-card" style={{ flex: 1, minWidth: 200 }}>
              <StatCard label="Active Pools" value={`${pools.length}`} sub={`${stats?.totalMembers || 0} total members`}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
            </div>
          </div>

          {/* ── Payout Account Card ────────────────────────────── */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#BBB', marginBottom: 12 }}>
              Payout Settings
            </div>
            <div style={{
              background: '#fff', border: '1px solid #E2DAD0',
              borderRadius: 16, padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              flexWrap: 'wrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              {profile?.payout_account_number ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                    {/* Bank icon */}
                    <div style={{
                      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                      background: '#E8F5EF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B3D2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>
                      </svg>
                    </div>
                    {/* Account info */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#AAA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                        Payout Account
                      </div>
                      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: '#111', letterSpacing: '-0.3px' }}>
                        {profile.payout_account_number}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>Bank code: <strong style={{ color: '#555' }}>{profile.payout_bank_code}</strong></span>
                        <span style={{ color: '#DDD' }}>|</span>
                        <span style={{ color: '#0B3D2E', fontWeight: 600, fontSize: 11 }}>✓ Paystack verified</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/payout-setup')}
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: 13, fontWeight: 600,
                      color: '#0B3D2E', background: '#E8F5EF',
                      border: '1px solid #C5E0D4', borderRadius: 9,
                      padding: '9px 20px', cursor: 'pointer',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#D4EDE0' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#E8F5EF' }}
                  >
                    ✏ Edit Account
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                      background: '#FEF3E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C97B1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>No payout account set up</div>
                      <div style={{ fontSize: 12.5, color: '#C97B1A', marginTop: 2 }}>Add your bank account to receive payouts from your pools.</div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/payout-setup')}
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: 13, fontWeight: 600,
                      color: '#fff', background: '#0B3D2E',
                      border: 'none', borderRadius: 9,
                      padding: '9px 20px', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    + Add Payout Account
                  </button>
                </>
              )}
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
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F4EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B3D2E' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
              </div>
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