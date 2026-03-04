// ============================================================
// src/pages/AdminDisputes.jsx
// Admin-only page to review and resolve disputed transactions.
// Accessible only when VITE_ADMIN_KEY is set in frontend .env
//
// Shows:
//   - All disputed transactions with member + host details
//   - Failed transfers that need manual retry
//   - Resolve buttons: Refund member OR Release to host
//   - Retry button for failed payouts
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                       from 'react-router-dom'
import { apiClient }                         from '../lib/apiClient'

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY

// ── Status badge ──────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    disputed:      { bg: '#FEF3E2', color: '#C97B1A', dot: '#F5A623', label: 'Disputed'  },
    failed:        { bg: '#FEF0F0', color: '#C0392B', dot: '#E74C3C', label: 'Failed'    },
    pending:       { bg: '#F5F5F5', color: '#666',    dot: '#BBB',    label: 'Pending'   },
    released:      { bg: '#E8F5EF', color: '#0B3D2E', dot: '#00A65A', label: 'Released'  },
    refunded:      { bg: '#F0F4FF', color: '#2C5282', dot: '#4299E1', label: 'Refunded'  },
  }
  const s = map[status] || map.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
      borderRadius: 6, padding: '3px 10px',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  )
}

// ── Dispute card ──────────────────────────────────────────────
function DisputeCard({ txn, onAction, actionLoading }) {
  const [adminNote, setAdminNote] = useState('')
  const [expanded,  setExpanded]  = useState(false)

  const membership = txn.memberships
  const pool       = membership?.pools
  const member     = membership?.profiles
  const host       = pool?.profiles

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #F0D5A0',
      borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    }}>
      {/* Card header */}
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #F5F2EE' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Badge status="disputed" />
              <span style={{ fontSize: 12, color: '#BBB' }}>
                {new Date(txn.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 16, fontWeight: 800, color: '#111' }}>
              {pool?.service_name || 'Unknown Service'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 22, fontWeight: 800, color: '#111' }}>
              {fmt(txn.amount)}
            </div>
            <div style={{ fontSize: 11.5, color: '#AAA' }}>Transaction amount</div>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div style={{ display: 'flex', borderBottom: '1px solid #F5F2EE' }}>
        {[
          { role: 'Member (Reporter)',  name: member?.full_name,  email: member?.email,  icon: '👤' },
          { role: 'Host (Accused)',     name: host?.full_name,    email: host?.email,    icon: '🏠' },
        ].map((party, i) => (
          <div key={party.role} style={{
            flex: 1, padding: '14px 22px',
            borderRight: i === 0 ? '1px solid #F5F2EE' : 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#BBB', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
              {party.role}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: i === 0 ? '#FEF3E2' : '#E8F5EF',
                color: i === 0 ? '#C97B1A' : '#0B3D2E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {party.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{party.name || '—'}</div>
                <div style={{ fontSize: 11.5, color: '#AAA' }}>{party.email || '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dispute reason */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid #F5F2EE', background: '#FFFBF5' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C97B1A', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
          Member's Complaint
        </div>
        <div style={{ fontSize: 13.5, color: '#555', lineHeight: 1.6 }}>
          {txn.notes?.replace('Member raised dispute: ', '').replace(/^"|"$/g, '') || 'No reason provided.'}
        </div>
      </div>

      {/* Transaction details — expandable */}
      <div style={{ padding: '10px 22px', borderBottom: '1px solid #F5F2EE' }}>
        <button
          onClick={() => setExpanded(x => !x)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#888', fontFamily: 'inherit', fontWeight: 500 }}
        >
          {expanded ? '▲ Hide' : '▼ Show'} transaction details
        </button>
        {expanded && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {[
              { label: 'Transaction ID',  value: txn.id },
              { label: 'Amount',          value: fmt(txn.amount) },
              { label: 'Platform fee',    value: fmt(txn.platform_fee) },
              { label: 'Host receives',   value: fmt(txn.amount - txn.platform_fee) },
              { label: 'Pool',            value: pool?.service_name },
              { label: 'Disputed on',     value: new Date(txn.created_at).toLocaleString('en-NG') },
            ].map(row => (
              <div key={row.label} style={{ fontSize: 12.5 }}>
                <span style={{ color: '#AAA' }}>{row.label}: </span>
                <span style={{ color: '#333', fontWeight: 600, wordBreak: 'break-all' }}>{row.value || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin note + action buttons */}
      <div style={{ padding: '18px 22px' }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
            Admin note (optional — saved with the transaction)
          </label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            placeholder="e.g. Verified with host — credentials were changed. Refunding member."
            style={{
              width: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 13, color: '#111', background: '#FAFAFA',
              border: '1.5px solid #E2DAD0', borderRadius: 10,
              padding: '10px 14px', resize: 'vertical', minHeight: 72,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Refund member */}
          <button
            onClick={() => onAction('refund', txn.id, adminNote)}
            disabled={!!actionLoading}
            style={{
              flex: 1, minWidth: 160,
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
              color: actionLoading === `refund-${txn.id}` ? '#AAA' : '#C0392B',
              background: actionLoading === `refund-${txn.id}` ? '#F5F5F5' : '#FEF0F0',
              border: '1.5px solid #FACACC', borderRadius: 10,
              padding: '11px 20px', cursor: actionLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!actionLoading) { e.currentTarget.style.background = '#FCDADA'; e.currentTarget.style.borderColor = '#E74C3C' } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FEF0F0'; e.currentTarget.style.borderColor = '#FACACC' }}
          >
            {actionLoading === `refund-${txn.id}` ? 'Processing…' : '💸 Refund Member'}
          </button>

          {/* Release to host */}
          <button
            onClick={() => onAction('release', txn.id, adminNote)}
            disabled={!!actionLoading}
            style={{
              flex: 1, minWidth: 160,
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
              color: actionLoading === `release-${txn.id}` ? '#AAA' : '#0B3D2E',
              background: actionLoading === `release-${txn.id}` ? '#F5F5F5' : '#E8F5EF',
              border: '1.5px solid #C5E0D4', borderRadius: 10,
              padding: '11px 20px', cursor: actionLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!actionLoading) { e.currentTarget.style.background = '#C5E0D4'; e.currentTarget.style.borderColor = '#0B3D2E' } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#E8F5EF'; e.currentTarget.style.borderColor = '#C5E0D4' }}
          >
            {actionLoading === `release-${txn.id}` ? 'Processing…' : '✓ Release to Host'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Failed transfer card ───────────────────────────────────────
function FailedTransferCard({ txn, onRetry, retryLoading }) {
  const pool = txn.memberships?.pools
  const host = pool?.profiles

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #FACACC',
      borderRadius: 16, padding: '20px 22px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Badge status="failed" />
            <span style={{ fontSize: 12, color: '#BBB' }}>
              {new Date(txn.updated_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 15, fontWeight: 800, color: '#111' }}>
            {pool?.service_name || 'Unknown Service'}
          </div>
          <div style={{ fontSize: 12.5, color: '#888', marginTop: 2 }}>
            Host: {host?.full_name || '—'} · {host?.email || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 800, color: '#111' }}>
            {fmt(txn.amount - txn.platform_fee)}
          </div>
          <div style={{ fontSize: 11.5, color: '#AAA' }}>Host payout amount</div>
        </div>
      </div>

      {/* Failure reason */}
      <div style={{
        background: '#FEF0F0', borderRadius: 10, padding: '10px 14px',
        fontSize: 13, color: '#C0392B', marginBottom: 16,
      }}>
        <strong>Failure reason:</strong> {txn.transfer_failure_reason || 'No reason recorded.'}
      </div>

      {/* Bank details */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Bank',           value: host?.payout_bank_code    || 'Not set' },
          { label: 'Account number', value: host?.payout_account_number || 'Not set' },
          { label: 'Transfer ref',   value: txn.transfer_reference    || '—' },
        ].map(row => (
          <div key={row.label} style={{ fontSize: 12.5 }}>
            <span style={{ color: '#AAA' }}>{row.label}: </span>
            <span style={{ color: '#333', fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onRetry(txn.id)}
        disabled={!!retryLoading}
        style={{
          fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
          color: retryLoading === txn.id ? '#AAA' : '#fff',
          background: retryLoading === txn.id ? '#E8E8E8' : '#0B3D2E',
          border: 'none', borderRadius: 10,
          padding: '11px 24px', cursor: retryLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {retryLoading === txn.id ? 'Retrying…' : '🔄 Retry Transfer'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AdminDisputes() {
  const navigate = useNavigate()

  const [tab,           setTab]           = useState('disputes')
  const [disputes,      setDisputes]      = useState([])
  const [failedTxns,    setFailedTxns]    = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [retryLoading,  setRetryLoading]  = useState(null)
  const [toasts,        setToasts]        = useState([])

  // ── Guard: redirect if no admin key configured ─────────────
  useEffect(() => {
    if (!ADMIN_KEY) {
      navigate('/', { replace: true })
    }
  }, [])

  // ── Admin API helper ───────────────────────────────────────
  const adminRequest = useCallback((method, url, data) => {
    return apiClient({
      method, url, data,
      headers: { 'X-Admin-Key': ADMIN_KEY },
    })
  }, [])

  // ── Toast helper ───────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ── Fetch disputes ─────────────────────────────────────────
  const fetchDisputes = useCallback(async () => {
    try {
      const res = await adminRequest('GET', '/api/escrow/disputes')
      setDisputes(res.data.disputes || [])
    } catch (err) {
      setError('Failed to load disputes. Check your admin key.')
    }
  }, [adminRequest])

  // ── Fetch failed transfers ─────────────────────────────────
  const fetchFailedTransfers = useCallback(async () => {
    try {
      const res = await adminRequest('GET', '/api/escrow/failed-transfers')
      setFailedTxns(res.data.failures || [])
    } catch (err) {
      setError('Failed to load failed transfers.')
    }
  }, [adminRequest])

  // Load both on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchDisputes(), fetchFailedTransfers()])
      setLoading(false)
    }
    if (ADMIN_KEY) load()
  }, [fetchDisputes, fetchFailedTransfers])

  // ── Resolve dispute (refund or release) ───────────────────
  const handleAction = async (action, transactionId, adminNote) => {
    const key = `${action}-${transactionId}`
    setActionLoading(key)
    setError('')

    try {
      await adminRequest('POST', '/api/escrow/resolve', {
        transaction_id: transactionId,
        action,
        admin_note: adminNote,
      })
      showToast(
        action === 'refund'
          ? '✅ Member refunded successfully.'
          : '✅ Funds released to host.',
        'success'
      )
      // Remove from list
      setDisputes(prev => prev.filter(t => t.id !== transactionId))
    } catch (err) {
      showToast(err.response?.data?.error || `Failed to ${action}.`, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Retry failed transfer ──────────────────────────────────
  const handleRetry = async (transactionId) => {
    setRetryLoading(transactionId)
    setError('')

    try {
      await adminRequest('POST', '/api/escrow/retry-transfer', {
        transaction_id: transactionId,
      })
      showToast('🔄 Transfer retry initiated. Check back in a few minutes.', 'success')
      // Remove from failed list optimistically
      setFailedTxns(prev => prev.filter(t => t.id !== transactionId))
    } catch (err) {
      showToast(err.response?.data?.error || 'Retry failed.', 'error')
    } finally {
      setRetryLoading(null)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0D0D; }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        .dispute-card { animation: fadeUp 0.35s ease both; }
        .toast        { animation: slideIn 0.3s ease both; }
      `}</style>

      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{
            background: t.type === 'error' ? '#C0392B' : '#0B3D2E',
            color: '#fff', borderRadius: 10,
            padding: '12px 20px', fontSize: 13.5, fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            maxWidth: 340,
          }}>
            {t.message}
          </div>
        ))}
      </div>

      <div style={{ minHeight: '100vh', background: '#0D0D0D', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── Admin Navbar ─────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #222',
          padding: '0 24px',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: '#C97B1A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 14, fontWeight: 800,
              }}>A</div>
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
                SplitPayNG <span style={{ color: '#C97B1A' }}>Admin</span>
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '1px',
                background: '#C97B1A22', color: '#C97B1A',
                border: '1px solid #C97B1A44', borderRadius: 5,
                padding: '2px 8px', textTransform: 'uppercase',
              }}>
                Internal
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => { setLoading(true); Promise.all([fetchDisputes(), fetchFailedTransfers()]).then(() => setLoading(false)) }}
                style={{
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                  color: '#888', background: 'none', border: '1px solid #333',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                }}
              >
                ↺ Refresh
              </button>
              <button onClick={() => navigate('/')} style={{
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                color: '#555', background: 'none', border: 'none', cursor: 'pointer',
              }}>
                ← Back to site
              </button>
            </div>
          </div>
        </nav>

        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px 80px' }}>

          {/* Page header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.1px', textTransform: 'uppercase', color: '#555', marginBottom: 4 }}>
              Admin Center
            </div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, letterSpacing: '-0.8px', color: '#fff', marginBottom: 6 }}>
              Disputes & Failed Transfers
            </h1>
            <p style={{ fontSize: 14, color: '#666' }}>
              Review all open disputes and failed payouts. Every action is logged.
            </p>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'Open Disputes',     value: disputes.length,  icon: '⚠️', color: '#C97B1A', bg: '#C97B1A14' },
              { label: 'Failed Transfers',  value: failedTxns.length, icon: '❌', color: '#C0392B', bg: '#C0392B14' },
              {
                label: 'Funds at Risk',
                value: fmt(disputes.reduce((s, t) => s + Number(t.amount || 0), 0)),
                icon: '💰', color: '#4299E1', bg: '#4299E114',
              },
            ].map(card => (
              <div key={card.label} style={{
                flex: 1, minWidth: 180,
                background: card.bg, border: `1px solid ${card.color}33`,
                borderRadius: 14, padding: '18px 22px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: card.color }}>
                    {card.label}
                  </span>
                  <span style={{ fontSize: 18 }}>{card.icon}</span>
                </div>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 28, fontWeight: 800, color: '#fff' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#1A1A1A', borderRadius: 11, padding: 4, width: 'fit-content', marginBottom: 28 }}>
            {[
              { key: 'disputes',  label: `Disputes (${disputes.length})` },
              { key: 'transfers', label: `Failed Transfers (${failedTxns.length})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  background: tab === t.key ? '#fff' : 'transparent',
                  color: tab === t.key ? '#111' : '#555',
                  border: 'none', borderRadius: 8,
                  padding: '8px 20px', cursor: 'pointer',
                  transition: 'all 0.18s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#C0392B22', border: '1px solid #C0392B44',
              borderRadius: 10, padding: '12px 18px', marginBottom: 24,
              fontSize: 13.5, color: '#E74C3C',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#444', fontSize: 14 }}>
              Loading…
            </div>
          ) : (
            <>
              {/* ── DISPUTES TAB ──────────────────────────── */}
              {tab === 'disputes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {disputes.length === 0 ? (
                    <div style={{
                      background: '#111', border: '1px solid #222',
                      borderRadius: 16, padding: '60px 24px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                        No open disputes
                      </div>
                      <p style={{ fontSize: 13.5, color: '#555' }}>All disputes have been resolved.</p>
                    </div>
                  ) : (
                    disputes.map((txn, i) => (
                      <div key={txn.id} className="dispute-card" style={{ animationDelay: `${i * 0.06}s` }}>
                        <DisputeCard
                          txn={txn}
                          onAction={handleAction}
                          actionLoading={actionLoading}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── FAILED TRANSFERS TAB ──────────────────── */}
              {tab === 'transfers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {failedTxns.length === 0 ? (
                    <div style={{
                      background: '#111', border: '1px solid #222',
                      borderRadius: 16, padding: '60px 24px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                      <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                        No failed transfers
                      </div>
                      <p style={{ fontSize: 13.5, color: '#555' }}>All payouts have been delivered successfully.</p>
                    </div>
                  ) : (
                    failedTxns.map((txn, i) => (
                      <div key={txn.id} className="dispute-card" style={{ animationDelay: `${i * 0.06}s` }}>
                        <FailedTransferCard
                          txn={txn}
                          onRetry={handleRetry}
                          retryLoading={retryLoading}
                        />
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