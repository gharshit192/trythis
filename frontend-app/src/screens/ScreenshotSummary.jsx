export default function ScreenshotSummary({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 className="display" style={{ fontSize: '18px' }}>Screenshot Summary</h1>
          <i className="ti ti-x" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => onNavigate('home')}></i>
        </div>
        <div style={{ background: 'var(--linen)', borderRadius: '12px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <i className="ti ti-photo" style={{ fontSize: '48px', color: 'var(--slate)', opacity: 0.5 }}></i>
        </div>
        <div style={{ background: 'var(--forest-faint)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--forest)', fontWeight: '500', marginBottom: '4px' }}>AI Grouped into 3 saves:</p>
          <ul style={{ fontSize: '12px', color: 'var(--slate)', paddingLeft: '16px', lineHeight: '1.6' }}>
            <li>Coffee recipe — Specialty beans</li>
            <li>Cafe visit — Third Wave, JP Nagar</li>
            <li>Latte art tutorial</li>
          </ul>
        </div>
        <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => onNavigate('home')}>Save all</button>
      </div>
    </div>
  );
}
