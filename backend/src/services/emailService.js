// ============================================================
// src/services/emailService.js
//
// All transactional emails for SplitPayNG.
// Uses Resend (https://resend.com) — simple API, great delivery.
//
// SETUP:
//   1. Sign up at resend.com (free tier: 3,000 emails/month)
//   2. Add and verify your domain (e.g. splitpayng.com)
//   3. Add RESEND_API_KEY=re_xxxx to your backend .env
//   4. Add EMAIL_FROM=noreply@splitpayng.com to your .env
//
// EMAILS SENT:
//   - member_joined       → member: "You joined {service}"
//   - escrow_reminder     → member: "Confirm your access within 48hrs"
//   - access_confirmed    → host:   "Member confirmed — payout sent"
//   - dispute_raised      → admin + host: "Member raised a dispute"
//   - dispute_resolved    → member: "Your dispute was resolved"
//   - payout_sent         → host:   "Your payout of ₦X is on the way"
//   - payout_failed       → host:   "Your payout failed — we're investigating"
//   - payment_failed      → member: "Your renewal payment failed"
//   - pool_full           → host:   "Your pool is now full"
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_ADDRESS   = process.env.EMAIL_FROM || 'SplitPayNG <noreply@splitpayng.com>'
const APP_URL        = process.env.FRONTEND_URL || 'http://localhost:5173'

// ── Core send function ────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[EMAIL] RESEND_API_KEY not set — email skipped:', subject)
    return
  }

  try {
    const axios    = require('axios')
    const response = await axios.post(
      'https://api.resend.com/emails',
      { from: FROM_ADDRESS, to: Array.isArray(to) ? to : [to], subject, html },
      { headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' } }
    )
    console.log(`[EMAIL] ✅ Sent "${subject}" to ${to}`)
    return response.data
  } catch (err) {
    // Email failure should NEVER crash a payment flow
    // Log the error but don't throw
    console.error(`[EMAIL] ❌ Failed to send "${subject}" to ${to}:`, err.response?.data || err.message)
  }
}


// ── Shared styles ─────────────────────────────────────────────
const baseStyle = `
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #F4EFE6;
  margin: 0; padding: 0;
`

function emailWrapper(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${baseStyle}">
  <div style="max-width:560px; margin:0 auto; padding:32px 16px;">

    <!-- Logo -->
    <div style="text-align:center; margin-bottom:28px;">
      <div style="display:inline-flex; align-items:center; gap:8px;">
        <div style="width:32px; height:32px; border-radius:8px; background:#0B3D2E;
          display:inline-flex; align-items:center; justify-content:center;
          color:#fff; font-size:16px; font-weight:800; font-family:sans-serif;">S</div>
        <span style="font-size:18px; font-weight:800; color:#111;">
          SplitPay<span style="color:#0B3D2E;">NG</span>
        </span>
      </div>
    </div>

    <!-- Card -->
    <div style="background:#fff; border:1px solid #E2DAD0; border-radius:20px;
      padding:36px 32px; box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      ${content}
    </div>

    <!-- Footer -->
    <div style="text-align:center; margin-top:24px; font-size:12px; color:#BBB; line-height:1.7;">
      SplitPayNG — Nigeria's subscription sharing platform.<br>
      <a href="${APP_URL}" style="color:#0B3D2E; text-decoration:none;">splitpayng.com</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/my-subscriptions" style="color:#AAA; text-decoration:none;">Manage subscriptions</a>
    </div>
  </div>
</body>
</html>`
}

function btn(text, url, color = '#0B3D2E') {
  return `
    <div style="text-align:center; margin:24px 0 8px;">
      <a href="${url}" style="display:inline-block; background:${color}; color:#fff;
        font-size:14px; font-weight:700; text-decoration:none;
        border-radius:12px; padding:14px 32px;">
        ${text}
      </a>
    </div>`
}

function divider() {
  return `<div style="height:1px; background:#F0EDE8; margin:20px 0;"></div>`
}

function infoRow(label, value) {
  return `
    <div style="display:flex; justify-content:space-between; padding:9px 0;
      border-bottom:1px solid #F5F2EE; font-size:13.5px;">
      <span style="color:#888;">${label}</span>
      <span style="font-weight:600; color:#111;">${value}</span>
    </div>`
}

function amountBadge(amount) {
  return `
    <div style="background:#E8F5EF; border:1px solid #C5E0D4; border-radius:14px;
      padding:18px; text-align:center; margin:20px 0;">
      <div style="font-size:11px; font-weight:700; letter-spacing:1px;
        text-transform:uppercase; color:#5A8A72; margin-bottom:6px;">Amount</div>
      <div style="font-size:32px; font-weight:800; color:#0B3D2E; font-family:sans-serif;">
        ${amount}
      </div>
    </div>`
}


// ─────────────────────────────────────────────────────────────
// 1. MEMBER JOINED — sent to member after successful payment
// ─────────────────────────────────────────────────────────────
async function sendMemberJoined({ memberEmail, memberName, serviceName, splitPrice, isPublic, membershipId }) {
  const firstName = memberName?.split(' ')[0] || 'there'
  const price     = `₦${Number(splitPrice).toLocaleString()}`

  const html = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">🎉</div>
    <h1 style="font-size:22px; font-weight:800; color:#111; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      You're in, ${firstName}!
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Your payment was successful. You now have access to
      <strong style="color:#111;">${serviceName}</strong>.
    </p>

    ${amountBadge(price + '/month')}

    ${isPublic ? `
    <div style="background:#FEF3E2; border:1px solid #F0D5A0; border-radius:12px;
      padding:14px 18px; margin:20px 0; font-size:13.5px; color:#7A5010; line-height:1.6;">
      <strong>⏰ Action required:</strong> You have <strong>48 hours</strong> to confirm the
      login credentials work. Visit your subscriptions page to confirm or raise a dispute.
    </div>
    ` : `
    <div style="background:#E8F5EF; border:1px solid #C5E0D4; border-radius:12px;
      padding:14px 18px; margin:20px 0; font-size:13.5px; color:#3A7A5A; line-height:1.6;">
      ✅ Your login credentials are now available in your subscriptions page.
    </div>
    `}

    ${btn('View My Subscriptions', `${APP_URL}/my-subscriptions`)}
  `)

  await sendEmail({ to: memberEmail, subject: `You've joined ${serviceName} on SplitPayNG`, html })
}


