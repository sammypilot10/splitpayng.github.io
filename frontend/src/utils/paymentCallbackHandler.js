import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

function getTokenFromStorage() {
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    return key ? JSON.parse(localStorage.getItem(key))?.access_token : null
  } catch { return null }
}

export function usePaymentCallback() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const [status,       setStatus]     = useState('verifying')
  const [membership,   setMembership] = useState(null)
  const [errorMsg,     setErrorMsg]   = useState('')

  useEffect(() => {
    // Try URL params first, then sessionStorage fallback
    const reference = searchParams.get('reference') 
      || searchParams.get('trxref')
      || sessionStorage.getItem('pendingPaymentRef')

    if (!reference) {
      navigate('/', { replace: true })
      return
    }

    // Clear sessionStorage ref so it doesn't persist
    sessionStorage.removeItem('pendingPaymentRef')
    sessionStorage.removeItem('pendingPoolId')

    verifyAndRoute(reference)
  }, [])

  const verifyAndRoute = async (reference) => {
    try {
      const token = getTokenFromStorage()

      if (!token) {
        setErrorMsg('You must be signed in to verify a payment.')
        setStatus('unauthorized')
        setTimeout(() => navigate('/auth', { replace: true }), 3000)
        return
      }

      // Poll backend for payment result (backend polls Supabase with service key)
      const result = await pollForPaymentResult(reference, token, 30)

      if (!result) {
        setErrorMsg('Payment could not be verified. If money was taken, contact support.')
        setStatus('failed')
        return
      }

      if (result.__unauthorized) {
        setErrorMsg('You are not authorized to view this payment result.')
        setStatus('unauthorized')
        setTimeout(() => navigate('/auth', { replace: true }), 3000)
        return
      }

      setMembership(result)

      if (['active', 'in_escrow'].includes(result.payment_status)) {
        setStatus('success')
        setTimeout(() => navigate('/my-subscriptions', { replace: true }), 3000)
      } else {
        setErrorMsg('Payment was not completed. No money has been taken.')
        setStatus('failed')
      }

    } catch (err) {
      console.error('[paymentCallback]', err.message)
      setErrorMsg('Something went wrong verifying your payment.')
      setStatus('failed')
    }
  }

  return { status, membership, errorMsg }
}

async function pollForPaymentResult(reference, token, maxSeconds) {
  const maxAttempts = Math.ceil(maxSeconds / 2.5)

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${API}/api/payments/verify?reference=${encodeURIComponent(reference)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (res.status === 403) return { __unauthorized: true }
      
      if (res.ok) {
        const data = await res.json()
        if (data.membership) return data.membership
      }
    } catch (e) {
      console.log('[poll] attempt', i+1, 'failed:', e.message)
    }

    await new Promise(r => setTimeout(r, 2500))
  }

  return null
}