// ============================================================
// src/routes/escrow.js
// Step 7: initiateHostPayout now records transfer_status,
// transfer_reference, and transfer_failure_reason on every
// attempt. Added GET /api/escrow/failed-transfers endpoint
// so admins can see all failed payouts and retry them.
// ============================================================

const express    = require('express')
const router     = express.Router()
const supabase   = require('../utils/supabase')
const paystack   = require('../services/paystack')
const verifyAuth = require("../middleware/verifyAuth")
const email      = require("../services/emailService")

// ─────────────────────────────────────────────────────────────
// POST /api/escrow/confirm  — PROTECTED
// ─────────────────────────────────────────────────────────────
router.post('/confirm', verifyAuth, async (req, res) => {
  const { transaction_id, membership_id } = req.body
  const userId = req.user.id // from verified JWT

  if (!transaction_id || !membership_id) {
    return res.status(400).json({ error: 'transaction_id and membership_id are required.' })
  }

  try {
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .select(`
        id, status, escrow_expires_at, amount, platform_fee,
        memberships (
          id, user_id, pool_id,
          pools (
            id, service_name, is_public,
            profiles!pools_owner_id_fkey (
              id, full_name, payout_subaccount_code,
              payout_bank_code, payout_account_number
            )
          )
        )
      `)
      .eq('id', transaction_id)
      .single()

    if (txnErr || !txn) {
      return res.status(404).json({ error: 'Transaction not found.' })
    }

    // Verify ownership via JWT
    if (txn.memberships.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to confirm this transaction.' })
    }

    if (txn.status !== 'in_escrow') {
      return res.status(400).json({ error: `Cannot confirm a transaction with status: ${txn.status}` })
    }

    // Release escrow
    await supabase
      .from('transactions')
      .update({
        status:     'released',
        notes:      'Member confirmed credentials. Funds released.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)

    // Activate membership
    await supabase
      .from('memberships')
      .update({ payment_status: 'active', updated_at: new Date().toISOString() })
      .eq('id', membership_id)

    // Trigger payout — transfer_status tracked inside
    await initiateHostPayout(txn)

    // Email host: member confirmed, payout is on the way
    const host       = txn.memberships?.pools?.profiles
    const hostAmount = parseFloat(txn.amount) - parseFloat(txn.platform_fee)
    if (host?.email) {
      const { data: memberProfile } = await supabase
        .from('profiles').select('full_name').eq('id', txn.memberships.user_id).single()
      await email.sendAccessConfirmed({
        hostEmail:   host.email,
        hostName:    host.full_name,
        memberName:  memberProfile?.full_name || 'A member',
        serviceName: txn.memberships?.pools?.service_name,
        payoutAmount: hostAmount,
      })
    }

    console.log(`[ESCROW] ✅ Confirmed by member | txn: ${transaction_id}`)
    return res.status(200).json({ message: 'Confirmed. Access is now fully active.' })

  } catch (err) {
    console.error('[ESCROW] Confirm error:', err.message)
    return res.status(500).json({ error: 'Failed to confirm escrow.' })
  }
})


// ─────────────────────────────────────────────────────────────
// POST /api/escrow/dispute  — PROTECTED
// ─────────────────────────────────────────────────────────────
router.post('/dispute', verifyAuth, async (req, res) => {
  const { transaction_id, membership_id, reason } = req.body
  const userId = req.user.id

  if (!transaction_id || !membership_id) {
    return res.status(400).json({ error: 'transaction_id and membership_id are required.' })
  }

  try {
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .select('id, status, memberships(user_id)')
      .eq('id', transaction_id)
      .single()

    if (txnErr || !txn) {
      return res.status(404).json({ error: 'Transaction not found.' })
    }

    if (txn.memberships.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized.' })
    }

    if (txn.status !== 'in_escrow') {
      return res.status(400).json({ error: `Cannot dispute a transaction with status: ${txn.status}` })
    }

    await supabase
      .from('transactions')
      .update({
        status:     'disputed',
        notes:      `Member raised dispute: "${reason || 'No reason provided'}"`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)

    await supabase
      .from('memberships')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', membership_id)

    console.log(`[ESCROW] ⚠️ Dispute raised | txn: ${transaction_id}`)

    // Email admin + host about dispute
    const { data: fullTxn } = await supabase
      .from('transactions')
      .select(`
        id,
        memberships (
          user_id,
          profiles!memberships_user_id_fkey ( full_name, email ),
          pools (
            service_name,
            profiles!pools_owner_id_fkey ( full_name, email )
          )
        )
      `)
      .eq('id', transaction_id)
      .single()

    if (fullTxn) {
      const member = fullTxn.memberships?.profiles
      const host   = fullTxn.memberships?.pools?.profiles
      await email.sendDisputeRaised({
        adminEmail:    process.env.ADMIN_EMAIL,
        hostEmail:     host?.email,
        hostName:      host?.full_name,
        memberName:    member?.full_name || 'A member',
        serviceName:   fullTxn.memberships?.pools?.service_name,
        reason,
        transactionId: transaction_id,
      })
    }

    return res.status(200).json({ message: 'Dispute raised. Our team will review within 24 hours.' })

  } catch (err) {
    console.error('[ESCROW] Dispute error:', err.message)
    return res.status(500).json({ error: 'Failed to raise dispute.' })
  }
})


// ─────────────────────────────────────────────────────────────
// POST /api/escrow/release  — CRON ONLY
// ─────────────────────────────────────────────────────────────
router.post('/release', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret']
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: 'Unauthorized.' })
  }

  try {
    const now = new Date().toISOString()

    const { data: expiredTxns, error: fetchErr } = await supabase
      .from('transactions')
      .select(`
        id, amount, platform_fee, membership_id,
        memberships (
          id, pool_id,
          pools (
            id, service_name,
            profiles!pools_owner_id_fkey (
              full_name, payout_subaccount_code,
              payout_bank_code, payout_account_number
            )
          )
        )
      `)
      .eq('status', 'in_escrow')
      .lt('escrow_expires_at', now)

    if (fetchErr) throw new Error(`Failed to fetch expired transactions: ${fetchErr.message}`)
    if (!expiredTxns || expiredTxns.length === 0) {
      return res.status(200).json({ message: 'No expired escrow transactions.', released: 0 })
    }

    console.log(`[ESCROW] Found ${expiredTxns.length} expired transaction(s) to release.`)
    const results = []

    for (const txn of expiredTxns) {
      try {
        await supabase
          .from('transactions')
          .update({
            status:     'released',
            notes:      'Auto-released after 48-hour escrow window expired.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', txn.id)

        await supabase
          .from('memberships')
          .update({ payment_status: 'active', updated_at: new Date().toISOString() })
          .eq('id', txn.membership_id)

        await initiateHostPayout(txn)
        results.push({ id: txn.id, status: 'released' })
        console.log(`[ESCROW] ✅ Auto-released txn ${txn.id}`)
      } catch (singleErr) {
        results.push({ id: txn.id, status: 'error', error: singleErr.message })
        console.error(`[ESCROW] Failed to release txn ${txn.id}:`, singleErr.message)
      }
    }

    return res.status(200).json({
      message:  'Escrow release complete.',
      released: results.filter(r => r.status === 'released').length,
      errors:   results.filter(r => r.status === 'error').length,
      results,
    })

  } catch (err) {
    console.error('[ESCROW] Release cron error:', err.message)
    return res.status(500).json({ error: 'Escrow release failed.' })
  }
})


