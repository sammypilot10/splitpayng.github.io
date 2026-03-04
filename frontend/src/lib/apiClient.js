// ============================================================
// src/lib/apiClient.js
//
// Central Axios instance used by every frontend hook and page.
//
// STEP 16 — Session expiry & token refresh handling:
//
// Problem: Supabase JWTs expire every 60 minutes. Previously,
// any 401 response immediately redirected the user to /auth,
// even if the session could have been silently refreshed.
// This caused users to be randomly logged out mid-session.
//
// Fix:
//   1. REQUEST interceptor: always use the freshest token by
//      calling getSession() which auto-refreshes if needed.
//
//   2. RESPONSE interceptor: if a 401 comes back (token
//      expired on the server side), we attempt one explicit
//      Supabase session refresh. If it works, we retry the
//      original request with the new token. If the refresh
//      also fails, THEN we redirect to /auth.
//
//   3. Refresh lock: prevents multiple parallel requests from
//      each triggering their own refresh simultaneously. Only
//      one refresh runs at a time — others wait for it.
// ============================================================

import axios   from 'axios'
import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Refresh lock ──────────────────────────────────────────────
// If multiple requests fail with 401 at the same time (common
// when a page loads several hooks in parallel), we only want
// ONE refresh call to Supabase. The others wait for it to
// resolve and then retry with the new token.
let isRefreshing     = false
let refreshListeners = []  // callbacks waiting for the new token

function subscribeToRefresh(callback) {
  refreshListeners.push(callback)
}

function notifyRefreshListeners(newToken) {
  refreshListeners.forEach(cb => cb(newToken))
  refreshListeners = []
}


// ── REQUEST interceptor ───────────────────────────────────────
// Runs before every outgoing request.
// getSession() internally checks if the token is close to
// expiry and silently refreshes it if so — Supabase handles
// this automatically. We just always use whatever it returns.
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch (err) {
      // If getSession fails, send the request without a token.
      // The server will return 401 and the response interceptor
      // will handle the redirect.
      console.warn('[apiClient] Could not get session:', err.message)
    }

    return config
  },
  (error) => Promise.reject(error)
)


// ── RESPONSE interceptor ──────────────────────────────────────
// Runs after every response comes back.
apiClient.interceptors.response.use(
  // Success — pass through unchanged
  (response) => response,

  // Error handler
  async (error) => {
    const originalRequest = error.config
    const status          = error.response?.status

    // ── Handle 401 Unauthorized ───────────────────────────
    // This means the JWT the server received was expired or invalid.
    // We attempt a session refresh before giving up.
    if (status === 401 && !originalRequest._retried) {

      // Mark this request so we don't retry it more than once
      originalRequest._retried = true

      if (isRefreshing) {
        // Another request is already refreshing — wait for it,
        // then retry this request with the new token.
        return new Promise((resolve, reject) => {
          subscribeToRefresh((newToken) => {
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(apiClient(originalRequest))
            } else {
              reject(error)
            }
          })
        })
      }

      // We are the first request to hit 401 — start the refresh
      isRefreshing = true
      console.warn('[apiClient] 401 received — attempting session refresh')

      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError || !data?.session?.access_token) {
          // Refresh failed — session is truly expired
          // Clear Supabase local storage and redirect to sign in
          console.warn('[apiClient] Session refresh failed — redirecting to /auth')
          isRefreshing = false
          notifyRefreshListeners(null)
          await supabase.auth.signOut()
          window.location.href = '/auth?reason=session_expired'
          return Promise.reject(error)
        }

        const newToken = data.session.access_token
        console.log('[apiClient] ✅ Session refreshed successfully')

        // Update the failed request with the new token and retry
        originalRequest.headers.Authorization = `Bearer ${newToken}`

        // Notify all other waiting requests
        isRefreshing = false
        notifyRefreshListeners(newToken)

        return apiClient(originalRequest)

      } catch (refreshErr) {
        isRefreshing = false
        notifyRefreshListeners(null)
        console.error('[apiClient] Session refresh threw an error:', refreshErr.message)
        await supabase.auth.signOut()
        window.location.href = '/auth?reason=session_expired'
        return Promise.reject(error)
      }
    }

    // ── Handle other errors ───────────────────────────────
    // Normalize the error message so every catch block in
    // hooks and pages gets a consistent { message } shape.
    const message = error.response?.data?.error
      || error.response?.data?.message
      || error.message
      || 'An unexpected error occurred.'

    // Attach the normalized message to the error object
    error.message = message

    return Promise.reject(error)
  }
)

export default apiClient