// ─────────────────────────────────────────────────────────────
// 2. ESCROW REMINDER — sent to member when escrow starts (public pools)
// ─────────────────────────────────────────────────────────────
async function sendEscrowReminder({ memberEmail, memberName, serviceName, expiresAt, membershipId }) {
  const firstName   = memberName?.split(' ')[0] || 'there'
  const expiryDate  = new Date(expiresAt).toLocaleString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  })

  const html = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">⏰</div>
    <h1 style="font-size:22px; font-weight:800; color:#111; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      Confirm your access
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Hi ${firstName}, please confirm that your
      <strong style="color:#111;">${serviceName}</strong> credentials work.
    </p>

    <div style="background:#FEF3E2; border:1px solid #F0D5A0; border-radius:14px;
      padding:20px 22px; margin:0 0 20px;">
      <div style="font-size:13px; font-weight:700; color:#C97B1A; margin-bottom:10px;">
        ⚠ Confirmation deadline
      </div>
      <div style="font-size:18px; font-weight:800; color:#7A5010;">${expiryDate}</div>
      <div style="font-size:12.5px; color:#A07030; margin-top:8px; line-height:1.5;">
        If you don't confirm before this time, your access will be
        auto-approved and the host will be paid.
      </div>
    </div>

    <p style="font-size:13.5px; color:#666; line-height:1.7; margin-bottom:0;">
      If the credentials <strong>don't work</strong>, tap the button below and click
      <strong>"Raise a Dispute"</strong> — we'll investigate and refund you if confirmed.
    </p>

    ${btn('Confirm or Dispute Access', `${APP_URL}/my-subscriptions`)}
  `)

  await sendEmail({ to: memberEmail, subject: `Action needed: Confirm your ${serviceName} access`, html })
}


// ─────────────────────────────────────────────────────────────
// 3. ACCESS CONFIRMED — sent to host when member confirms
// ─────────────────────────────────────────────────────────────
async function sendAccessConfirmed({ hostEmail, hostName, memberName, serviceName, payoutAmount }) {
  const firstName = hostName?.split(' ')[0] || 'there'
  const payout    = `₦${Number(payoutAmount).toLocaleString()}`

  const html = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">💸</div>
    <h1 style="font-size:22px; font-weight:800; color:#111; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      Payout on the way!
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Hi ${firstName}, <strong style="color:#111;">${memberName}</strong> confirmed their
      <strong style="color:#111;">${serviceName}</strong> access. Your payout has been initiated.
    </p>

    ${amountBadge(payout)}

    <p style="font-size:12.5px; color:#AAA; text-align:center; line-height:1.6; margin-top:16px;">
      Transfers typically arrive within 30 minutes. Check your dashboard for the latest status.
    </p>

    ${btn('View Dashboard', `${APP_URL}/dashboard`)}
  `)

  await sendEmail({ to: hostEmail, subject: `Payout initiated — ${serviceName}`, html })
}


