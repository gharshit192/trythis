export default function NotificationPermission({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '60px 20px 80px', textAlign: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: 'var(--forest-faint)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
            <i className="ti ti-bell" style={{ fontSize: '40px', color: 'var(--forest)' }}></i>
          </div>
          <h1 className="display" style={{ fontSize: '28px', marginBottom: '12px' }}>Stay notified</h1>
          <p style={{ fontSize: '14px', color: 'var(--slate)', lineHeight: '1.5', marginBottom: '8px' }}>We'll remind you when something you saved is perfect to try.</p>
          <p style={{ fontSize: '12px', color: 'var(--mute)' }}>You can change this in settings anytime.</p>
        </div>
        <button className="btn-primary" style={{ marginBottom: '12px' }} onClick={() => onNavigate('home')}>Allow notifications</button>
        <button className="btn-secondary" onClick={() => onNavigate('home')}>Skip for now</button>
      </div>
    </div>
  );
}
