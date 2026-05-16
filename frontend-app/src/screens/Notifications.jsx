export default function Notifications({ onNavigate }) {
  const notifications = [
    { id: 1, title: 'Long weekend in 12 days', desc: '3 Goa trips · 1 Himachal stay', icon: 'ti-calendar-event', time: '2h ago' },
    { id: 2, title: 'Coffee prices dropped', desc: 'Blue Tokai single origin now ₹520', icon: 'ti-trending-down', time: '5h ago' },
    { id: 3, title: 'Your pottery class is back', desc: 'JP Nagar workshop now open for bookings', icon: 'ti-check', time: '1d ago' },
  ];

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px 14px' }}><h1 className="display" style={{ fontSize: '22px' }}>Notifications</h1></div>
        <div style={{ padding: '0 20px 80px', flex: 1 }}>
          {notifications.map(n => (
            <div key={n.id} style={{ background: 'var(--forest-faint)', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px', display: 'flex', gap: '12px', cursor: 'pointer' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--forest)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ti ${n.icon}`} style={{ fontSize: '16px', color: 'var(--linen)' }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)' }}>{n.title}</p>
                <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '2px' }}>{n.desc}</p>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--mute)', whiteSpace: 'nowrap' }}>{n.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