// ─────────────────────────────────────────────────────────────
// 4. DISPUTE RAISED — sent to admin + host
// ─────────────────────────────────────────────────────────────
async function sendDisputeRaised({ adminEmail, hostEmail, hostName, memberName, serviceName, reason, transactionId }) {
  const disputeHtml = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">⚠️</div>
    <h1 style="font-size:22px; font-weight:800; color:#C97B1A; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      Dispute raised
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      <strong style="color:#111;">${memberName}</strong> has raised a dispute for
      <strong style="color:#111;">${serviceName}</strong>.
    </p>

    ${divider()}

    ${infoRow('Service',        serviceName)}
    ${infoRow('Member',         memberName)}
    ${infoRow('Host',           hostName)}
    ${infoRow('Transaction ID', transactionId)}

    <div style="background:#FEF3E2; border:1px solid #F0D5A0; border-radius:12px;
      padding:14px 18px; margin:20px 0;">
      <div style="font-size:12px; font-weight:700; color:#C97B1A; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.8px;">
        Member's complaint
      </div>
      <div style="font-size:13.5px; color:#7A5010; line-height:1.6;">
        "${reason || 'No reason provided.'}"
      </div>
    </div>

    ${btn('Review in Admin Center', `${APP_URL}/admin/disputes`, '#C97B1A')}
  `)

  // Send to admin
  if (adminEmail) {
    await sendEmail({
      to:      adminEmail,
      subject: `[Admin] Dispute raised — ${serviceName}`,
      html:    disputeHtml,
    })
  }

  // Notify host too
  const hostHtml = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">⚠️</div>
    <h1 style="font-size:22px; font-weight:800; color:#C97B1A; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      A member raised a dispute
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Hi ${hostName?.split(' ')[0] || 'there'}, a member has reported an issue with your
      <strong style="color:#111;">${serviceName}</strong> pool.
      Your payout is on hold while we investigate.
    </p>
    <p style="font-size:13.5px; color:#666; line-height:1.7;">
      Our team will review the dispute within <strong>24 hours</strong>.
      You don't need to do anything right now — we'll notify you once it's resolved.
    </p>
    ${btn('View Dashboard', `${APP_URL}/dashboard`)}
  `)

  await sendEmail({ to: hostEmail, subject: `Dispute raised on your ${serviceName} pool`, html: hostHtml })
}


// ─────────────────────────────────────────────────────────────
// 5. DISPUTE RESOLVED — sent to member
// ─────────────────────────────────────────────────────────────
async function sendDisputeResolved({ memberEmail, memberName, serviceName, action }) {
  const firstName = memberName?.split(' ')[0] || 'there'
  const isRefund  = action === 'refund'

  const html = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">
      ${isRefund ? '💸' : '✅'}
    </div>
    <h1 style="font-size:22px; font-weight:800; color:#111; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      Your dispute has been resolved
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Hi ${firstName}, we've finished reviewing your dispute for
      <strong style="color:#111;">${serviceName}</strong>.
    </p>

    <div style="background:${isRefund ? '#E8F0FF' : '#E8F5EF'};
      border:1px solid ${isRefund ? '#A0B8E0' : '#C5E0D4'};
      border-radius:14px; padding:20px 22px; margin:0 0 20px; text-align:center;">
      <div style="font-size:16px; font-weight:800;
        color:${isRefund ? '#2C5282' : '#0B3D2E'}; margin-bottom:8px;">
        ${isRefund ? '💰 Refund Approved' : '✅ Access Confirmed'}
      </div>
      <div style="font-size:13.5px; color:${isRefund ? '#4A6FA5' : '#3A7A5A'}; line-height:1.6;">
        ${isRefund
          ? 'Your refund has been initiated. It should appear in your account within 3–5 business days.'
          : 'The access has been confirmed as working. Your subscription is now active.'}
      </div>
    </div>

    ${btn('View My Subscriptions', `${APP_URL}/my-subscriptions`)}
  `)

  await sendEmail({
    to:      memberEmail,
    subject: `Dispute resolved — ${isRefund ? 'Refund initiated' : 'Access confirmed'} for ${serviceName}`,
    html,
  })
}


// ─────────────────────────────────────────────────────────────
// 6. PAYOUT FAILED — sent to host
// ─────────────────────────────────────────────────────────────
async function sendPayoutFailed({ hostEmail, hostName, serviceName, amount, reason }) {
  const firstName = hostName?.split(' ')[0] || 'there'
  const payout    = `₦${Number(amount).toLocaleString()}`

  const html = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">❌</div>
    <h1 style="font-size:22px; font-weight:800; color:#C0392B; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      Payout failed
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Hi ${firstName}, we were unable to transfer your
      <strong style="color:#111;">${payout}</strong> payout for
      <strong style="color:#111;">${serviceName}</strong>.
    </p>

    <div style="background:#FEF0F0; border:1px solid #FACACC; border-radius:12px;
      padding:14px 18px; margin:0 0 20px;">
      <div style="font-size:12px; font-weight:700; color:#C0392B; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.8px;">
        Failure reason
      </div>
      <div style="font-size:13.5px; color:#922B21; line-height:1.6;">
        ${reason || 'Unknown error from Paystack.'}
      </div>
    </div>

    <p style="font-size:13.5px; color:#666; line-height:1.7;">
      Our team has been notified and will retry the transfer.
      Please ensure your bank account details are correct in your payout settings.
    </p>

    ${btn('Check Payout Settings', `${APP_URL}/payout-setup`)}
  `)

  await sendEmail({ to: hostEmail, subject: `Payout failed — ${serviceName} (${payout})`, html })
}


