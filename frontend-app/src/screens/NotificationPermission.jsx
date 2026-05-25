import { useState } from 'react';

export default function NotificationPermission({ onNavigate }) {
  const [loading, setLoading] = useState(false);

  const handleRequestNotification = async () => {
    setLoading(true);
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification('TryThis', {
            body: "You're all set! We'll remind you when to try your saves.",
            icon: '🔔'
          });
        }
      }
    } catch (err) {
      console.error('Notification request failed:', err);
    } finally {
      setLoading(false);
      onNavigate('home');
    }
  };

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '60px 20px 80px', textAlign: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: 'var(--forest-faint)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
            <i className="ti ti-bell" style={{ fontSize: '40px', color: 'var(--forest)' }}></i>
          </div>
          <h1 className="display" style={{ fontSize: '28px', marginBottom: '12px' }}>One more thing</h1>
          <p style={{ fontSize: '14px', color: 'var(--slate)', lineHeight: '1.5', marginBottom: '8px' }}>Want us to remind you about your saves at the right moment? Like when you're near that cafe?</p>
          <p style={{ fontSize: '12px', color: 'var(--mute)' }}>You can turn this off anytime.</p>
        </div>
        <button className="btn-primary" style={{ marginBottom: '12px' }} onClick={handleRequestNotification} disabled={loading}>
          {loading ? 'Setting up…' : 'Yes, remind me'}
        </button>
        <button className="btn-secondary" onClick={() => onNavigate('home')} disabled={loading}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