// ─────────────────────────────────────────────────────────────
// GET /api/escrow/disputes  — ADMIN ONLY
// ─────────────────────────────────────────────────────────────
router.get('/disputes', requireAdmin, async (req, res) => {
  try {
    const { data: disputes, error } = await supabase
      .from('transactions')
      .select(`
        id, amount, status, notes, created_at,
        memberships (
          id, user_id,
          profiles!memberships_user_id_fkey (full_name, email),
          pools (
            id, service_name,
            profiles!pools_owner_id_fkey (full_name, email)
          )
        )
      `)
      .eq('status', 'disputed')
      .order('created_at', { ascending: false })

    if (error) throw error
    return res.status(200).json({ disputes })
  } catch (err) {
    console.error('[ESCROW] Disputes fetch error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch disputes.' })
  }
})


// ─────────────────────────────────────────────────────────────
// GET /api/escrow/failed-transfers  — ADMIN ONLY
// Step 7: New endpoint — lists all transactions where the
// payout to the host failed. Admins can see the reason and
// trigger a retry from the admin dashboard.
// ─────────────────────────────────────────────────────────────
router.get('/failed-transfers', requireAdmin, async (req, res) => {
  try {
    const { data: failures, error } = await supabase
      .from('transactions')
      .select(`
        id, amount, platform_fee, notes,
        transfer_status, transfer_reference, transfer_failure_reason,
        created_at, updated_at,
        memberships (
          id, pool_id,
          profiles!memberships_user_id_fkey (full_name, email),
          pools (
            service_name,
            profiles!pools_owner_id_fkey (
              full_name, email,
              payout_bank_code, payout_account_number
            )
          )
        )
      `)
      .eq('transfer_status', 'failed')
      .order('updated_at', { ascending: false })

    if (error) throw error

    console.log(`[ESCROW] Admin fetched ${failures?.length || 0} failed transfer(s)`)
    return res.status(200).json({
      count:    failures?.length || 0,
      failures: failures || [],
    })

  } catch (err) {
    console.error('[ESCROW] Failed transfers fetch error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch failed transfers.' })
  }
})


