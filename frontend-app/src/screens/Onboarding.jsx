export default function Onboarding({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 20px 32px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: 'var(--forest)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
            <i className="ti ti-bookmark" style={{ fontSize: '40px', color: 'var(--linen)' }}></i>
          </div>
          <h1 className="display" style={{ fontSize: '32px', textAlign: 'center', marginBottom: '16px', lineHeight: 1.2 }}>You save things.</h1>
          <h1 className="display" style={{ fontSize: '32px', textAlign: 'center', color: 'var(--slate)', marginBottom: '32px', lineHeight: 1.2 }}>Then forget them.</h1>
          <p style={{ fontSize: '14px', color: 'var(--slate)', textAlign: 'center', lineHeight: '1.5' }}>TryThis remembers so you don't have to.</p>
        </div>

        <button className="btn-primary" onClick={() => onNavigate('signup')} style={{ marginBottom: '12px' }}>
          Get Started
        </button>
        <button className="btn-secondary" onClick={() => onNavigate('login')}>
          Sign In
        </button>
      </div>
    </div>
  );
}
