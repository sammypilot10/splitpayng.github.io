// ============================================================
// src/middleware/verifyAuth.js
// ============================================================

const { createClient } = require('@supabase/supabase-js')

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token. Please sign in.' })
    }

    const token = authHeader.split('Bearer ')[1]

    if (!token || token.trim() === '') {
      return res.status(401).json({ error: 'Empty authorization token.' })
    }

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)

    if (error || !user) {
      console.warn('[AUTH] Token verification failed:', error?.message || 'No user returned')
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' })
    }

    req.user = user
    console.log(`[AUTH] ✅ Verified user: ${user.id} (${user.email})`)
    next()

  } catch (err) {
    console.error('[AUTH] Unexpected error in verifyAuth:', err.message)
    return res.status(500).json({ error: 'Authentication check failed. Please try again.' })
  }
}

module.exports = verifyAuth