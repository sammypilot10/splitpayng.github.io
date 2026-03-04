// ============================================================
// src/utils/paymentCallbackHandler.js
//
// SECURITY FIX (Step 5):
// Previous version had a vulnerability — anyone could visit
// /payment/callback?reference=someone_elses_reference and see
// another person's payment result.
//
// Fix: After finding the transaction by reference, we verify
// that the membership's user_id matches the currently logged-in
// user's id. If they don't match, we reject the request.
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function usePaymentCallback() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const [status,       setStatus]     = useState('verifying') // 'verifying' | 'success' | 'failed' | 'unauthorized'
  const [membership,   setMembership] = useState(null)

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref')
    if (!reference) {
      navigate('/', { replace: true })
      return
    }
    verifyAndRoute(reference)
  }, [])

  const verifyAndRoute = async (reference) => {
    try {
      // ── Step 1: Get the currently logged-in user ──────────
      // If nobody is logged in, reject immediately.
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()

      if (sessionErr || !session?.user) {
        console.warn('[CALLBACK] No active session — redirecting to auth')
        navigate('/auth', { replace: true })
        return
      }

      const currentUserId = session.user.id

      // ── Step 2: Poll for the transaction result ───────────
      const result = await pollForPaymentResult(reference, 12)

      if (!result) {
        // Timed out — payment still processing or reference invalid
        setStatus('failed')
        return
      }

      // ── Step 3: SECURITY CHECK ────────────────────────────
      // Verify the membership on this transaction belongs to
      // the currently logged-in user.
      // This prevents user A from seeing user B's payment result
      // by guessing a reference from the URL.
      if (result.user_id !== currentUserId) {
        console.warn(
          `[CALLBACK] ⚠️ Ownership mismatch — ` +
          `transaction owner: ${result.user_id}, ` +
          `current user: ${currentUserId}`
        )
        setStatus('unauthorized')
        return
      }

      // ── Step 4: Set result based on payment status ────────
      setMembership(result)

      if (['active', 'in_escrow'].includes(result.payment_status)) {
        setStatus('success')
        // Redirect to member dashboard after 3 seconds
        setTimeout(() => navigate('/my-subscriptions', { replace: true }), 3000)
      } else {
        setStatus('failed')
      }

    } catch (err) {
      console.error('[CALLBACK] Unexpected error:', err.message)
      setStatus('failed')
    }
  }

  return { status, membership }
}


// ── Poll Supabase every 1.5s for up to maxSeconds ────────────
// The Paystack webhook fires asynchronously. We poll briefly
// until the webhook updates the transaction from 'pending'.
// We select user_id here so we can verify ownership above.
async function pollForPaymentResult(reference, maxSeconds) {
  const maxAttempts = Math.ceil(maxSeconds / 1.5)

  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        status,
        memberships (
          id,
          user_id,
          payment_status,
          pool_id,
          pools ( service_name )
        )
      `)
      .eq('paystack_reference', reference)
      .single()

    if (error) {
      // Reference doesn't exist at all — stop polling
      console.warn('[CALLBACK] Reference not found:', reference)
      return null
    }

    // Still pending — webhook hasn't fired yet, wait and retry
    if (data.status === 'pending') {
      await new Promise(r => setTimeout(r, 1500))
      continue
    }

    // Webhook has processed it — return the membership data
    // Flatten user_id up for easy access in the security check
    return {
      ...data.memberships,
      transaction_status: data.status,
    }
  }

  // Timed out after maxSeconds
  console.warn('[CALLBACK] Polling timed out for reference:', reference)
  return null
}