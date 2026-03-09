const express    = require('express')
const router     = express.Router()
const crypto     = require('crypto')
const supabase   = require('../utils/supabase')
const verifyAuth = require('../middleware/verifyAuth')

const ENCRYPTION_KEY = process.env.SUBSCRIPTION_ENCRYPTION_KEY

function hashPoolPassword(plaintext) {
  return crypto.createHash('sha256').update(plaintext.trim()).digest('hex')
}

function decryptPassword(encryptedBase64) {
  try {
    if (!ENCRYPTION_KEY || !encryptedBase64) return null
    const buf     = Buffer.from(encryptedBase64, 'base64')
    const key     = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
    const iv      = buf.slice(0, 16)
    const authTag = buf.slice(16, 32)
    const ciphertext = buf.slice(32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8')
  } catch (e) {
    console.error('[DECRYPT] Failed:', e.message)
    return null
  }
}

// GET /api/memberships/mine
router.get('/mine', verifyAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select(`
        id,
        payment_status,
        pool_id,
        pools (
          id,
          service_name,
          category,
          split_price,
          max_members,
          current_members,
          pool_status,
          is_public,
          service_login_email,
          encrypted_service_password
        )
      `)
      .eq('user_id', req.user.id)

    if (error) throw error

    // Decrypt service password for each membership
    const memberships = (data || []).map(m => {
      const pool = m.pools
      let service_password = null
      if (pool?.encrypted_service_password) {
        service_password = decryptPassword(pool.encrypted_service_password)
      }
      return {
        ...m,
        pools: pool ? { ...pool, service_password, encrypted_service_password: undefined } : pool
      }
    })

    return res.status(200).json({ memberships })
  } catch (err) {
    console.error('[MEMBERSHIPS] /mine error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch your memberships.' })
  }
})

// POST /api/memberships/join
router.post('/join', verifyAuth, async (req, res) => {
  const { pool_id } = req.body
  if (!pool_id) return res.status(400).json({ error: 'pool_id is required.' })

  try {
    const { data: pool, error: poolErr } = await supabase
      .from('pools')
      .select('id, owner_id, max_members, current_members, pool_status, is_public, pool_password_hash')
      .eq('id', pool_id)
      .single()

    if (poolErr || !pool) return res.status(404).json({ error: 'Pool not found.' })
    if (pool.pool_status !== 'active') return res.status(400).json({ error: 'This pool is no longer active.' })
    if (pool.owner_id === req.user.id) return res.status(400).json({ error: 'You cannot join your own pool.' })
    if ((pool.current_members || 0) >= pool.max_members) return res.status(400).json({ error: 'This pool is full.' })

    // Private pool password check
    if (!pool.is_public) {
      const { pool_password } = req.body
      if (!pool_password?.trim()) {
        return res.status(403).json({ error: 'This is a private pool. A join password is required.', requires_password: true })
      }
      if (!pool.pool_password_hash) {
        return res.status(403).json({ error: 'This pool is not accessible.' })
      }
      const submitted = hashPoolPassword(pool_password)
      if (submitted !== pool.pool_password_hash) {
        return res.status(403).json({ error: 'Incorrect pool password.', requires_password: true })
      }
    }

    // Check not already a member
    const { data: existing } = await supabase
      .from('memberships')
      .select('id, payment_status')
      .eq('pool_id', pool_id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (existing) {
      // Always return membership_id so frontend can reuse it for pending payments
      const isActive = ['active', 'in_escrow'].includes(existing.payment_status)
      return res.status(409).json({
        error: isActive
          ? 'You are already an active member of this pool.'
          : 'You have a pending membership for this pool.',
        membership_id: isActive ? null : existing.id,
        is_active: isActive
      })
    }

    const { data: membership, error: insertErr } = await supabase
      .from('memberships')
      .insert({ pool_id, user_id: req.user.id, payment_status: 'pending' })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    return res.status(201).json({ membership_id: membership.id })
  } catch (err) {
    console.error('[MEMBERSHIPS] /join error:', err.message)
    return res.status(500).json({ error: 'Failed to join pool.' })
  }
})

module.exports = router