import { useState } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import PasswordInput from '../../components/PasswordInput';
import Button from '../../components/Button';

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
    <div className="wt-screen">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={() => (mode === 'login' ? onNavigate('welcome') : goLogin())}><Icon name="back" size={22} /></button>
      </div>

      {mode === 'login' && (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h1 className="wt-title lg" style={{ fontSize: 33, marginBottom: 9 }}>Welcome back</h1>
          <p className="wt-sub" style={{ marginBottom: 26 }}>Sign in to pick up where you left off.</p>
          {error && <div className="wt-note error">{error}</div>}
          {info && <div className="wt-note info">{info}</div>}
          <div className="wt-field"><label className="wt-label" htmlFor="email">Email</label>
            <input id="email" className="wt-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
          <div className="wt-field"><div className="row"><label className="wt-label" htmlFor="password">Password</label><span className="wt-link" style={{ fontSize: 13.5 }} onClick={goForgot}>Forgot?</span></div>
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required /></div>
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <Button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
            <span style={{ fontSize: 14.5, color: 'var(--mute)' }}>New here? <span className="wt-link" onClick={() => onNavigate('signup')}>Create an account</span></span>
          </div>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h1 className="wt-title lg" style={{ fontSize: 33, marginBottom: 9 }}>Forgot password?</h1>
          <p className="wt-sub" style={{ marginBottom: 26 }}>We'll send a 6-digit code to your email.</p>
          {error && <div className="wt-note error">{error}</div>}
          {info && <div className="wt-note info">{info}</div>}
          <div className="wt-field"><label className="wt-label" htmlFor="resetEmail">Email</label>
            <input id="resetEmail" className="wt-input" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
          <div style={{ marginTop: 'auto' }}><Button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send code'}</Button></div>
        </form>
      )}

      {mode === 'reset' && (
        <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h1 className="wt-title lg" style={{ fontSize: 33, marginBottom: 9 }}>Set a new password</h1>
          <p className="wt-sub" style={{ marginBottom: 26 }}>Enter the code we sent to {resetEmail}.</p>
          {error && <div className="wt-note error">{error}</div>}
          {info && <div className="wt-note info">{info}</div>}
          {devOtp && <div className="wt-note info"><strong>Dev mode:</strong> code is <code>{devOtp}</code></div>}
          <div className="wt-field"><label className="wt-label" htmlFor="otp">Code</label>
            <input id="otp" className="wt-input" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" required /></div>
          <div className="wt-field"><label className="wt-label" htmlFor="newPassword">New password</label>
            <PasswordInput id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required /></div>
          <div className="wt-field"><label className="wt-label" htmlFor="confirmPassword">Confirm</label>
            <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required /></div>
          <div style={{ marginTop: 'auto' }}><Button type="submit" disabled={loading}>{loading ? 'Updating…' : 'Update password'}</Button></div>
        </form>
      )}
    </div>
  );
}
