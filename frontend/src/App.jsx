// ============================================================
// src/App.jsx
// Root component — sets up routing and auth provider.
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Marketplace      from './Marketplace'
import Auth             from './pages/Auth'
import Dashboard        from './pages/Dashboard'
import PaymentCallback  from './pages/PaymentCallback'
import MySubscriptions  from './pages/MySubscriptions'
import CreatePool       from './pages/CreatePool'
import PayoutSetup      from './pages/PayoutSetup'
import AdminDisputes    from './pages/AdminDisputes'
import RetryPayment     from './pages/RetryPayment'
import { useSessionGuard } from './hooks/useSessionGuard'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SessionGuardWrapper />
        <Routes>
          {/* Public routes */}
          <Route path="/"                  element={<Marketplace />} />
          <Route path="/auth"              element={<Auth />} />
          <Route path="/payment/callback"  element={<PaymentCallback />} />

          {/* Protected routes — must be logged in */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-subscriptions"
            element={
              <ProtectedRoute>
                <MySubscriptions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-pool"
            element={
              <ProtectedRoute>
                <CreatePool />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payout-setup"
            element={
              <ProtectedRoute>
                <PayoutSetup />
              </ProtectedRoute>
            }
          />
          {/* Admin route — guards itself via VITE_ADMIN_KEY env var */}
          <Route path="/admin/disputes" element={<AdminDisputes />} />
          <Route
            path="/retry-payment"
            element={
              <ProtectedRoute>
                <RetryPayment />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

// ── SessionGuardWrapper ───────────────────────────────────────
// Mounted inside BrowserRouter so it has access to useNavigate.
// Runs useSessionGuard silently in the background on every page.
function SessionGuardWrapper() {
  useSessionGuard()
  return null
}