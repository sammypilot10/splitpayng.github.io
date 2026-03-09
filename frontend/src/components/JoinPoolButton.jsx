// ============================================================
// src/components/JoinPoolButton.jsx
// Drop-in replacement for the static "Join Pool" button.
//
// Step 17: useActionLock() prevents double-taps from firing
// two payment requests. The button locks on first click and
// stays locked until the async action fully resolves.
// ============================================================

import { useState }        from 'react'
import { useNavigate }     from 'react-router-dom'
import { usePayments }     from '../hooks/usePayments'
import { useAuth }         from '../context/AuthContext'
import { useActionLock }   from '../hooks/useDebounce'

export default function JoinPoolButton({ pool, style = {} }) {
  const { user }                     = useAuth()
  const { joinPool, error }          = usePayments()
  const navigate                     = useNavigate()
  const [localError, setLocalError]  = useState('')
  const [isLocked, runWithLock]      = useActionLock()

  const isFull    = pool.current_members >= pool.max_members
  const priceVal  = pool.split_price || pool.price || 0  // handles both real DB and mock data
  const isDisabled = isLocked || isFull

  const handleJoin = () => runWithLock(async () => {
    setLocalError('')

    // Not logged in — save intended pool and redirect to auth
    if (!user) {
      sessionStorage.setItem('joinAfterAuth', JSON.stringify({
        poolId:      pool.id,
        serviceName: pool.service_name,
      }))
      navigate('/auth')
      return
    }

    // Navigate to the join page for this pool
    navigate(`/join/${pool.id}`)
  })

  const displayError = localError || error

  return (
    <div>
      <button
        onClick={handleJoin}
        disabled={isDisabled}
        style={{
          fontFamily:    "'Plus Jakarta Sans', sans-serif",
          fontSize:      14,
          fontWeight:    600,
          color:         isDisabled ? '#AAA' : '#fff',
          background:    isFull ? '#E8E8E8' : isLocked ? '#5A8A72' : '#0B3D2E',
          border:        'none',
          borderRadius:  11,
          padding:       '11px 22px',
          cursor:        isDisabled ? 'not-allowed' : 'pointer',
          transition:    'all 0.18s',
          width:         '100%',
          ...style,
        }}
        onMouseEnter={e => {
          if (!isDisabled) e.currentTarget.style.background = '#1A5C42'
        }}
        onMouseLeave={e => {
          if (!isDisabled) e.currentTarget.style.background = isFull ? '#E8E8E8' : '#0B3D2E'
        }}
      >
        {isFull
          ? 'Pool Full'
          : isLocked
            ? 'Processing…'
            : `Join — ₦${Number(priceVal).toLocaleString()}/mo`}
      </button>

      {displayError && (
        <div style={{
          marginTop:  8,
          fontSize:   12,
          color:      '#C0392B',
          fontWeight: 500,
          lineHeight: 1.5,
        }}>
          ⚠ {displayError}
        </div>
      )}
    </div>
  )
}