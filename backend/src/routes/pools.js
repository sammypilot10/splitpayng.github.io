// ============================================================
// src/routes/pools.js
// Pool management endpoints:
//   POST /api/pools/create  — host creates a new pool (PROTECTED)
//   PATCH /api/pools/:id    — host updates their pool (PROTECTED)
//   DELETE /api/pools/:id   — host closes their pool (PROTECTED)
//
// SECURITY: Password is encrypted server-side using
// SUBSCRIPTION_ENCRYPTION_KEY before being stored in Supabase.
// The raw password never touches the database.
// ============================================================

const express    = require('express')
const router     = express.Router()
const crypto     = require('crypto')
const supabase   = require('../utils/supabase')
const verifyAuth = require('../middleware/verifyAuth')

const ENCRYPTION_KEY = process.env.SUBSCRIPTION_ENCRYPTION_KEY

// ── Hash a pool join password ─────────────────────────────────
function hashPoolPassword(plaintext) {
  return crypto.createHash('sha256').update(plaintext.trim()).digest('hex')
}

// ── Encrypt the service password ─────────────────────────────
// Uses AES-256-GCM. The IV is prepended to the ciphertext so
// we can decrypt it later without storing it separately.
function encryptPassword(plaintext) {
  if (!ENCRYPTION_KEY) {
    throw new Error('SUBSCRIPTION_ENCRYPTION_KEY is not set.')
  }

  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  const iv  = crypto.randomBytes(16)

  const cipher     = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag    = cipher.getAuthTag()

  // Format: iv(16) + authTag(16) + ciphertext — all base64 encoded
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

// ─────────────────────────────────────────────────────────────
// POST /api/pools/create  — PROTECTED
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// GET /api/pools/mine  — PROTECTED — host's own pools
// ─────────────────────────────────────────────────────────────
router.get('/mine', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pools')
      .select(`
        id, service_name, category, split_price, max_members,
        current_members, is_public, pool_status,
        memberships ( id, payment_status, user_id )
      `)
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ pools: data || [] });
  } catch (err) {
    console.error('[POOLS] /mine error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch your pools.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/pools/public  — PUBLIC — marketplace listing
// ─────────────────────────────────────────────────────────────
router.get('/public', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pools')
      .select('id, service_name, category, split_price, max_members, current_members, is_public, pool_status')
      .eq('pool_status', 'active')
      .eq('is_public', true)      // ← Only show public pools in the marketplace
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ pools: data || [] });
  } catch (err) {
    console.error('[POOLS] /public error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch pools.' });
  }
});

router.post('/create', verifyAuth, async (req, res) => {
  const userId = req.user.id // from verified JWT

  const {
    service_name,
    category,
    description,
    total_cost,
    split_price,
    max_members,
    is_public,
    renewal_day,
    service_password,
    service_login_email,
  } = req.body

  // ── Validation ──────────────────────────────────────────
  const errors = []

  if (!service_name?.trim())
    errors.push('Service name is required.')

  if (!category)
    errors.push('Category is required.')

  if (!total_cost || isNaN(total_cost) || Number(total_cost) <= 0)
    errors.push('Total cost must be a positive number.')

  if (!split_price || isNaN(split_price) || Number(split_price) <= 0)
    errors.push('Split price must be a positive number.')

  if (!max_members || isNaN(max_members) || Number(max_members) < 2 || Number(max_members) > 10)
    errors.push('Max members must be between 2 and 10.')

  if (!renewal_day || isNaN(renewal_day) || Number(renewal_day) < 1 || Number(renewal_day) > 28)
    errors.push('Renewal day must be between 1 and 28.')

  if (!service_password?.trim())
    errors.push('Service password is required.')

  if (!service_login_email?.trim())
    errors.push('Service login email is required.')

  // Private pools must have a join password
  if (!is_public && !req.body.pool_password?.trim())
    errors.push('Private pools require a join password.')

  // Split price sanity check — can't be more than total cost
  if (Number(split_price) > Number(total_cost))
    errors.push('Split price cannot exceed the total subscription cost.')

  if (errors.length > 0) {
    return res.status(400).json({ errors })
  }

  try {
    // 1. Verify the user has a payout account set up
    //    (hosts must have bank details before creating public pools)
    if (is_public) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payout_subaccount_code')
        .eq('id', userId)
        .single()

      if (!profile?.payout_subaccount_code) {
        return res.status(400).json({
          error: 'You must set up your payout bank account before creating a public pool.',
          code:  'NO_PAYOUT_ACCOUNT',
        })
      }
    }

    // 2. Encrypt the service password on the server
    //    The raw password never goes into the database
    const encryptedPassword = encryptPassword(service_password.trim())

    // Hash the pool join password (only for private pools)
    const hashedPoolPassword = (!is_public && req.body.pool_password?.trim())
      ? hashPoolPassword(req.body.pool_password)
      : null

    // 3. Insert the pool into Supabase
    const { data: pool, error: insertErr } = await supabase
      .from('pools')
      .insert({
        owner_id:                   userId,
        service_name:               service_name.trim(),
        category,
        description:                description?.trim() || null,
        total_cost:                 Number(total_cost),
        split_price:                Number(split_price),
        max_members:                Number(max_members),
        current_members:            0,
        is_public:                  Boolean(is_public),
        renewal_day:                Number(renewal_day),
        pool_status:                'active',
        encrypted_service_password: encryptedPassword,
        service_login_email:        service_login_email.trim(),
        pool_password_hash:         hashedPoolPassword,  // null for public pools
      })
      .select('id, service_name, is_public, split_price, max_members')
      .single()

    if (insertErr) {
      console.error('[POOLS] Insert error:', insertErr.message)
      return res.status(500).json({ error: 'Failed to create pool. Please try again.' })
    }

    console.log(`[POOLS] ✅ Pool created | id: ${pool.id} | owner: ${userId} | "${pool.service_name}"`)

    return res.status(201).json({
      message: 'Pool created successfully.',
      pool,
    })

  } catch (err) {
    console.error('[POOLS] Create error:', err.message)
    return res.status(500).json({ error: 'Failed to create pool.' })
  }
})


