// ============================================================
// src/hooks/useDashboard.js
// Fetches the Host's own pools + memberships + transactions.
// Also sets up a real-time subscription so the dashboard
// updates live when a member pays without needing a refresh.
//
// Usage:
//   const { pools, stats, loading, error, refetch } = useDashboard()
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function useDashboard() {
  const { user } = useAuth()
  const [pools,   setPools]   = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Fetch all Host data in one pass ──────────────────────
  const fetchDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      // Single query — pools + every membership's profile + latest transaction
      const { data: poolsData, error: poolsErr } = await supabase
        .from('pools')
        .select(`
          id, service_name, category, split_price, total_cost,
          max_members, current_members, is_public, pool_status,
          renewal_day, created_at,
          memberships (
            id, payment_status, paystack_card_last4, created_at,
            next_billing_date,
            profiles (
              id, full_name, email, avatar_url
            ),
            transactions (
              id, status, amount, escrow_expires_at, created_at
            )
          )
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (poolsErr) throw poolsErr

      const enriched = (poolsData || []).map(enrichHostPool)
      setPools(enriched)
      setStats(computeStats(enriched))

    } catch (err) {
      console.error('[useDashboard]', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // ── Real-time: refresh when any membership in user's pools changes ──
  // Paystack webhook updates memberships server-side. This listener
  // makes the dashboard reflect those changes without the Host refreshing.
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event:  '*',        // INSERT, UPDATE, DELETE
          schema: 'public',
          table:  'memberships',
          // Only react to memberships in pools this user owns
          filter: `pool_id=in.(${pools.map(p => p.id).join(',') || 'null'})`,
        },
        (payload) => {
          console.log('[useDashboard] Real-time update:', payload.eventType)
          fetchDashboard() // Re-fetch on any membership change
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, pools.length, fetchDashboard])

  return { pools, stats, loading, error, refetch: fetchDashboard }
}

// ── Enrich each pool with derived fields ─────────────────────
function enrichHostPool(pool) {
  const memberships  = pool.memberships || []
  const paidMembers  = memberships.filter(m =>
    ['active', 'in_escrow'].includes(m.payment_status)
  )
  const failedCount  = memberships.filter(m => m.payment_status === 'failed').length
  const pendingCount = memberships.filter(m => m.payment_status === 'pending').length
  const seatsLeft    = pool.max_members - memberships.length
  const fillPct      = Math.round((paidMembers.length / pool.max_members) * 100)
  const monthlyTotal = paidMembers.length * parseFloat(pool.split_price)

  // Latest transaction per membership (for escrow status display)
  const membershipsWithLatestTxn = memberships.map(m => ({
    ...m,
    latestTransaction: (m.transactions || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )[0] || null,
  }))

  return {
    ...pool,
    memberships: membershipsWithLatestTxn,
    paidCount:   paidMembers.length,
    failedCount,
    pendingCount,
    seatsLeft,
    fillPct,
    monthlyTotal,
  }
}

// ── Compute top-row financial stats ──────────────────────────
function computeStats(pools) {
  const activePools    = pools.filter(p => p.pool_status === 'active')
  const totalMonthly   = activePools.reduce((sum, p) => sum + p.monthlyTotal, 0)
  const totalMembers   = activePools.reduce((sum, p) => sum + (p.memberships?.length || 0), 0)
  const pendingCount   = activePools.reduce((sum, p) => sum + p.pendingCount, 0)
  const failedCount    = activePools.reduce((sum, p) => sum + p.failedCount, 0)
  const pendingAmount  = activePools.reduce((sum, p) =>
    sum + p.pendingCount * parseFloat(p.split_price), 0
  )

  // Estimated payout = monthly total minus 5% platform fee
  const PLATFORM_FEE = 0.05
  const nextPayout   = totalMonthly * (1 - PLATFORM_FEE)

  return {
    nextPayout:         Math.round(nextPayout),
    totalMonthly:       Math.round(totalMonthly),
    pendingCollections: Math.round(pendingAmount),
    totalMembers,
    pendingCount,
    failedCount,
    activePools:        activePools.length,
  }
}
