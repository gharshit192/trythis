export default function SaveDetail({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => onNavigate('home')}></i>
          <h1 className="display" style={{ fontSize: '18px' }}>Save Details</h1>
          <i className="ti ti-dots-vertical" style={{ fontSize: '20px', cursor: 'pointer' }}></i>
        </div>
        <div className="thumb-1" style={{ height: '180px', borderRadius: '12px', marginBottom: '16px' }}></div>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <span className="tag tag-forest">CAFE</span>
            <span className="tag tag-neutral">BENGALURU</span>
          </div>
          <h2 className="display" style={{ fontSize: '20px', marginBottom: '8px' }}>Third Wave Coffee</h2>
          <p style={{ fontSize: '14px', color: 'var(--slate)', lineHeight: '1.5' }}>Quiet mornings, oat flat white, plant-filled windows. Perfect for remote work.</p>
        </div>
        <div style={{ background: 'var(--forest-faint)', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--forest)', fontWeight: '500' }}>Saved from Instagram</p>
          <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px' }}>2 weeks ago · 5 min read</p>
        </div>
        <button className="btn-primary" style={{ marginTop: 'auto' }} onClick={() => onNavigate('home')}>Back</button>
      </div>
    </div>
  );
}
