// ============================================================
// src/components/EscrowActions.jsx
// The critical 48-hour escrow confirmation card shown to a
// Member after joining a public pool.
//
// Shows:
//   - Countdown timer
//   - "✓ Yes, Login Works" → confirms escrow, releases funds
//   - "🚩 Report Fake Password" → disputes, freezes funds
//
// Usage:
//   <EscrowActions membership={membership} onResolved={refetch} />
// ============================================================

import { useState } from 'react'
import { usePayments } from '../hooks/usePayments'
import { useEscrowCountdown } from '../utils/escrowCountdown'

export default function EscrowActions({ membership, onResolved }) {
  const { confirmAccess, disputeAccess, loading } = usePayments()
  const [showDisputeForm, setShowDisputeForm]     = useState(false)
  const [disputeReason,   setDisputeReason]       = useState('')
  const [resultMsg,       setResultMsg]           = useState('')
  const [resolved,        setResolved]            = useState(false)

  const txn = membership.latestTransaction
  const countdown = useEscrowCountdown(txn?.escrow_expires_at)

  if (resolved) {
    return (
      <div style={{
        background: '#E8F5EF', border: '1px solid #C5E0D4',
        borderRadius: 14, padding: '20px 22px',
        fontSize: 13.5, color: '#0B3D2E', lineHeight: 1.6,
      }}>
        ✓ {resultMsg}
      </div>
    )
  }

  const handleConfirm = async () => {
    const result = await confirmAccess(txn.id, membership.id)
    if (result.success) {
      setResultMsg(result.message || 'Access confirmed. You\'re all set!')
      setResolved(true)
      onResolved?.()
    }
  }

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      alert('Please describe the problem before submitting.')
      return
    }
    const result = await disputeAccess(txn.id, membership.id, disputeReason)
    if (result.success) {
      setResultMsg(result.message || 'Dispute submitted. Our team will review within 24 hours.')
      setResolved(true)
      onResolved?.()
    }
  }

  return (
    <div style={{
      background: '#FFFBF0',
      border: '1px solid #F0D5A0',
      borderRadius: 14,
      padding: '20px 22px',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 700, color: '#111' }}>
            ⏳ Escrow Protection Active
          </div>
          <div style={{ fontSize: 12, color: '#C97B1A', marginTop: 3 }}>
            {countdown.isExpired ? 'Window expired — funds auto-released' : countdown.label}
          </div>
        </div>
        <div style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 13, fontWeight: 800,
          color: '#C97B1A',
          background: '#FEF3E2',
          border: '1px solid #F0D5A0',
          borderRadius: 8, padding: '4px 12px',
        }}>
          {membership.pools?.service_name}
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 18 }}>
        Test the login credentials below. If everything works, confirm access to release
        payment to the host. If the password is fake or wrong, report it.
      </p>

      {!showDisputeForm ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={loading || countdown.isExpired}
            style={{
              flex: 1, minWidth: 160,
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
              color: '#fff', background: '#0B3D2E',
              border: 'none', borderRadius: 10, padding: '11px 0',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
            }}
          >
            {loading ? '…' : '✓ Yes, Login Works'}
          </button>

          {/* Dispute button */}
          <button
            onClick={() => setShowDisputeForm(true)}
            disabled={loading || countdown.isExpired}
            style={{
              flex: 1, minWidth: 160,
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
              color: '#C0392B', background: '#FEF0F0',
              border: '1px solid #FACACC', borderRadius: 10, padding: '11px 0',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
            }}
          >
            🚩 Report Fake Password
          </button>
        </div>
      ) : (
        /* Dispute form */
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444', display: 'block', marginBottom: 6 }}>
            Describe the problem
          </label>
          <textarea
            value={disputeReason}
            onChange={e => setDisputeReason(e.target.value)}
            placeholder="e.g. Password doesn't work, account is already in use, wrong service..."
            rows={3}
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: 13.5,
              color: '#111', background: '#fff', border: '1px solid #E2DAD0',
              borderRadius: 9, padding: '10px 12px', outline: 'none',
              resize: 'vertical', boxSizing: 'border-box', marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleDispute}
              disabled={loading}
              style={{
                flex: 1, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                color: '#fff', background: '#C0392B', border: 'none',
                borderRadius: 10, padding: '11px 0',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '…' : 'Submit Dispute'}
            </button>
            <button
              onClick={() => setShowDisputeForm(false)}
              style={{
                fontFamily: 'inherit', fontSize: 13, color: '#888',
                background: 'none', border: '1px solid #E2DAD0',
                borderRadius: 10, padding: '11px 18px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
