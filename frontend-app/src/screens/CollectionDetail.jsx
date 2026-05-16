export default function CollectionDetail({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => onNavigate('collections')}></i>
          <h1 className="display" style={{ fontSize: '18px' }}>Collection</h1>
          <i className="ti ti-dots-vertical" style={{ fontSize: '20px', cursor: 'pointer' }}></i>
        </div>
        <div style={{ background: 'linear-gradient(135deg, var(--forest-soft) 0%, var(--forest) 100%)', borderRadius: '12px', height: '120px', margin: '12px 20px 16px', display: 'flex', alignItems: 'flex-end', padding: '16px' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '500' }}>Your Collection</p>
            <p style={{ fontSize: '12px', opacity: 0.8 }}>12 items saved</p>
          </div>
        </div>
        <div style={{ padding: '0 20px 80px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card" onClick={() => onNavigate('save-detail')}>
              <div style={{ height: '80px', background: `var(--${['thumb-1', 'thumb-2', 'thumb-3', 'thumb-4', 'thumb-5', 'thumb-6'][i - 1]})`, backgroundSize: 'cover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${['ti-bookmark', 'ti-heart', 'ti-star', 'ti-check', 'ti-share', 'ti-arrow-up'][i - 1]}`} style={{ fontSize: '24px', color: 'var(--linen)' }}></i>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <p style={{ fontSize: '12px', fontWeight: '500' }}>Item {i}</p>
                <p style={{ fontSize: '10px', color: 'var(--slate)' }}>2d ago</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
