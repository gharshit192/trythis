import { useState } from 'react';
import Icon from './Icon';

// A password field with the eye: tap to show what you typed. Same .wt-input
// look; the toggle sits inside the field so layouts don't change.
export default function PasswordInput({ id, value, onChange, placeholder, autoComplete = 'current-password', required, style }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', ...style }}>
      <input id={id} className="wt-input" type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder}
        autoComplete={autoComplete} required={required} style={{ paddingRight: 46, width: '100%' }} />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((v) => !v)}
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, border: 0, background: 'none', color: show ? 'var(--teal)' : 'var(--faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={show ? 'eye-off' : 'eye'} size={20} />
      </button>
    </div>
  );
}
