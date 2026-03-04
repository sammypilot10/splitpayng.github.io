// ============================================================
// src/middleware/verifyWebhook.js
// CRITICAL SECURITY MIDDLEWARE
// Verifies that every webhook request genuinely came from
// Paystack by checking the HMAC-SHA512 signature.
// An attacker could fake a "payment succeeded" event without
// this check — always verify before processing.
// ============================================================

const crypto = require('crypto');

const verifyPaystackWebhook = (req, res, next) => {
  // 1. Grab the signature Paystack sent in the request header
  const paystackSignature = req.headers['x-paystack-signature'];

  if (!paystackSignature) {
    console.warn('[WEBHOOK] ⚠️  Request missing x-paystack-signature header');
    return res.status(400).json({ error: 'Missing webhook signature.' });
  }

  // 2. Recompute the expected signature using our secret key
  //    and the raw (unparsed) request body
  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody)   // ← Must be raw bytes, NOT JSON.parse'd object
    .digest('hex');

  // 3. Compare using timingSafeEqual to prevent timing attacks
  const sigBuffer      = Buffer.from(paystackSignature,   'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  const signaturesMatch =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!signaturesMatch) {
    console.warn('[WEBHOOK] ❌ Signature mismatch — possible spoofed request');
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  console.log('[WEBHOOK] ✅ Signature verified');
  next();
};

module.exports = verifyPaystackWebhook;
