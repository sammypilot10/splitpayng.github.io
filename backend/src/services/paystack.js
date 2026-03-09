// ============================================================
// src/services/paystack.js
// Thin wrapper around the Paystack REST API.
// All amounts are in KOBO (Naira × 100).
// ============================================================

const axios = require('axios');

// Axios instance pre-configured for Paystack
const paystackClient = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s timeout
});

// ── Helper: convert Naira → Kobo ─────────────────────────────
const toKobo = (naira) => Math.round(naira * 100);

// ── 1. Initialize a transaction ──────────────────────────────
// Returns a Paystack checkout URL for the user to pay.
const initializeTransaction = async ({
  email,
  amountNaira,
  membershipId,
  poolId,
  isPublicPool,
  subaccountCode,   // Host's Paystack subaccount (for split)
  platformFeeNaira, // Your cut in Naira
}) => {
  const payload = {
    email,
    amount: toKobo(amountNaira),
    currency: 'NGN',
    metadata: {
      membership_id: membershipId,  // ← Critical: ties payment to a membership row
      pool_id: poolId,
      is_public_pool: isPublicPool,
      custom_fields: [
        { display_name: 'Pool ID',      variable_name: 'pool_id',      value: poolId },
        { display_name: 'Membership ID', variable_name: 'membership_id', value: membershipId },
      ],
    },
  };

  // If the pool has a host subaccount, set up the split
  if (subaccountCode) {
    payload.subaccount = subaccountCode;
    // 'flat' means the bearer_subaccount receives (amount - platform_fee)
    payload.transaction_charge = toKobo(platformFeeNaira);
    payload.bearer = 'subaccount'; // Host pays their own Paystack fees
  }

  const { data } = await paystackClient.post('/transaction/initialize', payload);
  return data.data; // { authorization_url, access_code, reference }
};

// ── 2. Verify a transaction (used for manual checks) ─────────
const verifyTransaction = async (reference) => {
  const { data } = await paystackClient.get(`/transaction/verify/${reference}`);
  return data.data;
};

// ── 3. Charge a saved card (recurring billing) ───────────────
// Uses the authorization_code stored after the first payment.
const chargeAuthorization = async ({
  authorizationCode,
  email,
  amountNaira,
  membershipId,
  poolId,
  subaccountCode,
  platformFeeNaira,
}) => {
  const payload = {
    authorization_code: authorizationCode,
    email,
    amount: toKobo(amountNaira),
    currency: 'NGN',
    metadata: {
      membership_id: membershipId,
      pool_id: poolId,
      is_recurring: true,
    },
  };

  if (subaccountCode) {
    payload.subaccount = subaccountCode;
    payload.transaction_charge = toKobo(platformFeeNaira);
    payload.bearer = 'subaccount';
  }

  const { data } = await paystackClient.post('/transaction/charge_authorization', payload);
  return data.data; // { status, reference, amount, ... }
};

// ── 4. Create a subaccount for a Host ────────────────────────
// Called when a Host sets up their payout bank details.
const createSubaccount = async ({
  businessName,
  bankCode,
  accountNumber,
  percentageCharge, // Platform's cut as a percentage (e.g. 5 for 5%)
}) => {
  const { data } = await paystackClient.post('/subaccount', {
    business_name: businessName,
    settlement_bank: bankCode,
    account_number: accountNumber,
    percentage_charge: percentageCharge,
    description: `SplitPayNG Host — ${businessName}`,
  });
  return data.data; // { subaccount_code, id, ... }
};

// ── 5. Initiate a transfer to a Host (post-escrow payout) ────
// Step 1: Create a transfer recipient from subaccount details.
const createTransferRecipient = async ({ name, bankCode, accountNumber }) => {
  const { data } = await paystackClient.post('/transferrecipient', {
    type: 'nuban',
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  });
  return data.data; // { recipient_code, ... }
};

// Step 2: Initiate the actual transfer.
const initiateTransfer = async ({ amountNaira, recipientCode, reason, reference }) => {
  const { data } = await paystackClient.post('/transfer', {
    source: 'balance',
    amount: toKobo(amountNaira),
    recipient: recipientCode,
    reason,
    reference,
  });
  return data.data; // { transfer_code, status, ... }
};

// ── 6. Fetch bank list (for Host onboarding UI) ──────────────
const listBanks = async () => {
  const { data } = await paystackClient.get('/bank?currency=NGN&per_page=100');
  return data.data;
};

// ── 7. Resolve account number (validate before saving) ───────
const resolveAccountNumber = async ({ accountNumber, bankCode }) => {
  const { data } = await paystackClient.get(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
  );
  return data.data; // { account_number, account_name, bank_id }
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  chargeAuthorization,
  createSubaccount,
  createTransferRecipient,
  initiateTransfer,
  listBanks,
  resolveAccountNumber,
};