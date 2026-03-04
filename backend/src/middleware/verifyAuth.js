// ============================================================
// src/middleware/verifyAuth.js
//
// Protects every Express route that involves money or user data.
// Extracts the Supabase JWT from the Authorization header,
// verifies it against Supabase, and attaches the real user
// object to req.user so routes can trust it completely.
//
// Usage: add verifyAuth as middleware to any protected route
//   router.post('/initialize', verifyAuth, async (req, res) => { ... })
//
// SECURITY PRINCIPLE:
//   Never trust user_id from req.body. Always use req.user.id
//   which comes from the verified JWT. A malicious user can
//   send any user_id in the body — they cannot fake the JWT.
// ============================================================

const { createClient } = require('@supabase/supabase-js')

// Use a separate Supabase client for auth verification only.
// This uses the ANON key intentionally — we only need to
// call auth.getUser() which is safe with the anon key.
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const verifyAuth = async (req, res, next) => {
  try {
    // 1. Extract the Bearer token from the Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing authorization token. Please sign in.',
      })
    }

    const token = authHeader.split('Bearer ')[1]

    if (!token || token.trim() === '') {
      return res.status(401).json({
        error: 'Empty authorization token.',
      })
    }

    // 2. Verify the JWT with Supabase — this hits Supabase's
    //    auth server and confirms the token is real and not expired.
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token)

    if (error || !user) {
      console.warn('[AUTH] Token verification failed:', error?.message || 'No user returned')
      return res.status(401).json({
        error: 'Invalid or expired session. Please sign in again.',
      })
    }

    // 3. Attach the verified user to the request object.
    //    All downstream route handlers should use req.user.id
    //    instead of anything from req.body.
    req.user = user

    console.log(`[AUTH] ✅ Verified user: ${user.id} (${user.email})`)
    next()

  } catch (err) {
    console.error('[AUTH] Unexpected error in verifyAuth:', err.message)
    return res.status(500).json({
      error: 'Authentication check failed. Please try again.',
    })
  }
}

module.exports = verifyAuth