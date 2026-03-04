// ============================================================
// src/hooks/usePools.js
// Fetches public pools for the Marketplace homepage.
// Supports category filtering, search, and sorting entirely
// through Supabase query composition — no client-side filtering.
//
// Usage:
//   const { pools, loading, error, refetch } = usePools({ category, search, sort })
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function usePools({
  category = 'All',
  search   = '',
  sort     = 'popular',
  limit    = 20,
} = {}) {
  const [pools,   setPools]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  const fetchPools = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      // Uses pools_public_view — the DB view that strips
      // the encrypted_service_password column for safety.
      let query = supabase
        .from('pools_public_view')
        .select(`
          id, service_name, category, description,
          split_price, total_cost, max_members, current_members,
          is_public, pool_status, renewal_day, created_at, owner_id,
          profiles!pools_owner_id_fkey ( full_name, avatar_url )
        `)
        .eq('pool_status', 'active')
        .eq('is_public', true)
        .limit(limit)

      if (category && category !== 'All') {
        query = query.eq('category', category)
      }

      if (search.trim()) {
        query = query.ilike('service_name', `%${search.trim()}%`)
      }

      switch (sort) {
        case 'price-asc':  query = query.order('split_price',      { ascending: true });  break
        case 'price-desc': query = query.order('split_price',      { ascending: false }); break
        case 'seats':      query = query.order('current_members',  { ascending: true });  break
        default:           query = query.order('current_members',  { ascending: false }); break
      }

      const { data, error: sbError } = await query
        .abortSignal(abortRef.current.signal)

      if (sbError) throw sbError
      setPools((data || []).map(enrichPool))
    } catch (err) {
      if (err.name === 'AbortError') return
      console.error('[usePools]', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [category, search, sort, limit])

  useEffect(() => {
    fetchPools()
    return () => abortRef.current?.abort()
  }, [fetchPools])

  return { pools, loading, error, refetch: fetchPools }
}

// Adds derived fields so components stay presentation-only
function enrichPool(pool) {
  const seatsLeft  = pool.max_members - pool.current_members
  const fillPct    = Math.round((pool.current_members / pool.max_members) * 100)
  const perSeatFull = pool.total_cost / pool.max_members
  const savingsPct = perSeatFull > 0
    ? Math.round(((perSeatFull - pool.split_price) / perSeatFull) * 100)
    : 0
  return { ...pool, seatsLeft, fillPct, savingsPct }
}
