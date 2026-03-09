// ============================================================
// src/pages/AdminDisputes.jsx
// Secure Administrative Terminal
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`

// ── Status badge ──────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    disputed: { bg: 'bg-[#FEF3E2]', text: 'text-[#C97B1A]', dot: 'bg-[#F5A623]', label: 'Disputed' },
    failed: { bg: 'bg-[#FEF0F0]', text: 'text-[#C0392B]', dot: 'bg-[#E74C3C]', label: 'Failed' },
    pending: { bg: 'bg-[#F5F5F5]', text: 'text-[#666666]', dot: 'bg-[#BBBBBB]', label: 'Pending' },
    released: { bg: 'bg-[#E8F5EF]', text: 'text-[#0B3D2E]', dot: 'bg-[#00A65A]', label: 'Released' },
    refunded: { bg: 'bg-[#F0F4FF]', text: 'text-[#2C5282]', dot: 'bg-[#4299E1]', label: 'Refunded' },
  }
  const s = map[status] || map.pending
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-bold ${s.bg} ${s.text} rounded-md px-2.5 py-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function DisputeCard({ txn, onAction, actionLoading }) {
  const [adminNote, setAdminNote] = useState('')
  const [expanded, setExpanded] = useState(false)

  const pool = txn.memberships?.pools
  const member = txn.memberships?.profiles
  const host = pool?.profiles

  const isRefundLoading = actionLoading === `refund-${txn.id}`
  const isReleaseLoading = actionLoading === `release-${txn.id}`
  const isAnyLoading = !!actionLoading

  return (
    <div className="bg-[#111827] border border-[#C9A84C]/30 rounded-2xl overflow-hidden shadow-lg mb-4">
      {/* Card header */}
      <div className="p-6 border-b border-[#1F2937]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge status="disputed" />
              <span className="text-xs text-[#9CA3AF]">
                {new Date(txn.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="font-sans text-lg font-bold text-[#F8FAFE]">
              {pool?.service_name || 'Unknown Service'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-sans text-2xl font-bold text-[#F8FAFE]">
              {fmt(txn.amount)}
            </div>
            <div className="text-xs text-[#9CA3AF]">Transaction amount</div>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="flex flex-wrap md:flex-nowrap border-b border-[#1F2937]">
        {[
          { role: 'Member (Reporter)', name: member?.full_name, email: member?.email, type: 'member' },
          { role: 'Host (Accused)', name: host?.full_name, email: host?.email, type: 'host' },
        ].map((party, i) => (
          <div key={party.role} className={`flex-1 p-6 ${i === 0 ? 'md:border-r border-[#1F2937]' : ''}`}>
            <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">
              {party.role}
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${party.type === 'member' ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-[#4299E1]/20 text-[#4299E1]'}`}>
                {party.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#F8FAFE]">{party.name || '—'}</div>
                <div className="text-xs text-[#9CA3AF]">{party.email || '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dispute reason */}
      <div className="p-6 border-b border-[#1F2937] bg-[#1A2234]">
        <div className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">
          Member's Complaint
        </div>
        <div className="text-sm text-[#D1D5DB] leading-relaxed">
          {txn.notes?.replace('Member raised dispute: ', '').replace(/^"|"$/g, '') || 'No reason provided.'}
        </div>
      </div>

      {/* Transaction details */}
      <div className="p-4 px-6 border-b border-[#1F2937]">
        <button
          onClick={() => setExpanded(x => !x)}
          className="bg-transparent border-none cursor-pointer text-xs text-[#9CA3AF] font-medium hover:text-[#F8FAFE] transition-colors"
        >
          {expanded ? '▲ Hide' : '▼ Show'} transaction details
        </button>
        {expanded && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
            {[
              { label: 'Transaction ID', value: txn.id },
              { label: 'Amount', value: fmt(txn.amount) },
              { label: 'Platform fee', value: fmt(txn.platform_fee) },
              { label: 'Host receives', value: fmt(txn.amount - txn.platform_fee) },
              { label: 'Pool', value: pool?.service_name },
              { label: 'Disputed on', value: new Date(txn.created_at).toLocaleString('en-NG') },
            ].map(row => (
              <div key={row.label} className="text-xs">
                <span className="text-[#9CA3AF]">{row.label}: </span>
                <span className="text-[#F8FAFE] font-semibold break-all">{row.value || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin actions */}
      <div className="p-6">
        <div className="mb-4">
          <label className="text-xs font-semibold text-[#9CA3AF] block mb-2">
            Admin note (IMMUTABLE audit comment)
          </label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            placeholder="e.g. Verified API logs: credential hand-off completed properly. Releasing to host."
            className="w-full font-sans text-sm text-[#F8FAFE] bg-[#0A0F1E] border border-[#374151] rounded-lg p-3 resize-y min-h-[72px] focus:outline-none focus:border-[#C9A84C] transition-colors placeholder-[#4B5563]"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => onAction('refund', txn, adminNote)}
            disabled={isAnyLoading}
            className={`flex-1 min-w-[160px] font-sans text-sm font-semibold rounded-lg py-3 px-5 transition-all duration-200 border
              ${isRefundLoading
                ? 'bg-[#1F2937] text-[#9CA3AF] border-[#374151] cursor-not-allowed'
                : isAnyLoading
                  ? 'bg-[#0A0F1E] text-[#4B5563] border-[#1F2937] cursor-not-allowed'
                  : 'bg-[#2A1215] text-[#F87171] border-[#7F1D1D] hover:bg-[#3F161A] hover:border-[#991B1B] cursor-pointer'}`}
          >
            {isRefundLoading ? 'Processing…' : '💸 Refund Member'}
          </button>

          <button
            onClick={() => onAction('release', txn, adminNote)}
            disabled={isAnyLoading}
            className={`flex-1 min-w-[160px] font-sans text-sm font-semibold rounded-lg py-3 px-5 transition-all duration-200 border
              ${isReleaseLoading
                ? 'bg-[#1F2937] text-[#9CA3AF] border-[#374151] cursor-not-allowed'
                : isAnyLoading
                  ? 'bg-[#0A0F1E] text-[#4B5563] border-[#1F2937] cursor-not-allowed'
                  : 'bg-[#132A20] text-[#34D399] border-[#064E3B] hover:bg-[#163D2D] hover:border-[#065F46] cursor-pointer'}`}
          >
            {isReleaseLoading ? 'Processing…' : '✓ Release to Host'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FailedTransferCard({ txn, onRetry, retryLoading }) {
  const pool = txn.memberships?.pools
  const host = pool?.profiles
  const isRetryLoading = retryLoading === txn.id

  return (
    <div className="bg-[#111827] border border-[#7F1D1D] rounded-2xl p-6 shadow-lg mb-4">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge status="failed" />
            <span className="text-xs text-[#9CA3AF]">
              {new Date(txn.updated_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="font-sans text-base font-bold text-[#F8FAFE]">
            {pool?.service_name || 'Unknown Service'}
          </div>
          <div className="text-xs text-[#9CA3AF] mt-1">
            Host: {host?.full_name || '—'} · {host?.email || '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-sans text-xl font-bold text-[#F8FAFE]">
            {fmt(txn.amount - txn.platform_fee)}
          </div>
          <div className="text-xs text-[#9CA3AF]">Host payout amount</div>
        </div>
      </div>

      <div className="bg-[#2A1215] rounded-lg p-3 text-sm text-[#F87171] mb-5 border border-[#7F1D1D]">
        <strong>Failure reason:</strong> {txn.transfer_failure_reason || 'No reason recorded.'}
      </div>

      <div className="flex gap-6 mb-5 flex-wrap">
        {[
          { label: 'Bank', value: host?.payout_bank_code || 'Not set' },
          { label: 'Account number', value: host?.payout_account_number || 'Not set' },
          { label: 'Transfer ref', value: txn.transfer_reference || '—' },
        ].map(row => (
          <div key={row.label} className="text-xs">
            <span className="text-[#9CA3AF]">{row.label}: </span>
            <span className="text-[#F8FAFE] font-semibold">{row.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onRetry(txn)}
        disabled={!!retryLoading}
        className={`font-sans text-sm font-semibold rounded-lg py-3 px-6 transition-all duration-200 border
          ${isRetryLoading
            ? 'bg-[#1F2937] text-[#9CA3AF] border-[#374151] cursor-not-allowed'
            : !!retryLoading
              ? 'bg-[#0A0F1E] text-[#4B5563] border-[#1F2937] cursor-not-allowed'
              : 'bg-[#C9A84C] text-[#0A0F1E] border-[#C9A84C] hover:bg-[#B39540] hover:border-[#B39540] cursor-pointer'}`}
      >
        {isRetryLoading ? 'Retrying…' : '🔄 Retry Transfer'}
      </button>
    </div>
  )
}

export default function AdminDisputes() {
  const navigate = useNavigate()
  const { user, isAdmin, loading: authLoading } = useAuth()

  const [tab, setTab] = useState('disputes')
  const [disputes, setDisputes] = useState([])
  const [failedTxns, setFailedTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [retryLoading, setRetryLoading] = useState(null)
  const [toasts, setToasts] = useState([])

  // ── Access Control ──
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      // [AUDIT] System logged unauthorized entry bounce.
      navigate('/dashboard', { replace: true })
    }
  }, [user, isAdmin, authLoading, navigate])

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await apiClient({ method: 'GET', url: '/api/escrow/disputes' })
      setDisputes(res.data.disputes || [])
    } catch (err) { setError('Failed to load disputes.') }
  }, [])

  const fetchFailedTransfers = useCallback(async () => {
    try {
      const res = await apiClient({ method: 'GET', url: '/api/escrow/failed-transfers' })
      setFailedTxns(res.data.failures || [])
    } catch (err) { setError('Failed to load transfers.') }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      setLoading(true)
      Promise.all([fetchDisputes(), fetchFailedTransfers()]).then(() => setLoading(false))
    }
  }, [isAdmin, fetchDisputes, fetchFailedTransfers])

  // ── Dispatch: Optimistic Resolve ──
  const handleAction = async (action, txn, adminNote) => {
    setActionLoading(`${action}-${txn.id}`)
    setError('')

    // Optimistic remove for UI speed
    const previous = [...disputes]
    setDisputes(prev => prev.filter(t => t.id !== txn.id))

    try {
      // API call uses default headers (so it passes JWT automatically)
      await apiClient({
        method: 'POST',
        url: '/api/escrow/resolve',
        data: { transaction_id: txn.id, action, admin_note: adminNote }
      })
      showToast(action === 'refund' ? '✅ Member refunded successfully.' : '✅ Funds released to host.')
      // [AUDIT] Note: Backend API should append 'admin_note' to transaction audit log immutable table.
    } catch (err) {
      setDisputes(previous) // Rollback
      showToast(err.response?.data?.error || `Failed to ${action}.`, 'error')
    } finally { setActionLoading(null) }
  }

  // ── Dispatch: Optimistic Retry ──
  const handleRetry = async (txn) => {
    setRetryLoading(txn.id)
    setError('')

    // Optimistic remove
    const previous = [...failedTxns]
    setFailedTxns(prev => prev.filter(t => t.id !== txn.id))

    try {
      await apiClient({
        method: 'POST',
        url: '/api/escrow/retry-transfer',
        data: { transaction_id: txn.id }
      })
      showToast('🔄 Transfer retry initiated. Submitting to Switch.')
    } catch (err) {
      setFailedTxns(previous) // Rollback
      showToast(err.response?.data?.error || 'Retry failed.', 'error')
    } finally { setRetryLoading(null) }
  }

  // Await Auth context evaluation
  if (authLoading || !isAdmin) return null

  return (
    <>
      <div className="fixed top-5 right-5 z-[1000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-lg px-5 py-3 text-sm font-semibold shadow-xl transition-all ${t.type === 'error' ? 'bg-[#C0392B] text-white' : 'bg-[#C9A84C] text-[#0A0F1E]'
            } max-w-[340px] break-words`}>
            {t.message}
          </div>
        ))}
      </div>

      <div className="min-h-screen bg-[#0A0F1E] font-sans text-[#F8FAFE]">
        <nav className="sticky top-0 z-[100] bg-[#0A0F1E]/95 backdrop-blur-md border-b border-[#1F2937] px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C9A84C] flex items-center justify-center text-[#0A0F1E] font-bold text-sm">
                A
              </div>
              <span className="font-bold text-base text-[#F8FAFE]">
                SplitPayNG <span className="text-[#C9A84C]">Admin</span>
              </span>
              <span className="text-[10px] font-bold tracking-wider bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30 rounded px-2 py-0.5 uppercase">
                Internal
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setLoading(true); Promise.all([fetchDisputes(), fetchFailedTransfers()]).then(() => setLoading(false)) }}
                className="text-xs font-medium text-[#9CA3AF] hover:text-[#F8FAFE] bg-transparent border border-[#374151] hover:border-[#4B5563] rounded-lg px-3.5 py-1.5 transition-colors cursor-pointer"
              >
                ↺ Refresh
              </button>
              <button onClick={() => navigate('/dashboard')} className="text-xs font-medium text-[#9CA3AF] hover:text-[#F8FAFE] bg-transparent border-none cursor-pointer">
                ← Back to dashboard
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-6 pt-10 pb-20">
          <div className="mb-8">
            <div className="text-[11px] font-bold tracking-widest uppercase text-[#9CA3AF] mb-1.5">
              Admin Center
            </div>
            <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-[#F8FAFE] mb-2">
              Disputes & Failed Transfers
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 mb-8">
            {[
              { label: 'Open Disputes', value: disputes.length, icon: '⚠️', text: 'text-[#C9A84C]', bg: 'bg-[#C9A84C]/10', border: 'border-[#C9A84C]/20' },
              { label: 'Failed Transfers', value: failedTxns.length, icon: '❌', text: 'text-[#F87171]', bg: 'bg-[#F87171]/10', border: 'border-[#F87171]/20' },
              { label: 'Funds at Risk', value: fmt(disputes.reduce((s, t) => s + Number(t.amount || 0), 0)), icon: '💰', text: 'text-[#60A5FA]', bg: 'bg-[#60A5FA]/10', border: 'border-[#60A5FA]/20' },
            ].map(card => (
              <div key={card.label} className={`flex-1 min-w-[180px] rounded-xl p-5 border ${card.bg} ${card.border}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[11px] font-bold tracking-widest uppercase ${card.text}`}>{card.label}</span>
                  <span className="text-lg">{card.icon}</span>
                </div>
                <div className="text-3xl font-bold text-[#F8FAFE]">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-1 bg-[#111827] border border-[#1F2937] rounded-xl p-1 w-max mb-8">
            {[{ key: 'disputes', label: `Disputes (${disputes.length})` }, { key: 'transfers', label: `Failed Transfers (${failedTxns.length})` }].map(t => (
              <button
                key={t.key} onClick={() => setTab(t.key)}
                className={`text-sm font-semibold rounded-lg px-5 py-2 transition-all duration-200 cursor-pointer ${tab === t.key ? 'bg-[#1F2937] text-[#F8FAFE] shadow-sm' : 'bg-transparent text-[#9CA3AF] hover:text-[#D1D5DB]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (<div className="bg-[#2A1215] border border-[#7F1D1D] rounded-xl p-4 mb-6 text-sm text-[#F87171]">⚠ {error}</div>)}

          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 h-[280px] animate-pulse">
                  <div className="flex justify-between mb-6">
                    <div className="w-32 h-4 bg-[#1F2937] rounded" />
                    <div className="w-24 h-6 bg-[#1F2937] rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="w-full h-16 bg-[#1F2937] rounded" />
                    <div className="w-full h-16 bg-[#1F2937] rounded" />
                  </div>
                  <div className="w-full h-24 bg-[#1A2234] rounded" />
                </div>
              ))}
            </div>
          ) : (
            tab === 'disputes' ? (
              <div className="flex flex-col gap-4">
                {disputes.length === 0 ? (
                  <div className="bg-[#111827] border border-[#1F2937] rounded-2xl py-16 px-6 text-center">
                    <div className="text-4xl mb-4">✅</div>
                    <div className="text-xl font-bold text-[#F8FAFE] mb-2">No open disputes</div>
                    <p className="text-sm text-[#9CA3AF]">All conflicts have been resolved.</p>
                  </div>
                ) : disputes.map(txn => <DisputeCard key={txn.id} txn={txn} onAction={handleAction} actionLoading={actionLoading} />)}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {failedTxns.length === 0 ? (
                  <div className="bg-[#111827] border border-[#1F2937] rounded-2xl py-16 px-6 text-center">
                    <div className="text-4xl mb-4">✅</div>
                    <div className="text-xl font-bold text-[#F8FAFE] mb-2">No failed transfers</div>
                    <p className="text-sm text-[#9CA3AF]">All host payouts delivered successfully.</p>
                  </div>
                ) : failedTxns.map(txn => <FailedTransferCard key={txn.id} txn={txn} onRetry={handleRetry} retryLoading={retryLoading} />)}
              </div>
            )
          )}
        </main>
      </div>
    </>
  )
}
