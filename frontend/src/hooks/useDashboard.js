import { useState, useEffect, useCallback } from 'react'
import apiClient from '../lib/apiClient'

export function useDashboard() {
  const [pools,   setPools]   = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/api/pools/mine')
      const pools = res.data.pools || []
      const activeMembers = pools.reduce((s,p)=>s+(p.memberships||[]).filter(m=>m.payment_status==='paid').length,0)
      const totalMonthly  = pools.reduce((s,p)=>{const n=(p.memberships||[]).filter(m=>m.payment_status==='paid').length;return s+(p.split_price*n*0.8)},0)
      const pendingMembers = pools.reduce((s,p)=>s+(p.memberships||[]).filter(m=>m.payment_status==='in_escrow'||m.payment_status==='pending').length,0)
      const pendingCollections = pools.reduce((s,p)=>{const n=(p.memberships||[]).filter(m=>m.payment_status==='in_escrow'||m.payment_status==='pending').length;return s+(p.split_price*n)},0)
      setPools(pools)
      setStats({totalMembers:activeMembers,totalMonthly:Math.round(totalMonthly),nextPayout:Math.round(totalMonthly),pendingCollections:Math.round(pendingCollections),pendingCount:pendingMembers})
    } catch(err) {
      setError(err.message||'Failed to load dashboard data')
      setPools([])
      setStats({totalMembers:0,totalMonthly:0,nextPayout:0,pendingCollections:0,pendingCount:0})
    } finally {
      setLoading(false)
    }
  },[])

  useEffect(()=>{fetchData()},[fetchData])
  return {pools,stats,loading,error,refetch:fetchData}
}