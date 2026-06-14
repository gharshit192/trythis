import { useState } from 'react';
import api from '../api';

export default function Login({ onNavigate }) {
  // 'login' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // forgot-password / reset state
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devOtp, setDevOtp] = useState(''); // shown in dev when backend returns one

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    // The backend sleeps on the free tier; first request can take ~30-50s to
    // wake. Reassure the user instead of looking frozen.
    const wakeTimer = setTimeout(() => setInfo('Waking up the server — first load can take a moment…'), 4000);
    try {
      const result = await api.login(email, password);
      if (result.status === 'success') onNavigate('home');
      else setError(result.error?.message || 'Login failed');
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      clearTimeout(wakeTimer);
      setInfo('');
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setDevOtp('');
    if (!resetEmail.trim()) return setError('Email is required.');
    setLoading(true);
    try {
      const res = await api.forgotPassword(resetEmail.trim().toLowerCase());
      if (res.status === 'success') {
        setInfo(res.message || 'If that email is registered, a reset code has been sent.');
        if (res.devOtp) setDevOtp(res.devOtp);
        setMode('reset');
      } else {
        setError(res.error?.message || 'Could not start reset.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!otp.trim()) return setError('Enter the 6-digit code.');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (!/[A-Z]/.test(newPassword)) return setError('Password must contain at least one uppercase letter.');
    if (!/[0-9]/.test(newPassword)) return setError('Password must contain at least one number.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await api.resetPassword(resetEmail.trim().toLowerCase(), otp.trim(), newPassword);
      if (res.status === 'success') {
        setMode('login');
        setEmail(resetEmail);
        setPassword('');
        setOtp(''); setNewPassword(''); setConfirmPassword(''); setDevOtp('');
        setInfo('Password updated. Sign in with your new password.');
      } else {
        setError(res.error?.message || 'Reset failed.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goForgot = () => {
    setMode('forgot');
    setError(''); setInfo('');
    setResetEmail(email);
  };

  const goLogin = () => {
    setMode('login');
    setError(''); setInfo(''); setDevOtp('');
  };

  return (
    <div className="phone-frame">
      <div style={{ padding: '48px 28px 32px', flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px', marginTop: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: 'var(--coral)', borderRadius: '16px', marginBottom: '14px' }}>
            <i className="ti ti-bookmark" style={{ fontSize: '28px', color: 'var(--linen)' }}></i>
          </div>
          <p className="display" style={{ fontSize: '25px', marginBottom: '4px' }}>Wanna Try</p>
          <p style={{ fontSize: '14px', color: 'var(--slate)', marginTop: '4px', fontStyle: 'italic' }}>See it · Save it · Try it</p>
        </div>

        {mode === 'login' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h1 className="display" style={{ fontSize: '28px', marginBottom: '6px' }}>Welcome back</h1>
              <p style={{ fontSize: '15px', color: 'var(--slate)' }}>Sign in to pick up where you left off.</p>
            </div>

            <p className="label">Email</p>
            <input type="email" className="input" style={{ marginBottom: '14px' }} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <span className="label" style={{ marginBottom: '0' }}>Password</span>
              <button type="button" onClick={goForgot} disabled={loading} style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '14px', color: 'var(--amber-link, var(--coral))', fontWeight: '500', cursor: 'pointer' }}>Forgot?</button>
            </div>
            <input type="password" className="input" style={{ marginBottom: '20px' }} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />

            {info  && <div style={{ color: 'var(--coral)', marginBottom: '10px', fontSize: '14px' }}>{info}</div>}
            {error && <div style={{ color: 'var(--error,#d33)', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}

            <button className="btn-primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '32px', fontSize: '15px', color: 'var(--slate)' }}>
              New here? <span style={{ color: 'var(--ink)', fontWeight: '500', cursor: 'pointer' }} onClick={() => onNavigate('signup')}>Create an account</span>
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <h1 className="display" style={{ fontSize: '25px', marginBottom: '6px' }}>Forgot password?</h1>
              <p style={{ fontSize: '14px', color: 'var(--slate)' }}>Enter your email and we'll send a 6-digit code to reset it.</p>
            </div>

            <p className="label">Email</p>
            <input type="email" className="input" style={{ marginBottom: '16px' }} placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} disabled={loading} />

            {error && <div style={{ color: 'var(--error,#d33)', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}

            <button className="btn-primary" onClick={handleForgotSubmit} disabled={loading}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <button className="btn-secondary" style={{ marginTop: 10 }} onClick={goLogin} disabled={loading}>
              Back to sign in
            </button>
          </>
        )}

        {mode === 'reset' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <h1 className="display" style={{ fontSize: '25px', marginBottom: '6px' }}>Enter the code</h1>
              <p style={{ fontSize: '14px', color: 'var(--slate)' }}>
                We sent a 6-digit code to <strong>{resetEmail}</strong>. Codes expire in 15 minutes.
              </p>
            </div>

            {devOtp && process.env.NODE_ENV !== 'production' && (
              <div style={{ background: 'var(--linen)', borderRadius: 8, padding: '8px 10px', marginBottom: 14, fontSize: 13, color: 'var(--slate)' }}>
                <strong>Dev mode:</strong> code is <code style={{ fontFamily: 'monospace', color: 'var(--coral)' }}>{devOtp}</code>
              </div>
            )}

            <p className="label">6-digit code</p>
            <input type="text" inputMode="numeric" maxLength={6} className="input" style={{ marginBottom: 14, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} disabled={loading} />

            <p className="label">New password</p>
            <input type="password" className="input" style={{ marginBottom: 14 }} placeholder="Min 8 chars, uppercase + number" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={loading} />

            <p className="label">Confirm password</p>
            <input type="password" className="input" style={{ marginBottom: 16 }} placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} />

            {error && <div style={{ color: 'var(--error,#d33)', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}

            <button className="btn-primary" onClick={handleResetSubmit} disabled={loading}>
              {loading ? 'Updating…' : 'Reset password'}
            </button>
            <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setMode('forgot')} disabled={loading}>
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
