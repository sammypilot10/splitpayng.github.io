// ============================================================
// src/middleware/originGuard.js
//
// CSRF / Origin protection for all state-changing routes.
//
// WHY THIS MATTERS:
// Even with JWT auth, a malicious website could embed a form
// that submits to your API from a victim's browser. The browser
// sends the JWT from localStorage via JS — but it also sends
// the Origin header which reveals where the request came from.
// We reject any request whose Origin doesn't match our
// allowed frontend URL.
//
// Apply this to all POST/PATCH routes except the Paystack
// webhook (which has no Origin header — it comes from Paystack
// servers, not a browser).
//
// Usage:
//   router.post('/initialize', verifyAuth, originGuard, handler)
// ============================================================

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  // Add your production domain here when you deploy, e.g.:
  // 'https://splitpayng.com',
  // 'https://www.splitpayng.com',
]

const originGuard = (req, res, next) => {
  const origin  = req.headers.origin
  const referer = req.headers.referer

  // Paystack webhook has no origin — let verifyWebhook handle it
  if (req.path === '/webhook') {
    return next()
  }

  // If there's no origin header at all on a browser request,
  // something unusual is happening — reject it.
  // Note: curl/Postman won't have Origin, so we allow those
  // in development only to make testing possible.
  if (!origin) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[ORIGIN GUARD] ❌ Request blocked — no Origin header on ${req.method} ${req.path}`)
      return res.status(403).json({
        error: 'Request origin could not be verified.',
      })
    }
    // In development, allow requests without Origin (Postman, curl)
    console.warn(`[ORIGIN GUARD] ⚠️ No Origin header on ${req.method} ${req.path} — allowed in dev mode`)
    return next()
  }

  // Check the origin against our allowlist
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    // Exact match
    if (origin === allowed) return true
    // Strip trailing slash and compare
    if (origin.replace(/\/$/, '') === allowed.replace(/\/$/, '')) return true
    return false
  })

  if (!isAllowed) {
    console.warn(
      `[ORIGIN GUARD] ❌ Blocked request from unauthorized origin: "${origin}" ` +
      `on ${req.method} ${req.path}`
    )
    return res.status(403).json({
      error: 'Request origin is not authorized.',
    })
  }

  // Origin is valid — proceed
  next()
}

module.exports = originGuard