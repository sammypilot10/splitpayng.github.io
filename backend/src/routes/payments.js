// ============================================================
// src/routes/payments.js
// Step 15: Email notifications added after charge.success
// and charge.failed webhook events.
// ============================================================

const express       = require('express')
const router        = express.Router()
const supabase      = require('../utils/supabase')
const paystack      = require('../services/paystack')
const verifyWebhook = require('../middleware/verifyWebhook')
const verifyAuth    = require('../middleware/verifyAuth')
const email         = require('../services/emailService')

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 5

// ─────────────────────────────────────────────────────────────
// POST /api/payments/initialize  — PROTECTED
// ─────────────────────────────────────────────────────────────
router.post('/initialize', verifyAuth, async (req, res) => {
  const { membership_id } = req.body
  const userId = req.user.id

  if (!membership_id) {
    return res.status(400).json({ error: 'membership_id is required.' })
  }

  try {
    const { data: membership, error: memErr } = await supabase
      .from('memberships')
      .select(`
        id, payment_status, pool_id,
        pools (
          id, service_name, split_price, is_public, pool_status, owner_id,
          profiles!pools_owner_id_fkey ( payout_subaccount_code )
        )
      `)
      .eq('id', membership_id)
      .eq('user_id', userId)
      .single()

    if (memErr || !membership) {
      return res.status(404).json({ error: 'Membership not found or does not belong to you.' })
    }

    const pool = membership.pools

    if (pool.pool_status !== 'active') {
      return res.status(400).json({ error: 'This pool is no longer active.' })
    }

    if (['active', 'in_escrow'].includes(membership.payment_status)) {
      return res.status(400).json({ error: 'Membership is already active or pending confirmation.' })
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (profErr || !profile) {
      return res.status(404).json({ error: 'User profile not found.' })
    }

    const splitPriceNaira  = parseFloat(pool.split_price)
    const platformFeeNaira = parseFloat((splitPriceNaira * PLATFORM_FEE_PERCENT / 100).toFixed(2))
    const subaccountCode   = pool.profiles?.payout_subaccount_code || null

    const paystackData = await paystack.initializeTransaction({
      email:            profile.email,
      amountNaira:      splitPriceNaira,
      membershipId:     membership_id,
      poolId:           pool.id,
      isPublicPool:     pool.is_public,
      subaccountCode,
      platformFeeNaira,
    })

    const { error: txnErr } = await supabase
      .from('transactions')
      .insert({
        membership_id,
        amount:             splitPriceNaira,
        platform_fee:       platformFeeNaira,
        paystack_reference: paystackData.reference,
        status:             'pending',
        transfer_status:    'not_initiated',
      })

    if (txnErr) {
      console.error('[INITIALIZE] Failed to create transaction record:', txnErr.message)
    }

    return res.status(200).json({
      authorization_url: paystackData.authorization_url,
      reference:         paystackData.reference,
      access_code:       paystackData.access_code,
    })

  } catch (err) {
    console.error('[INITIALIZE] Error:', err.message)
    return res.status(500).json({ error: 'Failed to initialize payment.' })
  }
})


// ─────────────────────────────────────────────────────────────
// POST /api/payments/retry-saved-card  — PROTECTED
// ─────────────────────────────────────────────────────────────
router.post('/retry-saved-card', verifyAuth, async (req, res) => {
  const { membership_id } = req.body
  const userId = req.user.id

  if (!membership_id) {
    return res.status(400).json({ error: 'membership_id is required.' })
  }

  try {
    const { data: membership, error: memErr } = await supabase
      .from('memberships')
      .select(`
        id, payment_status, paystack_auth_code, paystack_card_last4,
        pools (
          id, service_name, split_price, is_public, pool_status,
          profiles!pools_owner_id_fkey ( payout_subaccount_code )
        )
      `)
      .eq('id', membership_id)
      .eq('user_id', userId)
      .single()

    if (memErr || !membership) {
      return res.status(404).json({ error: 'Membership not found or does not belong to you.' })
    }

    if (membership.payment_status !== 'failed') {
      return res.status(400).json({ error: 'This membership does not have a failed payment.' })
    }

    if (!membership.paystack_auth_code) {
      return res.status(400).json({ error: 'No saved card found. Please use the new card option.', code: 'NO_SAVED_CARD' })
    }

    const pool = membership.pools
    if (pool.pool_status !== 'active') {
      return res.status(400).json({ error: 'This pool is no longer active.' })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!profile?.email) {
      return res.status(404).json({ error: 'User profile not found.' })
    }

    const splitPriceNaira  = parseFloat(pool.split_price)
    const platformFeeNaira = parseFloat((splitPriceNaira * PLATFORM_FEE_PERCENT / 100).toFixed(2))
    const amountKobo       = Math.round(splitPriceNaira * 100)
    const reference        = `RETRY-${membership_id}-${Date.now()}`

    const axios     = require('axios')
    const chargeRes = await axios.post(
      'https://api.paystack.co/transaction/charge_authorization',
      {
        email:              profile.email,
        amount:             amountKobo,
        authorization_code: membership.paystack_auth_code,
        reference,
        metadata: {
          membership_id,
          pool_id:        pool.id,
          is_public_pool: pool.is_public,
          retry:          true,
        },
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    )

    const chargeData = chargeRes.data?.data

    if (chargeData?.status === 'success') {
      await supabase
        .from('transactions')
        .insert({
          membership_id,
          amount:             splitPriceNaira,
          platform_fee:       platformFeeNaira,
          paystack_reference: reference,
          status:             pool.is_public ? 'in_escrow' : 'released',
          transfer_status:    'not_initiated',
        })

      await supabase
        .from('memberships')
        .update({
          payment_status:    pool.is_public ? 'in_escrow' : 'active',
          next_billing_date: getNextBillingDate(),
          updated_at:        new Date().toISOString(),
        })
        .eq('id', membership_id)

      // Email: notify member payment worked
      await email.sendMemberJoined({
        memberEmail: profile.email,
        memberName:  profile.full_name,
        serviceName: pool.service_name,
        splitPrice:  splitPriceNaira,
        isPublic:    pool.is_public,
        membershipId,
      })

      console.log(`[RETRY] ✅ Saved card success | membership: ${membership_id}`)
      return res.status(200).json({ success: true })
    } else {
      // Email: notify member it failed again
      await email.sendPaymentFailed({
        memberEmail: profile.email,
        memberName:  profile.full_name,
        serviceName: pool.service_name,
        splitPrice:  splitPriceNaira,
        membershipId,
      })

      console.warn(`[RETRY] ❌ Saved card declined | membership: ${membership_id}`)
      return res.status(402).json({ success: false, error: 'Card charge was declined. Please try a different payment method.' })
    }

  } catch (err) {
    console.error('[RETRY] Error:', err.response?.data || err.message)
    return res.status(500).json({ error: 'Failed to process retry. Please try again.' })
  }
})


// ─────────────────────────────────────────────────────────────
// POST /api/payments/webhook  — PUBLIC (Paystack calls this)
// ─────────────────────────────────────────────────────────────
router.post('/webhook', verifyWebhook, async (req, res) => {
  res.status(200).json({ received: true })

  const { event, data } = req.body
  console.log(`[WEBHOOK] Event: ${event} | Ref: ${data?.reference}`)

  try {
    switch (event) {
      case 'charge.success':    await handleChargeSuccess(data);   break
      case 'charge.failed':     await handleChargeFailed(data);    break
      case 'transfer.success':  await handleTransferSuccess(data); break
      case 'transfer.failed':
      case 'transfer.reversed': await handleTransferFailed(data);  break
      default:
        console.log(`[WEBHOOK] Unhandled event: ${event}`)
    }
  } catch (err) {
    console.error(`[WEBHOOK] Error processing ${event}:`, err.message)
  }
})


// ─────────────────────────────────────────────────────────────
// HANDLER: charge.success
// ─────────────────────────────────────────────────────────────
async function handleChargeSuccess(data) {
  const { reference, amount, customer, authorization, metadata } = data
  const membershipId = metadata?.membership_id
  const isPublicPool = metadata?.is_public_pool

  if (!membershipId) {
    console.warn('[WEBHOOK] charge.success missing membership_id in metadata')
    return
  }

  // ── IDEMPOTENCY CHECK ─────────────────────────────────────
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, status')
    .eq('paystack_reference', reference)
    .single()

  if (existing && existing.status !== 'pending') {
    console.log(`[WEBHOOK] ⏭ Already processed ref: ${reference}. Skipping.`)
    return
  }

  const amountNaira = amount / 100

  // Save card token for recurring billing
  if (authorization?.authorization_code && authorization?.reusable) {
    await supabase
      .from('memberships')
      .update({
        paystack_auth_code:  authorization.authorization_code,
        paystack_card_last4: authorization.last4,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', membershipId)
  }

  const escrowExpiresAt   = isPublicPool ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null
  const transactionStatus = isPublicPool ? 'in_escrow' : 'released'
  const membershipStatus  = isPublicPool ? 'in_escrow' : 'active'

  await supabase
    .from('transactions')
    .update({
      status:            transactionStatus,
      paystack_status:   'success',
      escrow_expires_at: escrowExpiresAt,
      transfer_status:   'not_initiated',
      updated_at:        new Date().toISOString(),
    })
    .eq('paystack_reference', reference)

  await supabase
    .from('memberships')
    .update({
      payment_status:    membershipStatus,
      next_billing_date: getNextBillingDate(),
      updated_at:        new Date().toISOString(),
    })
    .eq('id', membershipId)

  if (customer?.customer_code) {
    await supabase
      .from('profiles')
      .update({ paystack_customer_id: customer.customer_code })
      .eq('email', customer.email)
  }

  // ── EMAILS ─────────────────────────────────────────────────
  // Fetch member + pool details for emails
  const { data: membershipData } = await supabase
    .from('memberships')
    .select(`
      id, pool_id,
      profiles!memberships_user_id_fkey ( email, full_name ),
      pools (
        service_name, is_public, split_price, max_members, current_members,
        profiles!pools_owner_id_fkey ( email, full_name )
      )
    `)
    .eq('id', membershipId)
    .single()

  if (membershipData) {
    const member     = membershipData.profiles
    const pool       = membershipData.pools
    const host       = pool?.profiles

    // Email member: joined confirmation
    await email.sendMemberJoined({
      memberEmail: member.email,
      memberName:  member.full_name,
      serviceName: pool.service_name,
      splitPrice:  pool.split_price,
      isPublic:    pool.is_public,
      membershipId,
    })

    // Email member: escrow reminder (public pools only)
    if (isPublicPool && escrowExpiresAt) {
      await email.sendEscrowReminder({
        memberEmail: member.email,
        memberName:  member.full_name,
        serviceName: pool.service_name,
        expiresAt:   escrowExpiresAt,
        membershipId,
      })
    }

    // Email host if pool just became full
    const newCount = (pool.current_members || 0) + 1
    if (newCount >= pool.max_members && host?.email) {
      const monthlyEarnings = parseFloat(pool.split_price) * (pool.max_members - 1) * (1 - PLATFORM_FEE_PERCENT / 100)
      await email.sendPoolFull({
        hostEmail:       host.email,
        hostName:        host.full_name,
        serviceName:     pool.service_name,
        maxMembers:      pool.max_members,
        monthlyEarnings: monthlyEarnings,
      })
    }
  }

  console.log(`[WEBHOOK] ✅ charge.success | membership: ${membershipId} | status: ${membershipStatus} | ₦${amountNaira}`)
}


// ─────────────────────────────────────────────────────────────
// HANDLER: charge.failed
// ─────────────────────────────────────────────────────────────
async function handleChargeFailed(data) {
  const { reference, metadata } = data
  const membershipId = metadata?.membership_id
  if (!membershipId) return

  await supabase
    .from('transactions')
    .update({
      status:          'failed',
      paystack_status: 'failed',
      transfer_status: 'not_initiated',
      updated_at:      new Date().toISOString(),
    })
    .eq('paystack_reference', reference)

  await supabase
    .from('memberships')
    .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
    .eq('id', membershipId)

  // Email member about failed payment
  const { data: membershipData } = await supabase
    .from('memberships')
    .select(`
      id,
      profiles!memberships_user_id_fkey ( email, full_name ),
      pools ( service_name, split_price )
    `)
    .eq('id', membershipId)
    .single()

  if (membershipData) {
    await email.sendPaymentFailed({
      memberEmail: membershipData.profiles.email,
      memberName:  membershipData.profiles.full_name,
      serviceName: membershipData.pools.service_name,
      splitPrice:  membershipData.pools.split_price,
      membershipId,
    })
  }

  console.log(`[WEBHOOK] ❌ charge.failed | membership: ${membershipId}`)
}


// ─────────────────────────────────────────────────────────────
// HANDLER: transfer.success
// ─────────────────────────────────────────────────────────────
async function handleTransferSuccess(data) {
  const { reference, amount, recipient } = data

  await supabase
    .from('transactions')
    .update({
      transfer_status:    'success',
      transfer_reference: reference,
      notes:              `Payout of ₦${amount / 100} sent to ${recipient?.details?.account_number || 'host account'}.`,
      updated_at:         new Date().toISOString(),
    })
    .eq('transfer_reference', reference)

  console.log(`[WEBHOOK] ✅ transfer.success | ref: ${reference} | ₦${amount / 100}`)
}


// ─────────────────────────────────────────────────────────────
// HANDLER: transfer.failed / transfer.reversed
// ─────────────────────────────────────────────────────────────
async function handleTransferFailed(data) {
  const { reference, amount, reason, recipient } = data

  const failureNote = [
    `⚠️ Payout FAILED.`,
    `Amount: ₦${(amount || 0) / 100}.`,
    `Reason: ${reason || 'No reason provided by Paystack'}.`,
    `Requires manual review or retry.`,
  ].join(' ')

  await supabase
    .from('transactions')
    .update({
      transfer_status:         'failed',
      transfer_failure_reason: reason || 'Unknown failure reason from Paystack',
      notes:                   failureNote,
      updated_at:              new Date().toISOString(),
    })
    .eq('transfer_reference', reference)

  // Email host about payout failure
  const { data: txnData } = await supabase
    .from('transactions')
    .select(`
      amount, platform_fee,
      memberships (
        pools (
          service_name,
          profiles!pools_owner_id_fkey ( email, full_name )
        )
      )
    `)
    .eq('transfer_reference', reference)
    .single()

  if (txnData) {
    const host       = txnData.memberships?.pools?.profiles
    const hostAmount = parseFloat(txnData.amount) - parseFloat(txnData.platform_fee)
    if (host?.email) {
      await email.sendPayoutFailed({
        hostEmail:   host.email,
        hostName:    host.full_name,
        serviceName: txnData.memberships?.pools?.service_name,
        amount:      hostAmount,
        reason:      reason || 'Unknown error',
      })
    }
  }

  console.warn(`[WEBHOOK] ⚠️ Transfer FAILED | ref: ${reference} | reason: ${reason}`)
}


// ─────────────────────────────────────────────────────────────
// UTILITY: Next billing date
// ─────────────────────────────────────────────────────────────
function getNextBillingDate() {
  const next = new Date()
  next.setMonth(next.getMonth() + 1)
  return next.toISOString().split('T')[0]
}

module.exports = router