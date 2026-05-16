export default function Profile({ onNavigate }) {
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    onNavigate('login');
  };

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px 14px' }}><h1 className="display" style={{ fontSize: '22px' }}>Profile</h1></div>
        <div style={{ padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
          <div className="avatar" style={{ width: '60px', height: '60px', fontSize: '24px', margin: '0 auto 12px' }}>HG</div>
          <h2 className="display" style={{ fontSize: '18px', marginBottom: '4px' }}>Harshit Gupta</h2>
          <p style={{ fontSize: '13px', color: 'var(--slate)' }}>test@example.com</p>
        </div>
        <div style={{ padding: '0 20px 80px' }}>
          <div style={{ background: 'var(--forest-faint)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <i className="ti ti-sparkles" style={{ fontSize: '16px', color: 'var(--forest)' }}></i>
              <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--forest)' }}>AI Insight</p>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--slate)', lineHeight: '1.4' }}>You've saved 248 items. Your top interests are Travel, Food & Coffee.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--linen)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--forest)' }}>248</p>
              <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '4px' }}>Saves</p>
            </div>
            <div style={{ background: 'var(--linen)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--forest)' }}>12</p>
              <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '4px' }}>Collections</p>
            </div>
            <div style={{ background: 'var(--linen)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--forest)' }}>5</p>
              <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '4px' }}>Auto</p>
            </div>
          </div>
          <button className="btn-primary" onClick={handleLogout}>Logout</button>
        </div>
        <div className="tab-bar">
          <div className="tab" onClick={() => onNavigate('home')}><i className="ti ti-home tab-icon"></i><span className="tab-label">Home</span></div>
          <div className="tab" onClick={() => onNavigate('search')}><i className="ti ti-search tab-icon"></i><span className="tab-label">Search</span></div>
          <div className="fab" onClick={() => onNavigate('add-save')}><i className="ti ti-plus"></i></div>
          <div className="tab" onClick={() => onNavigate('collections')}><i className="ti ti-folder tab-icon"></i><span className="tab-label">Collections</span></div>
          <div className="tab active" onClick={() => onNavigate('profile')}><i className="ti ti-user tab-icon"></i><span className="tab-label">Profile</span></div>
        </div>
      </div>
    </div>
  );
}