// ─────────────────────────────────────────────────────────────
// POST /api/escrow/retry-transfer  — ADMIN ONLY
// Step 7: Manually retry a failed payout to a host.
// Admins call this from the dashboard after a transfer fails.
// ─────────────────────────────────────────────────────────────
router.post('/retry-transfer', requireAdmin, async (req, res) => {
  const { transaction_id } = req.body

  if (!transaction_id) {
    return res.status(400).json({ error: 'transaction_id is required.' })
  }

  try {
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .select(`
        id, amount, platform_fee, transfer_status,
        memberships (
          id, pool_id,
          pools (
            service_name,
            profiles!pools_owner_id_fkey (
              full_name, payout_bank_code,
              payout_account_number, payout_subaccount_code
            )
          )
        )
      `)
      .eq('id', transaction_id)
      .single()

    if (txnErr || !txn) {
      return res.status(404).json({ error: 'Transaction not found.' })
    }

    // Only retry if the transfer actually failed
    if (txn.transfer_status !== 'failed') {
      return res.status(400).json({
        error: `Cannot retry a transfer with status: "${txn.transfer_status}". Only failed transfers can be retried.`,
      })
    }

    // Reset transfer_status to 'not_initiated' so initiateHostPayout
    // can update it to 'pending' then let the webhook update to 'success'/'failed'
    await supabase
      .from('transactions')
      .update({
        transfer_status:         'not_initiated',
        transfer_failure_reason: null,
        notes:                   `Admin manually retried payout on ${new Date().toLocaleDateString()}.`,
        updated_at:              new Date().toISOString(),
      })
      .eq('id', transaction_id)

    // Trigger the payout again
    await initiateHostPayout(txn)

    console.log(`[ESCROW] 🔄 Admin retried transfer for txn: ${transaction_id}`)
    return res.status(200).json({
      message: 'Transfer retry initiated. Check the failed-transfers list in a few minutes to confirm.',
    })

  } catch (err) {
    console.error('[ESCROW] Retry transfer error:', err.message)
    return res.status(500).json({ error: 'Failed to retry transfer.' })
  }
})


