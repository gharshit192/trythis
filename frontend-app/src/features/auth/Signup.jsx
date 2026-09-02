import { useState } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import PasswordInput from '../../components/PasswordInput';
import Button from '../../components/Button';

export default function Signup({ onNavigate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.signup(email, password, name);
      if (result.status === 'success') {
        onNavigate('verify-email', { fromSignup: true, next: 'onboarding-city' });
      } else {
        setError(result.error?.message || 'Signup failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wt-screen">
      <div className="wt-topbar">
        <button type="button" className="wt-iconbtn" aria-label="Back" onClick={() => onNavigate('welcome')}><Icon name="back" size={22} /></button>
      </div>
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h1 className="wt-title lg" style={{ fontSize: 33, marginBottom: 9 }}>Create your account</h1>
        <p className="wt-sub" style={{ marginBottom: 26 }}>Two questions after this, then you're in.</p>
        {error && <div className="wt-note error">{error}</div>}
        <div className="wt-field"><label className="wt-label" htmlFor="name">Name</label>
          <input id="name" className="wt-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" autoComplete="name" required /></div>
        <div className="wt-field"><label className="wt-label" htmlFor="email">Email</label>
          <input id="email" className="wt-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
        <div className="wt-field"><label className="wt-label" htmlFor="password">Password</label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required /></div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Continue'}</Button>
          <span style={{ fontSize: 14.5, color: 'var(--mute)' }}>Already have an account? <span className="wt-link" onClick={() => onNavigate('login')}>Sign in</span></span>
        </div>
      </form>
    </div>
  );
}
