// ============================================================
// src/hooks/useSessionGuard.js
//
// Watches for session expiry and signs the user out cleanly.
// Reads from localStorage directly — avoids Supabase lock bug.
// ============================================================

import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const PUBLIC_PATHS = ['/', '/auth', '/payment/callback']
const CHECK_INTERVAL_MS = 60_000 // check every 60s

function getSessionFromStorage() {
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isTokenExpired(session) {
  if (!session?.expires_at) return false
  // expires_at is in seconds
  return Date.now() / 1000 > session.expires_at - 30
}

export function useSessionGuard() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const intervalRef = useRef(null)

  const handleExpiry = () => {
    supabase.auth.signOut().catch(() => {})
    localStorage.removeItem(
      Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token')) || ''
    )
    if (!PUBLIC_PATHS.includes(location.pathname) && !location.pathname.startsWith('/join')) {
      navigate('/auth?expired=1', { replace: true })
    }
  }

  useEffect(() => {
    // Initial check
    const session = getSessionFromStorage()
    if (session && isTokenExpired(session)) {
      handleExpiry()
      return
    }

    // Periodic check — no Supabase lock needed
    intervalRef.current = setInterval(() => {
      const s = getSessionFromStorage()
      if (s && isTokenExpired(s)) {
        handleExpiry()
      }
    }, CHECK_INTERVAL_MS)

    // Listen for Supabase auth events (sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        console.log('[SessionGuard] Auth event:', event)
      }
    })

    return () => {
      clearInterval(intervalRef.current)
      subscription?.unsubscribe()
    }
  }, [location.pathname])
}