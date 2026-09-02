import { useState, useEffect, useRef } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import Button from '../../components/Button';

// After signup: the 6-digit code we mailed. Resend has a cooldown; skipping is
// allowed — a verified email is for password reset and mail nudges, not a gate.
export default function VerifyEmail({ onNavigate, payload }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const next = payload?.next || 'onboarding-city';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cooldown, setCooldown] = useState(30);
  const [sentState, setSentState] = useState(payload?.fromSignup ? 'sent' : 'idle'); // signup already mailed one
  const timer = useRef(null);

  useEffect(() => {
    if (sentState === 'idle') resend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timer.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer.current);
  }, [cooldown]);

  const resend = async () => {
    setMsg(null);
    const r = await api.sendVerification().catch(() => null);
    if (r?.status === 'success') {
      if (r.data.verified) return finish();
      setSentState(r.data.sent ? 'sent' : 'unsent');
      if (r.data.otp) setMsg(`Dev build — your code is ${r.data.otp}`);
      setCooldown(30);
    } else setMsg(r?.error?.message || "Couldn't send the code. Try again in a moment.");
  };
  const finish = () => {
    try { localStorage.setItem('user', JSON.stringify({ ...user, emailVerified: true })); } catch {}
    onNavigate(next);
  };
  const verify = async (e) => {
    e?.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true); setMsg(null);
    const r = await api.verifyEmail(code).catch(() => null);
    setBusy(false);
    if (r?.status === 'success') finish(); else setMsg(r?.error?.message || "That code doesn't match.");
  };

  return (
    <div className="wt-screen">
      <div className="wt-topbar"><span /><button type="button" className="wt-link" onClick={() => onNavigate(next)} style={{ background: 'none', border: 0, fontSize: 14.5, cursor: 'pointer' }}>Skip for now</button></div>
      <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Icon name="lock" size={22} /></div>
      <h1 className="wt-title lg" style={{ marginBottom: 10 }}>Check your email</h1>
      <p className="wt-sub" style={{ marginBottom: 24 }}>
        {sentState === 'unsent'
          ? `We couldn't send a code to ${user.email || 'your email'} right now. You can skip this and verify later from Me.`
          : <>We sent a 6-digit code to <b style={{ color: 'var(--ink)' }}>{user.email || 'your email'}</b>. It's good for 15 minutes.</>}
      </p>
      {msg && <div className={`wt-note ${/Dev build/.test(msg) ? 'info' : 'error'}`}>{msg}</div>}
      <form onSubmit={verify}>
        <input className="wt-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} autoFocus value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code"
          style={{ fontSize: 26, letterSpacing: '.35em', textAlign: 'center', fontVariantNumeric: 'tabular-nums', marginBottom: 14 }} />
        <Button type="submit" disabled={code.length !== 6 || busy}>{busy ? 'Checking…' : 'Verify'}</Button>
      </form>
      <div style={{ marginTop: 18, fontSize: 14.5, color: 'var(--mute)', textAlign: 'center' }}>
        Didn't get it? {cooldown > 0 ? <span>Resend in {cooldown}s</span> : <span className="wt-link" onClick={resend}>Resend the code</span>}
      </div>
    </div>
  );
}
