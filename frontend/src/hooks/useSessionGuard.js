// ============================================================
// src/hooks/useSessionGuard.js
//
// Watches the Supabase auth state across the entire app.
// Mount this once in App.jsx — it runs silently in the background.
//
// Handles three scenarios apiClient.js cannot catch:
//
//   1. Token expires while the user is idle (no requests firing)
//      — apiClient only refreshes when a request fails, but if
//        the user hasn't made a request in 60+ minutes, the
//        session is stale. This hook catches it via Supabase's
//        onAuthStateChange listener.
//
//   2. User's account is deleted or banned by admin
//      — Supabase fires SIGNED_OUT in this case. We redirect
//        cleanly instead of leaving the user on a broken page.
//
//   3. User opens the app in a new tab
//      — Supabase syncs auth state across tabs via localStorage.
//        This hook picks up the event and ensures the new tab
//        is in the correct auth state.
//
// IMPORTANT: This hook does NOT redirect on normal sign-out
// (when the user clicks "Sign out" themselves). AuthContext
// handles that. This only catches unexpected session loss.
// ============================================================

import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Pages that don't require a session — don't redirect from these
const PUBLIC_PATHS = ['/', '/auth', '/payment/callback']

export function useSessionGuard() {
  const navigate         = useNavigate()
  const location         = useLocation()
  const intentionalSignout = useRef(false)

  // Expose a way for the AuthContext sign-out to mark it as intentional
  // so this hook doesn't double-redirect
  useEffect(() => {
    window.__markIntentionalSignout = () => {
      intentionalSignout.current = true
    }
    return () => {
      delete window.__markIntentionalSignout
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[SessionGuard] Auth event: ${event}`)

        if (event === 'TOKEN_REFRESHED') {
          // Supabase auto-refreshed the token in the background
          // No action needed — apiClient will pick up the new token
          console.log('[SessionGuard] ✅ Token auto-refreshed by Supabase')
          return
        }

        if (event === 'SIGNED_IN') {
          // User signed in — no action needed here, AuthContext handles routing
          return
        }

        if (event === 'SIGNED_OUT') {
          if (intentionalSignout.current) {
            // User clicked sign out themselves — reset flag, don't interfere
            intentionalSignout.current = false
            return
          }

          // Unexpected sign-out (expired, account deleted, revoked)
          const isPublicPath = PUBLIC_PATHS.some(
            p => location.pathname === p || location.pathname.startsWith(p)
          )

          if (!isPublicPath) {
            console.warn('[SessionGuard] Unexpected SIGNED_OUT — redirecting to /auth')
            navigate('/auth?reason=session_expired', { replace: true })
          }
          return
        }

        if (event === 'USER_UPDATED') {
          // Email change, password change etc — no redirect needed
          return
        }
      }
    )

    // Also run a one-time check on mount to catch sessions that
    // expired while the app was closed (e.g. user left the tab
    // open overnight and comes back the next morning)
    const checkSessionOnMount = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.warn('[SessionGuard] getSession error on mount:', error.message)
          return
        }

        if (!session) {
          // No session at all — fine if on a public page
          const isPublicPath = PUBLIC_PATHS.some(
            p => location.pathname === p || location.pathname.startsWith(p)
          )
          if (!isPublicPath) {
            console.warn('[SessionGuard] No session on mount — redirecting to /auth')
            navigate('/auth?reason=session_expired', { replace: true })
          }
          return
        }

        // Check if the session is expired
        const expiresAt  = session.expires_at // Unix timestamp in seconds
        const nowSeconds = Math.floor(Date.now() / 1000)
        const secsLeft   = expiresAt - nowSeconds

        if (secsLeft <= 0) {
          // Token is already expired — try to refresh it
          console.warn('[SessionGuard] Session expired on mount — attempting refresh')
          const { error: refreshError } = await supabase.auth.refreshSession()

          if (refreshError) {
            console.warn('[SessionGuard] Refresh failed on mount — redirecting to /auth')
            const isPublicPath = PUBLIC_PATHS.some(
              p => location.pathname === p || location.pathname.startsWith(p)
            )
            if (!isPublicPath) {
              navigate('/auth?reason=session_expired', { replace: true })
            }
          } else {
            console.log('[SessionGuard] ✅ Session refreshed on mount')
          }
        } else {
          console.log(`[SessionGuard] Session valid — expires in ${Math.round(secsLeft / 60)} minutes`)
        }

      } catch (err) {
        console.error('[SessionGuard] Unexpected error on mount check:', err.message)
      }
    }

    checkSessionOnMount()

    // Cleanup: unsubscribe when component unmounts
    return () => subscription.unsubscribe()
  }, [navigate, location.pathname])
}