// ─────────────────────────────────────────────────────────────
// 7. PAYMENT FAILED (recurring) — sent to member
// ─────────────────────────────────────────────────────────────
async function sendPaymentFailed({ memberEmail, memberName, serviceName, splitPrice, membershipId }) {
  const firstName = memberName?.split(' ')[0] || 'there'
  const price     = `₦${Number(splitPrice).toLocaleString()}`

  const html = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">💳</div>
    <h1 style="font-size:22px; font-weight:800; color:#C0392B; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      Payment failed
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Hi ${firstName}, your monthly payment of
      <strong style="color:#111;">${price}</strong> for
      <strong style="color:#111;">${serviceName}</strong> didn't go through.
    </p>

    <div style="background:#FEF0F0; border:1px solid #FACACC; border-radius:12px;
      padding:14px 18px; margin:0 0 20px; font-size:13.5px; color:#922B21; line-height:1.6;">
      ⚠ Your access may be suspended until payment is completed.
      No money has been deducted from your account.
    </div>

    <p style="font-size:13.5px; color:#666; line-height:1.7; margin-bottom:0;">
      Tap below to retry with your saved card or use a new payment method.
    </p>

    ${btn('Retry Payment Now', `${APP_URL}/retry-payment?membership_id=${membershipId}`, '#C0392B')}

    <p style="font-size:12px; color:#BBB; text-align:center; margin-top:16px;">
      If you believe this is an error, please contact us.
    </p>
  `)

  await sendEmail({ to: memberEmail, subject: `Payment failed — action needed for ${serviceName}`, html })
}


// ─────────────────────────────────────────────────────────────
// 8. POOL FULL — sent to host
// ─────────────────────────────────────────────────────────────
async function sendPoolFull({ hostEmail, hostName, serviceName, maxMembers, monthlyEarnings }) {
  const firstName = hostName?.split(' ')[0] || 'there'
  const earnings  = `₦${Number(monthlyEarnings).toLocaleString()}`

  const html = emailWrapper(`
    <div style="font-size:28px; text-align:center; margin-bottom:16px;">🎊</div>
    <h1 style="font-size:22px; font-weight:800; color:#0B3D2E; text-align:center;
      margin:0 0 8px; letter-spacing:-0.5px;">
      Your pool is full!
    </h1>
    <p style="font-size:14px; color:#888; text-align:center; margin:0 0 24px; line-height:1.7;">
      Congratulations ${firstName}! Your <strong style="color:#111;">${serviceName}</strong>
      pool has reached its maximum of <strong style="color:#111;">${maxMembers} members</strong>.
    </p>

    ${amountBadge(earnings + '/month')}

    <p style="font-size:12.5px; color:#AAA; text-align:center; line-height:1.6; margin-top:4px;">
      Estimated monthly earnings after platform fee
    </p>

    ${btn('View Dashboard', `${APP_URL}/dashboard`)}
  `)

  await sendEmail({ to: hostEmail, subject: `🎊 Your ${serviceName} pool is full!`, html })
}


// ── Exports ───────────────────────────────────────────────────
module.exports = {
  sendMemberJoined,
  sendEscrowReminder,
  sendAccessConfirmed,
  sendDisputeRaised,
  sendDisputeResolved,
  sendPayoutFailed,
  sendPaymentFailed,
  sendPoolFull,
}