// ─────────────────────────────────────────────────────────────
// PATCH /api/pools/:id  — PROTECTED
// Update pool details — owner only
// NOTE: Password update is handled separately and re-encrypted
// ─────────────────────────────────────────────────────────────
router.patch('/:id', verifyAuth, async (req, res) => {
  const userId = req.user.id
  const poolId = req.params.id

  const {
    description,
    renewal_day,
    pool_status,
    service_password,
    service_login_email,
  } = req.body

  try {
    // Verify ownership
    const { data: pool, error: fetchErr } = await supabase
      .from('pools')
      .select('id, owner_id')
      .eq('id', poolId)
      .single()

    if (fetchErr || !pool) {
      return res.status(404).json({ error: 'Pool not found.' })
    }

    if (pool.owner_id !== userId) {
      return res.status(403).json({ error: 'You do not own this pool.' })
    }

    // Build update object — only update fields that were provided
    const updates = { updated_at: new Date().toISOString() }

    if (description !== undefined)     updates.description         = description?.trim() || null
    if (renewal_day !== undefined)     updates.renewal_day         = Number(renewal_day)
    if (pool_status !== undefined)     updates.pool_status         = pool_status
    if (service_login_email !== undefined) updates.service_login_email = service_login_email.trim()

    // Re-encrypt password if it was updated
    if (service_password?.trim()) {
      updates.encrypted_service_password = encryptPassword(service_password.trim())
    }

    const { error: updateErr } = await supabase
      .from('pools')
      .update(updates)
      .eq('id', poolId)

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update pool.' })
    }

    console.log(`[POOLS] ✅ Pool updated | id: ${poolId} | owner: ${userId}`)
    return res.status(200).json({ message: 'Pool updated successfully.' })

  } catch (err) {
    console.error('[POOLS] Update error:', err.message)
    return res.status(500).json({ error: 'Failed to update pool.' })
  }
})


// ─────────────────────────────────────────────────────────────
// DELETE /api/pools/:id  — PROTECTED
// Soft-delete: sets pool_status = 'closed'
// We never hard delete pools — financial records must be kept
// ─────────────────────────────────────────────────────────────
router.delete('/:id', verifyAuth, async (req, res) => {
  const userId = req.user.id
  const poolId = req.params.id

  try {
    const { data: pool, error: fetchErr } = await supabase
      .from('pools')
      .select('id, owner_id, current_members')
      .eq('id', poolId)
      .single()

    if (fetchErr || !pool) {
      return res.status(404).json({ error: 'Pool not found.' })
    }

    if (pool.owner_id !== userId) {
      return res.status(403).json({ error: 'You do not own this pool.' })
    }

    if (pool.current_members > 0) {
      return res.status(400).json({
        error: 'Cannot close a pool with active members. Remove all members first.',
      })
    }

    await supabase
      .from('pools')
      .update({ pool_status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', poolId)

    console.log(`[POOLS] ✅ Pool closed | id: ${poolId} | owner: ${userId}`)
    return res.status(200).json({ message: 'Pool closed successfully.' })

  } catch (err) {
    console.error('[POOLS] Delete error:', err.message)
    return res.status(500).json({ error: 'Failed to close pool.' })
  }
})

module.exports = router