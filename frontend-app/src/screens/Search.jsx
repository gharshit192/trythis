export default function Search({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 14px' }}><h1 className="display" style={{ fontSize: '22px' }}>Search</h1></div>
        <div style={{ height: '44px', background: 'var(--linen)', borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px', margin: '0 20px 16px' }}>
          <i className="ti ti-search" style={{ fontSize: '16px', color: 'var(--slate)' }}></i>
          <input type="text" placeholder="Search..." style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '14px', outline: 'none', color: 'var(--ink)' }} />
        </div>
        <div style={{ flex: 1, padding: '0 20px 80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-search" style={{ fontSize: '48px', color: 'var(--mute)', marginBottom: '16px' }}></i>
          <p style={{ fontSize: '14px', color: 'var(--slate)' }}>Search your saves</p>
        </div>
        <div className="tab-bar">
          <div className="tab" onClick={() => onNavigate('home')}><i className="ti ti-home tab-icon"></i><span className="tab-label">Home</span></div>
          <div className="tab active" onClick={() => onNavigate('search')}><i className="ti ti-search tab-icon"></i><span className="tab-label">Search</span></div>
          <div className="fab" onClick={() => onNavigate('add-save')}><i className="ti ti-plus"></i></div>
          <div className="tab" onClick={() => onNavigate('collections')}><i className="ti ti-folder tab-icon"></i><span className="tab-label">Collections</span></div>
          <div className="tab" onClick={() => onNavigate('profile')}><i className="ti ti-user tab-icon"></i><span className="tab-label">Profile</span></div>
        </div>
      </div>
    </div>
  );
}
