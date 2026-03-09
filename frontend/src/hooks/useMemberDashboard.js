import { useState, useEffect, useCallback } from 'react'
import apiClient from '../lib/apiClient'

export function useMemberDashboard() {
  const [memberships,  setMemberships]  = useState([])
  const [escrowItems,  setEscrowItems]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const fetchMemberships = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/api/memberships/mine')
      const all = res.data.memberships || []
      setMemberships(all.filter(m => m.payment_status !== 'in_escrow'))
      setEscrowItems(all.filter(m => m.payment_status === 'in_escrow'))
    } catch (err) {
      setError(err.message || 'Failed to load your subscriptions.')
      setMemberships([])
      setEscrowItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMemberships() }, [fetchMemberships])
  return { memberships, escrowItems, loading, error, refetch: fetchMemberships }
}