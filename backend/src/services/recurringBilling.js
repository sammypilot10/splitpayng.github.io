// ============================================================
// src/services/recurringBilling.js
//
// This script is run by a cron job (e.g. daily at 8am WAT).
// It finds all active memberships whose next_billing_date is
// today, and auto-charges their saved card via Paystack.
//
// Run manually:    node src/services/recurringBilling.js
// With pg_cron:    Schedule via Supabase or external cron (e.g. Railway)
// ============================================================

require('dotenv').config({ path: '../../.env' });
const supabase = require('../utils/supabase');
const paystack = require('./paystack');
const email    = require('./emailService');

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 5;

async function runRecurringBilling() {
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  console.log(`[BILLING] Starting recurring billing run for ${today}`);

  try {
    // 1. Find all memberships due for billing today
    const { data: dueMemberships, error: fetchErr } = await supabase
      .from('memberships')
      .select(`
        id, user_id, pool_id, paystack_auth_code,
        profiles!memberships_user_id_fkey (
          email, paystack_customer_id
        ),
        pools (
          id, service_name, split_price, is_public,
          profiles!pools_owner_id_fkey (
            payout_subaccount_code
          )
        )
      `)
      .eq('payment_status', 'active')
      .eq('next_billing_date', today)
      .not('paystack_auth_code', 'is', null); // Only charge if we have a token

    if (fetchErr) throw fetchErr;

    if (!dueMemberships || dueMemberships.length === 0) {
      console.log('[BILLING] No memberships due today.');
      return;
    }

    console.log(`[BILLING] Found ${dueMemberships.length} membership(s) to bill.`);

    const results = { success: 0, failed: 0, errors: [] };

    for (const membership of dueMemberships) {
      try {
        await billMembership(membership);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ membership_id: membership.id, error: err.message });
        console.error(`[BILLING] ❌ Failed to bill membership ${membership.id}:`, err.message);
      }
    }

    console.log(`[BILLING] Run complete | ✅ ${results.success} | ❌ ${results.failed}`);
    if (results.errors.length > 0) {
      console.error('[BILLING] Errors:', JSON.stringify(results.errors, null, 2));
    }

  } catch (err) {
    console.error('[BILLING] Fatal error in billing run:', err.message);
    process.exit(1);
  }
}

// ── Bill a single membership ──────────────────────────────────
async function billMembership(membership) {
  const pool          = membership.pools;
  const userProfile   = membership.profiles;
  const splitPrice    = parseFloat(pool.split_price);
  const platformFee   = parseFloat((splitPrice * PLATFORM_FEE_PERCENT / 100).toFixed(2));
  const subaccount    = pool.profiles?.payout_subaccount_code || null;

  console.log(`[BILLING] Charging membership ${membership.id} | ₦${splitPrice} | ${userProfile.email}`);

  // 1. Charge the saved card
  const chargeResult = await paystack.chargeAuthorization({
    authorizationCode: membership.paystack_auth_code,
    email:             userProfile.email,
    amountNaira:       splitPrice,
    membershipId:      membership.id,
    poolId:            pool.id,
    subaccountCode:    subaccount,
    platformFeeNaira:  platformFee,
  });

  // Paystack charge_authorization can succeed or fail synchronously
  if (chargeResult.status !== 'success') {
    // Mark as failed — webhook will also fire but this is a quick fallback
    await supabase
      .from('memberships')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', membership.id);

    // Email the member about the failed recurring payment
    await email.sendPaymentFailed({
      memberEmail: userProfile.email,
      memberName:  userProfile.full_name || userProfile.email,
      serviceName: pool.service_name,
      splitPrice:  splitPrice,
      membershipId: membership.id,
    });

    throw new Error(`Charge failed with status: ${chargeResult.status}`);
  }

  // 2. Create a new transaction record for this billing cycle
  const escrowExpiresAt = pool.is_public
    ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  await supabase
    .from('transactions')
    .insert({
      membership_id:      membership.id,
      amount:             splitPrice,
      platform_fee:       platformFee,
      paystack_reference: chargeResult.reference,
      paystack_status:    'success',
      status:             pool.is_public ? 'in_escrow' : 'released',
      escrow_expires_at:  escrowExpiresAt,
    });

  // 3. Advance next_billing_date by one month
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  const nextBillingDate = next.toISOString().split('T')[0];

  await supabase
    .from('memberships')
    .update({
      next_billing_date: nextBillingDate,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', membership.id);

  console.log(`[BILLING] ✅ Billed membership ${membership.id} | Next: ${nextBillingDate}`);
}

// Run immediately when called directly
runRecurringBilling();

module.exports = { runRecurringBilling };
