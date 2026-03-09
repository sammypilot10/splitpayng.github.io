// ============================================================
// SplitPayNG — Express Server Entry Point
// src/server.js
// Step 11: Added /api/pools route for pool creation
// ============================================================

require('dotenv').config()
const express    = require('express')
const helmet     = require('helmet')
const cors       = require('cors')
const morgan     = require('morgan')
const rateLimit  = require('express-rate-limit')

const paymentRoutes    = require('./routes/payments')
const subaccountRoutes = require('./routes/subaccounts')
const escrowRoutes     = require('./routes/escrow')
const poolRoutes        = require('./routes/pools')
const membershipRoutes  = require('./routes/memberships')
const originGuard      = require('./middleware/originGuard')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Validate required env vars on startup ────────────────────
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAYSTACK_SECRET_KEY',
  'SUBSCRIPTION_ENCRYPTION_KEY',
  'CRON_SECRET',
  'ADMIN_SECRET_KEY',
  'FRONTEND_URL',
]
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k])
if (missingEnv.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnv.join(', '))
  process.exit(1)
}

// ── Security headers ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: [
        "'self'",
        'https://api.paystack.co',
        process.env.SUPABASE_URL,
      ],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  noSniff:        true,
  frameguard:     { action: 'deny' },
  hsts:           { maxAge: 31536000, includeSubDomains: true, preload: true },
  hidePoweredBy:  true,
  xssFilter:      true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}))

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:5173',
  methods:        ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Cron-Secret'],
  credentials:    true,
}))

// ── Raw body for Paystack webhook ─────────────────────────────
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') {
    let raw = ''
    req.on('data', chunk => { raw += chunk.toString() })
    req.on('end', () => {
      req.rawBody = raw
      try { req.body = JSON.parse(raw) } catch { req.body = {} }
      next()
    })
  } else {
    express.json({ limit: '10kb' })(req, res, next)
  }
})

// ── Origin guard ──────────────────────────────────────────────
app.use('/api', originGuard)

// ── Rate limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later.' },
})

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message:  { error: 'Too many payment requests. Slow down.' },
})

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// ── Routes ────────────────────────────────────────────────────
app.use('/api/payments',    apiLimiter,     paymentRoutes)
app.use('/api/subaccounts', apiLimiter,     subaccountRoutes)
app.use('/api/escrow',      apiLimiter,     escrowRoutes)
app.use('/api/pools',       apiLimiter,     poolRoutes)
app.use('/api/memberships', apiLimiter,     membershipRoutes)

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  })
})

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' })
})

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err)
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err.message,
  })
})

app.listen(PORT, () => {
  console.log(`✅ SplitPayNG backend running on port ${PORT}`)
  console.log(`🔒 Auth middleware active on all protected routes`)
  console.log(`🛡️  Origin guard active — allowing: ${process.env.FRONTEND_URL}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})

module.exports = app