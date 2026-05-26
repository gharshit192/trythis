export default function HomeEmpty({ onNavigate }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const firstName = user?.name?.split(' ')[0] || 'there';
  const initials = user?.name?.substring(0, 2).toUpperCase() || '?';

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--slate)' }}>Hello, {firstName}</p>
            <h1 className="display" style={{ fontSize: '22px', marginTop: '2px' }}>Your saves</h1>
          </div>
          <div className="avatar">{initials}</div>
        </div>

        <div style={{ height: '44px', background: 'var(--linen)', borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px', margin: '0 20px 16px' }}>
          <i className="ti ti-search" style={{ fontSize: '16px', color: 'var(--slate)' }}></i>
          <span style={{ fontSize: '14px', color: 'var(--slate)', flex: 1 }}>Search saves, places, vibes…</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 80px' }}>
          <i className="ti ti-inbox" style={{ fontSize: '48px', color: 'var(--forest)', marginBottom: '16px' }}></i>
          <h2 className="display" style={{ fontSize: '22px', marginBottom: '8px' }}>No saves yet</h2>
          <p style={{ fontSize: '14px', color: 'var(--slate)', marginBottom: '32px' }}>Start saving things to try later</p>

          <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div onClick={() => onNavigate('add-save')} style={{ background: 'white', border: '1px solid #d4d4d0', borderRadius: '12px', padding: '16px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1B3A2F'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d0'}>
              <div style={{ fontSize: '24px', flexShrink: 0 }}>🔗</div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#000', margin: '0 0 4px 0' }}>Save from web</p>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Paste a URL or use our browser extension</p>
              </div>
            </div>

            <div onClick={() => onNavigate('add-save')} style={{ background: 'white', border: '1px solid #d4d4d0', borderRadius: '12px', padding: '16px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1B3A2F'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d0'}>
              <div style={{ fontSize: '24px', flexShrink: 0 }}>📸</div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#000', margin: '0 0 4px 0' }}>Screenshot</p>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Capture and save images from your device</p>
              </div>
            </div>

            <div onClick={() => onNavigate('add-save')} style={{ background: 'white', border: '1px solid #d4d4d0', borderRadius: '12px', padding: '16px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1B3A2F'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d0'}>
              <div style={{ fontSize: '24px', flexShrink: 0 }}>✍️</div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#000', margin: '0 0 4px 0' }}>Add manually</p>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Create a save with your own notes</p>
              </div>
            </div>
          </div>
        </div>

        <div className="tab-bar">
          <div className="tab active" onClick={() => onNavigate('home')}>
            <i className="ti ti-home tab-icon"></i>
            <span className="tab-label">Home</span>
          </div>
          <div className="tab" onClick={() => onNavigate('search')}>
            <i className="ti ti-search tab-icon"></i>
            <span className="tab-label">Search</span>
          </div>
          <div className="fab" onClick={() => onNavigate('add-save')}>
            <i className="ti ti-plus"></i>
          </div>
          <div className="tab" onClick={() => onNavigate('collections')}>
            <i className="ti ti-folder tab-icon"></i>
            <span className="tab-label">Collections</span>
          </div>
          <div className="tab" onClick={() => onNavigate('profile')}>
            <i className="ti ti-user tab-icon"></i>
            <span className="tab-label">Profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}
