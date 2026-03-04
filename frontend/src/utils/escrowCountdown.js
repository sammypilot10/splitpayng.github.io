// ============================================================
// src/utils/escrowCountdown.js
// A reusable hook that ticks down the 48-hour escrow window
// in real time on the member's screen.
//
// Usage:
//   const { hoursLeft, minutesLeft, isExpired, label } = useEscrowCountdown(escrowExpiresAt)
// ============================================================

import { useState, useEffect } from 'react'

export function useEscrowCountdown(escrowExpiresAt) {
  const [timeLeft, setTimeLeft] = useState(computeTimeLeft(escrowExpiresAt))

  useEffect(() => {
    if (!escrowExpiresAt) return
    const timer = setInterval(() => {
      setTimeLeft(computeTimeLeft(escrowExpiresAt))
    }, 60 * 1000) // Update every minute
    return () => clearInterval(timer)
  }, [escrowExpiresAt])

  return timeLeft
}

function computeTimeLeft(expiresAt) {
  if (!expiresAt) return { hoursLeft: 0, minutesLeft: 0, isExpired: true, label: 'Expired' }
  const msLeft = new Date(expiresAt) - Date.now()
  if (msLeft <= 0) return { hoursLeft: 0, minutesLeft: 0, isExpired: true, label: 'Expired' }
  const hoursLeft   = Math.floor(msLeft / (1000 * 60 * 60))
  const minutesLeft = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60))
  const label = hoursLeft > 0
    ? `${hoursLeft}h ${minutesLeft}m remaining`
    : `${minutesLeft}m remaining`
  return { hoursLeft, minutesLeft, isExpired: false, label }
}
