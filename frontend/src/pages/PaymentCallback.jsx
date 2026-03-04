// ============================================================
// src/pages/PaymentCallback.jsx
// Updated to handle the new 'unauthorized' status from the
// security fix in paymentCallbackHandler.js
// ============================================================

import { usePaymentCallback } from '../utils/paymentCallbackHandler'

export default function PaymentCallback() {
  const { status, membership } = usePaymentCallback()

  const serviceName = membership?.pools?.service_name || 'your subscription'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%,100% { transform:scale(1); } 50% { transform:scale(1.08); } }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#F4EFE6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <div style={{
          background: '#fff', border: '1px solid #E2DAD0', borderRadius: 24,
          padding: '52px 44px', maxWidth: 420, width: '100%', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)', animation: 'fadeUp 0.4s ease both',
        }}>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:36 }}>
            <div style={{
              width:28, height:28, borderRadius:7, background:'#0B3D2E',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:14, fontWeight:800,
            }}>S</div>
            <span style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:16, fontWeight:700, color:'#111' }}>
              SplitPay<span style={{ color:'#0B3D2E' }}>NG</span>
            </span>
          </div>

          {/* ── VERIFYING ── */}
          {status === 'verifying' && (
            <>
              <div style={{
                width:56, height:56, borderRadius:'50%',
                border:'3px solid #E2DAD0', borderTopColor:'#0B3D2E',
                margin:'0 auto 24px', animation:'spin 0.8s linear infinite',
              }} />
              <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:22, fontWeight:800, letterSpacing:'-0.5px', color:'#111', marginBottom:10 }}>
                Verifying payment…
              </h2>
              <p style={{ fontSize:14, color:'#888', lineHeight:1.6 }}>
                Please wait while we confirm your payment with Paystack. This usually takes a few seconds.
              </p>
            </>
          )}

          {/* ── SUCCESS ── */}
          {status === 'success' && (
            <>
              <div style={{
                width:64, height:64, borderRadius:'50%',
                background:'#E8F5EF', border:'2px solid #C5E0D4',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28, margin:'0 auto 24px', animation:'pulse 0.6s ease',
              }}>✅</div>
              <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:24, fontWeight:800, letterSpacing:'-0.5px', color:'#111', marginBottom:10 }}>
                Payment confirmed!
              </h2>
              <p style={{ fontSize:14, color:'#666', lineHeight:1.6, marginBottom:20 }}>
                You've successfully joined <strong style={{ color:'#0B3D2E' }}>{serviceName}</strong>.
                You'll receive your login credentials shortly.
              </p>
              <div style={{ background:'#F4EFE6', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#888' }}>
                Redirecting you to your subscriptions…
              </div>
            </>
          )}

          {/* ── FAILED ── */}
          {status === 'failed' && (
            <>
              <div style={{
                width:64, height:64, borderRadius:'50%',
                background:'#FEF0F0', border:'2px solid #FACACC',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28, margin:'0 auto 24px',
              }}>❌</div>
              <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:24, fontWeight:800, letterSpacing:'-0.5px', color:'#111', marginBottom:10 }}>
                Payment failed
              </h2>
              <p style={{ fontSize:14, color:'#666', lineHeight:1.6, marginBottom:28 }}>
                Something went wrong with your payment. No money has been deducted. Please try again.
              </p>
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14, fontWeight:600,
                  color:'#fff', background:'#0B3D2E', border:'none', borderRadius:11,
                  padding:'13px 28px', cursor:'pointer', width:'100%',
                }}
              >← Back to Marketplace</button>
            </>
          )}

          {/* ── UNAUTHORIZED ── */}
          {status === 'unauthorized' && (
            <>
              <div style={{
                width:64, height:64, borderRadius:'50%',
                background:'#FEF3E2', border:'2px solid #F0D5A0',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:28, margin:'0 auto 24px',
              }}>🔒</div>
              <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:24, fontWeight:800, letterSpacing:'-0.5px', color:'#111', marginBottom:10 }}>
                Access denied
              </h2>
              <p style={{ fontSize:14, color:'#666', lineHeight:1.6, marginBottom:28 }}>
                This payment link does not belong to your account. Please sign in with the correct account.
              </p>
              <button
                onClick={() => window.location.href = '/auth'}
                style={{
                  fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:14, fontWeight:600,
                  color:'#fff', background:'#0B3D2E', border:'none', borderRadius:11,
                  padding:'13px 28px', cursor:'pointer', width:'100%',
                }}
              >Sign In →</button>
            </>
          )}

        </div>
      </div>
    </>
  )
}