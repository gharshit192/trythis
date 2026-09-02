import { useState } from 'react';
import { enablePushNotifications } from '../../lib/push';

const FAILURE_COPY = {
  denied: "No problem — you've blocked notifications for now. You can allow them in your browser settings whenever you like.",
  unsupported: 'Your browser can\'t do notifications yet. On iPhone, add Wanna Try to your Home Screen first, then turn these on from your profile.',
  'no-key': 'Reminders aren\'t available right now. You can turn them on later from your profile.',
  error: "Something went wrong setting that up. You can try again from your profile.",
};

export default function NotificationPermission({ onNavigate }) {
  const [loading, setLoading] = useState(false);
  // Onboarding used to send everyone to Home whether or not the setup worked, so
  // a denied prompt looked identical to a successful one. Failures now say what
  // happened and where to fix it, before moving on.
  const [failure, setFailure] = useState(null);

  const handleRequestNotification = async () => {
    setLoading(true);
    setFailure(null);
    try {
      // Requests browser permission, subscribes via the Push API, and registers
      // the subscription with the backend so the engine can actually push.
      const result = await enablePushNotifications();
      if (result.ok) {
        new Notification('Wanna Try', {
          body: "You're all set! We'll remind you when to try your saves.",
          icon: '/logo192.png',
        });
        onNavigate('home');
        return;
      }
      setFailure(FAILURE_COPY[result.reason] || FAILURE_COPY.error);
    } catch (err) {
      console.error('Notification request failed:', err);
      setFailure(FAILURE_COPY.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '60px 20px 80px', textAlign: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: 'var(--coral-faint)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
            <i className="ti ti-bell" style={{ fontSize: '40px', color: 'var(--coral)' }}></i>
          </div>
          <h1 className="display" style={{ fontSize: '28px', marginBottom: '12px' }}>One more thing</h1>
          <p style={{ fontSize: '15px', color: 'var(--slate)', lineHeight: '1.5', marginBottom: '8px' }}>Want us to remind you about your saves at the right moment? Like when you're near that cafe?</p>
          <p style={{ fontSize: '13px', color: 'var(--mute)' }}>You can turn this off anytime.</p>
          {failure && (
            <p style={{ fontSize: '13px', color: 'var(--slate)', lineHeight: 1.5, marginTop: '20px', maxWidth: '300px' }}>
              {failure}
            </p>
          )}
        </div>
        {!failure && (
          <button className="btn-primary" style={{ marginBottom: '12px' }} onClick={handleRequestNotification} disabled={loading}>
            {loading ? 'Setting up…' : 'Yes, remind me'}
          </button>
        )}
        <button className={failure ? 'btn-primary' : 'btn-secondary'} onClick={() => onNavigate('home')} disabled={loading}>
          {failure ? 'Continue' : 'Maybe later'}
        </button>
      </div>
    </div>
  );
}
