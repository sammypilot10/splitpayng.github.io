// ============================================================
// src/hooks/usePayments.js
// Handles the full payment lifecycle from the frontend:
//   joinPool()    — calls Node.js to get Paystack checkout URL
//   confirmAccess() — member confirms creds work (releases escrow)
//   disputeAccess() — member reports fake password (freezes funds)
//
// Usage:
//   const { joinPool, confirmAccess, disputeAccess, loading, error } = usePayments()
// ============================================================

import { useState, useCallback } from 'react'
import apiClient from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'

export function usePayments() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // ── 1. JOIN POOL ─────────────────────────────────────────
  // Called when a user clicks "Join Pool" on the marketplace.
  //
  // Flow:
  //   a) Create a pending membership row in Supabase
  //   b) POST to /api/payments/initialize with the membership_id
  //   c) Redirect the user to the Paystack checkout URL
  //
  // @param {string} poolId  — the pool the user wants to join
  const joinPool = useCallback(async (poolId) => {
    if (!user) {
      setError('You must be signed in to join a pool.')
      return { success: false }
    }

    setLoading(true)
    setError(null)

    try {
      // ── Step 1+2+3: Join via backend (handles guards + creates membership) ──
      const joinRes = await apiClient.post('/api/memberships/join', { pool_id: poolId })
      const membership = { id: joinRes.data.membership_id }

      // ── Step 4: Ask the backend for a Paystack checkout URL ───
      const { data } = await apiClient.post('/api/payments/initialize', {
        membership_id: membership.id,
      })

      // ── Step 5: Redirect to Paystack hosted checkout ──────────
      // Paystack takes over from here. On success/failure it
      // redirects the user back to VITE_PAYSTACK_CALLBACK_URL.
      window.location.href = data.authorization_url

      return { success: true, reference: data.reference }

    } catch (err) {
      console.error('[usePayments.joinPool]', err.message)
      setError(err.message)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }, [user])


  // ── 2. CONFIRM ACCESS (Escrow Release) ───────────────────
  // Called when the member clicks "Yes, Login Works ✓"
  // within 48 hours of joining a public pool.
  //
  // @param {string} transactionId  — from the member's active escrow txn
  // @param {string} membershipId   — the membership this confirms
  const confirmAccess = useCallback(async (transactionId, membershipId) => {
    if (!user) return { success: false }
    setLoading(true)
    setError(null)

    try {
      const { data } = await apiClient.post('/api/escrow/confirm', {
        transaction_id: transactionId,
        membership_id:  membershipId,
        user_id:        user.id,
      })
      return { success: true, message: data.message }
    } catch (err) {
      console.error('[usePayments.confirmAccess]', err.message)
      setError(err.message)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }, [user])


  // ── 3. DISPUTE ACCESS (Freeze Escrow) ────────────────────
  // Called when the member clicks "Report Fake Password 🚩"
  // Freezes the money until an admin resolves the dispute.
  //
  // @param {string} transactionId — the in_escrow transaction
  // @param {string} membershipId  — the associated membership
  // @param {string} reason        — member's explanation (optional)
  const disputeAccess = useCallback(async (transactionId, membershipId, reason = '') => {
    if (!user) return { success: false }
    setLoading(true)
    setError(null)

    try {
      const { data } = await apiClient.post('/api/escrow/dispute', {
        transaction_id: transactionId,
        membership_id:  membershipId,
        user_id:        user.id,
        reason,
      })
      return { success: true, message: data.message }
    } catch (err) {
      console.error('[usePayments.disputeAccess]', err.message)
      setError(err.message)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }, [user])


  return {
    joinPool,
    confirmAccess,
    disputeAccess,
    loading,
    error,
    clearError: () => setError(null),
  }
}