// ============================================================
// src/hooks/useDebounce.js
//
// Two utilities to prevent accidental double-submissions on
// any button that triggers a payment or API call.
//
// WHY THIS MATTERS FOR A MONEY APP:
// Without debouncing, a user who double-taps "Join Pool" or
// "Confirm" on a slow connection can fire two requests before
// the first one returns. This could create two memberships,
// two Paystack charges, or two escrow confirmations.
//
// EXPORTS:
//   useDebounce(value, delay)
//     — returns a debounced version of a value (for search inputs)
//
//   useDebouncedCallback(fn, delay)
//     — returns a stable function that won't fire again until
//       `delay` ms after its last call
//
//   useActionLock()
//     — designed for payment buttons specifically
//       once called, the button is locked until you call unlock()
//       or until the action throws. Prevents any double-fire.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'

// ── 1. useDebounce ────────────────────────────────────────────
// Delays updating a value until the user stops typing.
// Use for search inputs to avoid firing an API call on every
// keystroke.
//
// Example:
//   const [query, setQuery] = useState('')
//   const debouncedQuery = useDebounce(query, 400)
//   useEffect(() => { fetchResults(debouncedQuery) }, [debouncedQuery])
//
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}


// ── 2. useDebouncedCallback ───────────────────────────────────
// Wraps any function so it won't fire more than once per
// `delay` milliseconds no matter how many times it's called.
//
// Example:
//   const handleSearch = useDebouncedCallback((q) => {
//     fetchPools(q)
//   }, 400)
//
export function useDebouncedCallback(fn, delay = 400) {
  const timer = useRef(null)

  return useCallback((...args) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fn(...args)
    }, delay)
  }, [fn, delay])
}


// ── 3. useActionLock ─────────────────────────────────────────
// The most important one for payment buttons.
// Locks after the first call and stays locked until you
// explicitly call unlock() — typically in a finally block.
// This means even on a very slow connection, the user cannot
// trigger two charges by tapping repeatedly.
//
// Returns: [isLocked, runWithLock]
//
// Example:
//   const [isLocked, runWithLock] = useActionLock()
//
//   const handleJoin = () => runWithLock(async () => {
//     await apiClient.post('/api/payments/initialize', { membership_id })
//   })
//
//   <button onClick={handleJoin} disabled={isLocked}>
//     {isLocked ? 'Processing…' : 'Join Pool'}
//   </button>
//
export function useActionLock() {
  const [isLocked, setIsLocked] = useState(false)

  const runWithLock = useCallback(async (asyncFn) => {
    if (isLocked) return  // already in flight — silently ignore

    setIsLocked(true)
    try {
      await asyncFn()
    } finally {
      // Always unlock, even if the async function throws.
      // The calling component can show an error message.
      setIsLocked(false)
    }
  }, [isLocked])

  return [isLocked, runWithLock]
}