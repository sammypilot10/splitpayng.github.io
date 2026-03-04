// ============================================================
// src/components/ProtectedRoute.jsx
// Wrap any route with this to require authentication.
// Redirects to /auth if the user is not logged in.
// Shows a spinner while the session is being checked.
// ============================================================

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  // Still checking session — show a minimal spinner
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#F4EFE6',
      }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #E2DAD0',
          borderTopColor: '#0B3D2E', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Not logged in — redirect to auth page
  if (!user) return <Navigate to="/auth" replace />

  // Logged in — render the protected page
  return children
}
