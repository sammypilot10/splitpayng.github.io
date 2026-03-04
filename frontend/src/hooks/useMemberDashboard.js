// ============================================================
// src/hooks/useMemberDashboard.js
// Fetches all memberships for a logged-in Member:
//   - Active subscriptions (with credentials)
//   - In-escrow memberships (pending confirmation)
//   - Failed/cancelled history
//
// Usage:
//   const { memberships, escrowItems, loading, error } = useMemberDashboard()
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useMemberDashboard() {
  const { user } = useAuth()
  const [memberships,  setMemberships]  = useState([])
  const [escrowItems,  setEscrowItems]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const fetchMemberships = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const { data, error: sbErr } = await supabase
        .from('memberships')
        .select(`
          id, payment_status, next_billing_date, created_at,
          paystack_card_last4,
          pools (
            id, service_name, category, split_price,
            renewal_day, is_public, pool_status,
            profiles!pools_owner_id_fkey ( full_name, avatar_url )
          ),
          transactions (
            id, status, amount, escrow_expires_at, created_at
          )
        `)
        .eq('user_id', user.id)
        .neq('payment_status', 'cancelled')
        .order('created_at', { ascending: false })

      if (sbErr) throw sbErr

      const all = (data || []).map(m => ({
        ...m,
        latestTransaction: (m.transactions || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )[0] || null,
        // Escrow window remaining in hours
        escrowHoursLeft: getEscrowHoursLeft(m),
      }))

      // Split into two lists for easier rendering
      setMemberships(all.filter(m => m.payment_status !== 'in_escrow'))
      setEscrowItems(all.filter(m => m.payment_status === 'in_escrow'))

    } catch (err) {
      console.error('[useMemberDashboard]', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchMemberships() }, [fetchMemberships])

  // Real-time: update when the webhook changes this user's membership
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('member-memberships')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'memberships',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchMemberships())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fetchMemberships])

  return { memberships, escrowItems, loading, error, refetch: fetchMemberships }
}

// Returns how many hours remain in the escrow window (or 0 if expired)
function getEscrowHoursLeft(membership) {
  const latestTxn = (membership.transactions || []).find(t => t.status === 'in_escrow')
  if (!latestTxn?.escrow_expires_at) return 0
  const msLeft = new Date(latestTxn.escrow_expires_at) - Date.now()
  return Math.max(0, Math.round(msLeft / (1000 * 60 * 60)))
}
