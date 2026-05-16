import { useState } from 'react';
import api from '../api';

export default function Login({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(email, password);
      if (result.status === 'success') {
        onNavigate('home');
      } else {
        setError(result.error?.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-frame">
      <div style={{ padding: '48px 28px 32px', flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px', marginTop: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: 'var(--forest)', borderRadius: '16px', marginBottom: '14px' }}>
            <i className="ti ti-bookmark" style={{ fontSize: '28px', color: 'var(--linen)' }}></i>
          </div>
          <p className="display" style={{ fontSize: '24px', marginBottom: '4px' }}>TryThis</p>
          <p style={{ fontSize: '13px', color: 'var(--slate)', marginTop: '4px', fontStyle: 'italic' }}>Save it. Find it. Try it.</p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h1 className="display" style={{ fontSize: '28px', marginBottom: '6px' }}>Welcome back</h1>
          <p style={{ fontSize: '14px', color: 'var(--slate)' }}>Sign in to pick up where you left off.</p>
        </div>

        <p className="label">Email</p>
        <input
          type="email"
          className="input"
          style={{ marginBottom: '14px' }}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <span className="label" style={{ marginBottom: '0' }}>Password</span>
          <a style={{ fontSize: '13px', color: 'var(--amber-link)', fontWeight: '500', textDecoration: 'none', cursor: 'pointer' }}>Forgot?</a>
        </div>
        <input
          type="password"
          className="input"
          style={{ marginBottom: '24px' }}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div style={{ color: 'var(--error)', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '22px 0' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--hairline)' }}></div>
          <span style={{ fontSize: '11px', color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--hairline)' }}></div>
        </div>

        <button className="btn-secondary" style={{ marginBottom: '10px' }}>
          <i className="ti ti-brand-apple" style={{ fontSize: '18px' }}></i>
          Continue with Apple
        </button>
        <button className="btn-secondary">
          <i className="ti ti-brand-google" style={{ fontSize: '18px' }}></i>
          Continue with Google
        </button>

        <p style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '32px', fontSize: '14px', color: 'var(--slate)' }}>
          New here? <span style={{ color: 'var(--ink)', fontWeight: '500', cursor: 'pointer' }} onClick={() => onNavigate('signup')}>Create an account</span>
        </p>
      </div>
    </div>
  );
}
