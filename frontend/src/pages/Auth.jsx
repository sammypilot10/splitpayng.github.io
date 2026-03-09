// ============================================================
// src/pages/Auth.jsx
// Sign In / Sign Up page using Supabase email+password auth.
// Matches the existing SplitPayNG design language.
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  page: {
    minHeight: '100vh',
    background: '#F4EFE6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2DAD0',
    borderRadius: 20,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 32, justifyContent: 'center',
  },
  logoMark: {
    width: 32, height: 32, borderRadius: 9,
    background: '#0B3D2E', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontSize: 16, fontWeight: 800,
  },
  logoText: {
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontSize: 18, fontWeight: 700, color: '#111',
  },
  title: {
    fontFamily: "'Bricolage Grotesque', sans-serif",
    fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px',
    color: '#111', marginBottom: 6, textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5, color: '#666', textAlign: 'center',
    marginBottom: 28, lineHeight: 1.5,
  },
  tabs: {
    display: 'flex', background: '#F4EFE6',
    borderRadius: 10, padding: 4, marginBottom: 28,
  },
  tab: {
    flex: 1, padding: '8px 0', border: 'none',
    borderRadius: 7, fontSize: 13.5, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.2s',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  label: {
    fontSize: 12.5, fontWeight: 600, color: '#444',
    marginBottom: 6, display: 'block', letterSpacing: '0.1px',
  },
  input: {
    width: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 14, color: '#111', background: '#FAFAF8',
    border: '1px solid #E2DAD0', borderRadius: 10,
    padding: '11px 14px', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
    marginBottom: 16,
  },
  btnPrimary: {
    width: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 14.5, fontWeight: 700, color: '#fff',
    background: '#0B3D2E', border: 'none',
    borderRadius: 11, padding: '13px 0',
    cursor: 'pointer', transition: 'all 0.2s', marginTop: 4,
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
  },
  divLine: { flex: 1, height: 1, background: '#E2DAD0' },
  divText: { fontSize: 12, color: '#BBB', fontWeight: 500 },
  btnMagic: {
    width: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 14, fontWeight: 600, color: '#0B3D2E',
    background: '#E8F5EF', border: '1px solid #C5E0D4',
    borderRadius: 11, padding: '12px 0',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  error: {
    background: '#FEF0F0', border: '1px solid #FACACC',
    borderRadius: 9, padding: '10px 14px',
    fontSize: 13, color: '#C0392B', marginBottom: 16,
  },
  success: {
    background: '#E8F5EF', border: '1px solid #C5E0D4',
    borderRadius: 9, padding: '10px 14px',
    fontSize: 13, color: '#0B3D2E', marginBottom: 16,
  },
}

