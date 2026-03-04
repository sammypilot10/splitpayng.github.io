// ============================================================
// src/hooks/usePoolDetail.js
// Fetches a single pool's details for the Pool Detail page.
// Includes the decrypted service password — only available
// if the current user is an active member or the owner.
// (The DB function enforces this check server-side.)
//
// Usage:
//   const { pool, password, loading, error } = usePoolDetail(poolId)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePoolDetail(poolId) {
  const { user } = useAuth()
  const [pool,     setPool]     = useState(null)
  const [password, setPassword] = useState(null) // null = not entitled / loading
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetchPool = useCallback(async () => {
    if (!poolId) return
    setLoading(true)
    setError(null)

    try {
      // ── Fetch public pool data ─────────────────────────────
      const { data: poolData, error: poolErr } = await supabase
        .from('pools_public_view')
        .select(`
          id, service_name, category, description, split_price,
          total_cost, max_members, current_members, is_public,
          pool_status, renewal_day, created_at,
          profiles!pools_owner_id_fkey ( full_name, avatar_url )
        `)
        .eq('id', poolId)
        .single()

      if (poolErr) throw poolErr
      setPool(enrichPool(poolData))

      // ── Fetch decrypted password if user is a member ───────
      // get_pool_password() is a Supabase RPC that internally
      // checks if the caller is the owner or an active member.
      // Returns null if they aren't entitled.
      if (user) {
        const { data: pwData } = await supabase
          .rpc('get_pool_password', { pool_id: poolId })
        setPassword(pwData || null)
      }

    } catch (err) {
      console.error('[usePoolDetail]', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [poolId, user])

  useEffect(() => { fetchPool() }, [fetchPool])

  return { pool, password, loading, error, refetch: fetchPool }
}

function enrichPool(pool) {
  const seatsLeft  = pool.max_members - pool.current_members
  const fillPct    = Math.round((pool.current_members / pool.max_members) * 100)
  const perSeatFull = pool.total_cost / pool.max_members
  const savingsPct = perSeatFull > 0
    ? Math.round(((perSeatFull - pool.split_price) / perSeatFull) * 100)
    : 0
  return { ...pool, seatsLeft, fillPct, savingsPct }
}