// ─────────────────────────────────────────────────────────────
// POST /api/escrow/resolve  — ADMIN ONLY
// ─────────────────────────────────────────────────────────────
router.post('/resolve', requireAdmin, async (req, res) => {
  const { transaction_id, action, admin_note } = req.body

  if (!transaction_id || !['refund', 'release'].includes(action)) {
    return res.status(400).json({
      error: 'transaction_id and action ("refund" or "release") are required.',
    })
  }

  try {
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .select(`
        id, amount, platform_fee, status, paystack_reference, membership_id,
        memberships (
          id, user_id, pool_id,
          profiles!memberships_user_id_fkey (email),
          pools (
            profiles!pools_owner_id_fkey (
              full_name, payout_subaccount_code,
              payout_bank_code, payout_account_number
            )
          )
        )
      `)
      .eq('id', transaction_id)
      .single()

    if (txnErr || !txn) {
      return res.status(404).json({ error: 'Transaction not found.' })
    }

    if (txn.status !== 'disputed') {
      return res.status(400).json({ error: 'Transaction is not in disputed state.' })
    }

    if (action === 'release') {
      await supabase
        .from('transactions')
        .update({
          status:     'released',
          notes:      `Admin released to host. ${admin_note || ''}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction_id)

      await supabase
        .from('memberships')
        .update({ payment_status: 'active', updated_at: new Date().toISOString() })
        .eq('id', txn.membership_id)

      await initiateHostPayout(txn)

      console.log(`[ESCROW] ✅ Admin released txn ${transaction_id} to host`)
      return res.status(200).json({ message: 'Funds released to host.' })

    } else {
      // ── REFUND via Paystack API ───────────────────────────
      try {
        const axios = require('axios')
        await axios.post(
          'https://api.paystack.co/refund',
          { transaction: txn.paystack_reference },
          { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
        )
        console.log(`[ESCROW] 💸 Paystack refund initiated | ref: ${txn.paystack_reference}`)
      } catch (refundErr) {
        console.error('[ESCROW] Paystack refund API call failed:', refundErr.message)
        return res.status(500).json({
          error: 'Refund failed at Paystack. Please initiate manually from the Paystack dashboard.',
        })
      }

      await supabase
        .from('transactions')
        .update({
          status:     'refunded',
          notes:      `Admin refunded member. ${admin_note || ''}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction_id)

      await supabase
        .from('memberships')
        .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', txn.membership_id)

      console.log(`[ESCROW] ✅ Admin refunded member for txn ${transaction_id}`)

      // Email member: refund initiated
      const memberProfile = txn.memberships?.profiles
      if (memberProfile?.email) {
        await email.sendDisputeResolved({
          memberEmail: memberProfile.email,
          memberName:  memberProfile.full_name,
          serviceName: txn.memberships?.pools?.service_name || 'your subscription',
          action:      'refund',
        })
      }

      return res.status(200).json({ message: 'Member refunded successfully.' })
    }

  } catch (err) {
    console.error('[ESCROW] Resolve error:', err.message)
    return res.status(500).json({ error: 'Failed to resolve dispute.' })
  }
})


// ─────────────────────────────────────────────────────────────
// UTILITY: Initiate payout to host's bank
// Step 7: Now records transfer_status, transfer_reference,
// and transfer_failure_reason on every attempt — success or fail.
// ─────────────────────────────────────────────────────────────
async function initiateHostPayout(txn) {
  const pool        = txn.memberships?.pools
  const hostProfile = pool?.profiles

  if (!hostProfile?.payout_bank_code || !hostProfile?.payout_account_number) {
    console.warn(`[ESCROW] Host has no payout bank details — skipping transfer for txn ${txn.id}`)

    // Record that transfer was skipped so it shows up for admin review
    await supabase
      .from('transactions')
      .update({
        transfer_status:         'failed',
        transfer_failure_reason: 'Host has not set up a payout bank account.',
        notes:                   '⚠️ Payout skipped — host has no bank account configured.',
        updated_at:              new Date().toISOString(),
      })
      .eq('id', txn.id)

    return
  }

  const hostAmountNaira = parseFloat(txn.amount) - parseFloat(txn.platform_fee)
  const transferRef     = `SPLITPAYNG-TXN-${txn.id}-${Date.now()}`

  try {
    // Mark as pending before we attempt — so if the process
    // crashes mid-way, we know a transfer was in flight
    await supabase
      .from('transactions')
      .update({
        transfer_status:    'pending',
        transfer_reference: transferRef,
        updated_at:         new Date().toISOString(),
      })
      .eq('id', txn.id)

    // Create the recipient and send the transfer
    const recipient = await paystack.createTransferRecipient({
      name:          hostProfile.full_name,
      bankCode:      hostProfile.payout_bank_code,
      accountNumber: hostProfile.payout_account_number,
    })

    await paystack.initiateTransfer({
      amountNaira:   hostAmountNaira,
      recipientCode: recipient.recipient_code,
      reason:        `SplitPayNG payout — ${pool?.service_name || 'Pool'} — Txn ${txn.id}`,
      reference:     transferRef,
    })

    // transfer_status will be updated to 'success' or 'failed'
    // by the transfer.success / transfer.failed webhook events
    console.log(`[ESCROW] 💸 Transfer initiated | ₦${hostAmountNaira} | ref: ${transferRef}`)

  } catch (err) {
    console.error(`[ESCROW] ⚠️ Transfer initiation failed for txn ${txn.id}:`, err.message)

    // Record the exact failure reason in the DB
    await supabase
      .from('transactions')
      .update({
        transfer_status:         'failed',
        transfer_failure_reason: err.message,
        notes:                   `⚠️ Payout FAILED. Reason: ${err.message}. Requires admin retry.`,
        updated_at:              new Date().toISOString(),
      })
      .eq('id', txn.id)

    // Email host about failed payout
    if (hostProfile?.email) {
      const hostAmount = parseFloat(txn.amount) - parseFloat(txn.platform_fee)
      await email.sendPayoutFailed({
        hostEmail:   hostProfile.email,
        hostName:    hostProfile.full_name,
        serviceName: pool?.service_name,
        amount:      hostAmount,
        reason:      err.message,
      })
    }
  }
}


// ─────────────────────────────────────────────────────────────
// MIDDLEWARE: Admin key guard
// ─────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key']
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Admin access required.' })
  }
  next()
}

module.exports = router