export default function Auth() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('reason') === 'session_expired'
  const [tab,        setTab]        = useState('signin') // 'signin' | 'signup'
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [fullName,   setFullName]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [focusedEl,  setFocusedEl]  = useState(null)
  const [showPass,   setShowPass]   = useState(false)

  const clearMessages = () => { setError(''); setSuccess('') }

  // ── Listen for auth state and redirect ───────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check both redirect keys (JoinPoolButton uses joinAfterAuth)
        let redirectTo = sessionStorage.getItem('redirectAfterLogin')
        sessionStorage.removeItem('redirectAfterLogin')

        if (!redirectTo) {
          const joinData = sessionStorage.getItem('joinAfterAuth')
          if (joinData) {
            try {
              const { poolId } = JSON.parse(joinData)
              redirectTo = `/join/${poolId}`
            } catch {}
            sessionStorage.removeItem('joinAfterAuth')
          }
        }

        redirectTo = redirectTo || '/dashboard'
        navigate(redirectTo)
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  // ── Sign In ───────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault()
    clearMessages()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // If no error, the onAuthStateChange above handles the redirect
  }

  // ── Sign Up ───────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault()
    clearMessages()
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Change this to your actual domain in production
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Account created! Check your email to confirm, then sign in.')
      setTab('signin')
    }
    setLoading(false)
  }

  // ── Magic Link ────────────────────────────────────────────
  const handleMagicLink = async () => {
    clearMessages()
    if (!email) { setError('Enter your email address first.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(`Magic link sent to ${email}. Check your inbox.`)
    }
    setLoading(false)
  }

  const inputStyle = (name) => ({
    ...S.input,
    borderColor: focusedEl === name ? '#0B3D2E' : '#E2DAD0',
    boxShadow: focusedEl === name ? '0 0 0 3px rgba(11,61,46,0.08)' : 'none',
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        button:hover { opacity: 0.92; }
      `}</style>

      <div style={S.page}>
        <div style={S.card}>

          {/* Session expired banner */}
          {sessionExpired && (
            <div style={{
              background: '#FEF3E2', border: '1px solid #F0D5A0',
              borderRadius: 12, padding: '12px 16px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 16 }}>⏰</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#C97B1A' }}>
                  Your session expired
                </div>
                <div style={{ fontSize: 12, color: '#A07030', marginTop: 2 }}>
                  Please sign in again to continue.
                </div>
              </div>
            </div>
          )}

          {/* Logo */}
          <div style={S.logo}>
            <img src="/favicon-32x32.png" alt="SplitPayNG" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }} />
            <span style={S.logoText}>
              SplitPay<span style={{ color: '#0B3D2E' }}>NG</span>
            </span>
          </div>

          <h1 style={S.title}>
            {tab === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={S.subtitle}>
            {tab === 'signin'
              ? 'Sign in to manage your pools and payouts.'
              : 'Join thousands splitting subscriptions in Nigeria.'}
          </p>

          {/* Tabs */}
          <div style={S.tabs}>
            {['signin', 'signup'].map(t => (
              <button
                key={t}
                style={{
                  ...S.tab,
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#111' : '#888',
                  boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
                onClick={() => { setTab(t); clearMessages() }}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Messages */}
          {error   && <div style={S.error}>⚠ {error}</div>}
          {success && <div style={S.success}>✓ {success}</div>}

          {/* Form */}
          <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp}>

            {tab === 'signup' && (
              <div>
                <label style={S.label}>Full Name</label>
                <input
                  style={inputStyle('name')}
                  type="text"
                  placeholder="Amaka Okonkwo"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onFocus={() => setFocusedEl('name')}
                  onBlur={() => setFocusedEl(null)}
                  required
                />
              </div>
            )}

            <div>
              <label style={S.label}>Email Address</label>
              <input
                style={inputStyle('email')}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedEl('email')}
                onBlur={() => setFocusedEl(null)}
                required
              />
            </div>

            <div>
              <label style={S.label}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle('pwd'), paddingRight: 44 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusedEl('pwd')}
                  onBlur={() => setFocusedEl(null)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, color: '#AAA', lineHeight: 1,
                  }}
                  tabIndex={-1}
                  title={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass
                    ? /* eye-off */
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    : /* eye */
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                ...S.btnPrimary,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              disabled={loading}
            >
              {loading
                ? 'Please wait…'
                : tab === 'signin' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          {/* Magic link divider */}
          <div style={S.divider}>
            <div style={S.divLine} />
            <span style={S.divText}>or</span>
            <div style={S.divLine} />
          </div>

          <button
            style={S.btnMagic}
            onClick={handleMagicLink}
            disabled={loading}
          >
            ✉ Send Magic Link
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#BBB', marginTop: 24 }}>
            By continuing you agree to our{' '}
            <a href="#" style={{ color: '#0B3D2E', textDecoration: 'none' }}>Terms</a>
            {' & '}
            <a href="#" style={{ color: '#0B3D2E', textDecoration: 'none' }}>Privacy Policy</a>
          </p>
        </div>
      </div>
    </>
  )
}