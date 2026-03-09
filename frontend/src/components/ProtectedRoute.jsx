import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requireAdmin = false }) {
    const { user, isAdmin, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F4EFE6]">
                <div className="w-9 h-9 border-[3px] border-[#E2DAD0] border-t-[#0B3D2E] rounded-full animate-spin" />
            </div>
        )
    }

    if (!user) {
        // Preserve routing intent
        return <Navigate to="/auth" state={{ from: location }} replace />
    }

    // Enforce role checks server/client side synchronously
    if (requireAdmin && !isAdmin) {
        console.warn(`[AUDIT] Unauthorized access attempt to protected route /admin by UID: ${user.id}`)
        return <Navigate to="/dashboard" replace />
    }

    return children
}
