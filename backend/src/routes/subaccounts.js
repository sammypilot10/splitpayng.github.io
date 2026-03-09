// ============================================================
// src/routes/subaccounts.js
// All routes that modify data are now protected with verifyAuth.
// ============================================================

const express    = require('express');
const router     = express.Router();
const supabase   = require('../utils/supabase');
const paystack   = require('../services/paystack');
const verifyAuth = require('../middleware/verifyAuth');

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 5;

// ─────────────────────────────────────────────────────────────
// GET /api/subaccounts/banks  — PUBLIC (no auth needed)
// ─────────────────────────────────────────────────────────────
router.get('/banks', async (req, res) => {
  try {
    const banks = await paystack.listBanks();
    return res.status(200).json({ banks });
  } catch (err) {
    console.error('[SUBACCOUNT] Failed to fetch banks:', err.message);
    return res.status(500).json({ error: 'Failed to fetch bank list.' });
  }
});


// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// GET /api/subaccounts/me  — PROTECTED
// Returns whether the user already has a payout account set up
// ─────────────────────────────────────────────────────────────
router.get('/me', verifyAuth, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('payout_subaccount_code, payout_account_number, payout_bank_code, full_name')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ hasAccount: false });
    }

    return res.status(200).json({
      hasAccount: !!profile.payout_subaccount_code,
      subaccount_code: profile.payout_subaccount_code || null,
      account_number: profile.payout_account_number || null,
    });
  } catch (err) {
    console.error('[SUBACCOUNT] /me error:', err.message);
    return res.status(500).json({ hasAccount: false });
  }
});

// POST /api/subaccounts/resolve  — PROTECTED
// ─────────────────────────────────────────────────────────────
router.post('/resolve', verifyAuth, async (req, res) => {
  const { account_number, bank_code } = req.body;

  if (!account_number || !bank_code) {
    return res.status(400).json({ error: 'account_number and bank_code are required.' });
  }

  try {
    const accountData = await paystack.resolveAccountNumber({
      accountNumber: account_number,
      bankCode:      bank_code,
    });

    return res.status(200).json({
      account_name:   accountData.account_name,
      account_number: accountData.account_number,
      bank_id:        accountData.bank_id,
    });
  } catch (err) {
    console.error('[SUBACCOUNT] Account resolve failed:', err.message);
    return res.status(422).json({
      error: 'Could not verify this bank account. Check the details and try again.',
    });
  }
});


// ─────────────────────────────────────────────────────────────
// POST /api/subaccounts/create  — PROTECTED
// Uses req.user.id from JWT — ignores any user_id in body.
// ─────────────────────────────────────────────────────────────
router.post('/create', verifyAuth, async (req, res) => {
  const { bank_code, account_number, account_name } = req.body;

  // Use the JWT user id — do NOT accept user_id from body
  const userId = req.user.id;

  if (!bank_code || !account_number || !account_name) {
    return res.status(400).json({
      error: 'bank_code, account_number, and account_name are required.',
    });
  }

  try {
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, payout_subaccount_code')
      .eq('id', userId)
      .single();

    if (profErr || !profile) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (profile.payout_subaccount_code) {
      return res.status(409).json({
        error:           'A payout account already exists for this user.',
        subaccount_code: profile.payout_subaccount_code,
      });
    }

    const subaccountData = await paystack.createSubaccount({
      businessName:     account_name,
      bankCode:         bank_code,
      accountNumber:    account_number,
      percentageCharge: PLATFORM_FEE_PERCENT,
    });

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        payout_bank_code:       String(bank_code),
        payout_account_number:  String(account_number),
        payout_subaccount_code: String(subaccountData.subaccount_code),
        updated_at:             new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) {
      console.error(
        `[SUBACCOUNT] ⚠️ Paystack subaccount created (${subaccountData.subaccount_code}) ` +
        `but failed to save to DB for user ${userId}:`,
        updateErr.message
      );
      return res.status(500).json({
        error:           'Payout account created but failed to save. Please contact support.',
        subaccount_code: subaccountData.subaccount_code,
      });
    }

    console.log(`[SUBACCOUNT] ✅ Subaccount created for user ${userId}: ${subaccountData.subaccount_code}`);

    return res.status(201).json({
      message:         'Payout account set up successfully.',
      subaccount_code: subaccountData.subaccount_code,
    });

  } catch (err) {
    console.error('[SUBACCOUNT] Creation error:', err.message);
    return res.status(500).json({ error: 'Failed to create payout account.' });
  }
});

module.exports = router;