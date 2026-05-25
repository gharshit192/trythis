import { useState } from 'react';
import api from '../api';

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
        onNavigate('demoSaves');
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
    <div className="phone-frame">
      <div style={{ padding: '40px 28px 32px', background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px', marginTop: '16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'var(--forest)', borderRadius: '14px', marginBottom: '12px' }}>
            <i className="ti ti-bookmark" style={{ fontSize: '24px', color: 'var(--linen)' }}></i>
          </div>
          <p className="display" style={{ fontSize: '20px' }}>TryThis</p>
        </div>

        <div style={{ marginBottom: '22px' }}>
          <h1 className="display" style={{ fontSize: '26px', marginBottom: '6px' }}>Create your account</h1>
          <p style={{ fontSize: '14px', color: 'var(--slate)' }}>Start saving the things you don't want to forget.</p>
        </div>

        <p className="label">Full name</p>
        <input
          type="text"
          className="input"
          style={{ marginBottom: '14px' }}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <p className="label">Email</p>
        <input
          type="email"
          className="input"
          style={{ marginBottom: '14px' }}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <p className="label">Password</p>
        <input
          type="password"
          className="input focused"
          style={{ marginBottom: '22px' }}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div style={{ color: 'var(--error)', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

        <button className="btn-primary" onClick={handleSignup} disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
          <i className="ti ti-arrow-right" style={{ fontSize: '16px' }}></i>
        </button>

        <p style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '24px', fontSize: '14px', color: 'var(--slate)' }}>
          Already have an account? <span style={{ color: 'var(--ink)', fontWeight: '500', cursor: 'pointer' }} onClick={() => onNavigate('login')}>Sign in</span>
        </p>
      </div>
    </div>
  );
}
