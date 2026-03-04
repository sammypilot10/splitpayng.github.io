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
import { supabase } from '../lib/supabase'
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
      // ── Step 1: Guard — check the user isn't already a member ──
      const { data: existing } = await supabase
        .from('memberships')
        .select('id, payment_status')
        .eq('pool_id', poolId)
        .eq('user_id', user.id)
        .not('payment_status', 'eq', 'cancelled')
        .maybeSingle()

      if (existing) {
        const msg = existing.payment_status === 'active'
          ? 'You are already an active member of this pool.'
          : 'You have a pending payment for this pool. Check your email.'
        setError(msg)
        return { success: false, alreadyMember: true }
      }

      // ── Step 2: Guard — check pool still has seats ────────────
      const { data: pool, error: poolErr } = await supabase
        .from('pools')
        .select('id, current_members, max_members, split_price, pool_status')
        .eq('id', poolId)
        .single()

      if (poolErr || !pool) {
        throw new Error('Pool not found.')
      }
      if (pool.pool_status !== 'active') {
        throw new Error('This pool is no longer accepting members.')
      }
      if (pool.current_members >= pool.max_members) {
        throw new Error('This pool is full. No seats available.')
      }

      // ── Step 3: Create a pending membership row ────────────────
      // We create the row BEFORE the payment so we have a
      // membership_id to pass into the Paystack metadata.
      const { data: membership, error: memErr } = await supabase
        .from('memberships')
        .insert({
          pool_id:        poolId,
          user_id:        user.id,
          payment_status: 'pending',
        })
        .select('id')
        .single()

      if (memErr) throw new Error('Failed to reserve your seat. Please try again.')

      // ── Step 4: Ask the backend for a Paystack checkout URL ───
      const { data } = await apiClient.post('/api/payments/initialize', {
        membership_id: membership.id,
        user_id:       user.id,
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
