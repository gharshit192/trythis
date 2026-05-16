export default function TripCollection({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => onNavigate('collections')}></i>
          <h1 className="display" style={{ fontSize: '18px' }}>Himalayan Trips</h1>
          <div style={{ width: '24px' }}></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, var(--sand) 0%, var(--forest) 100%)', borderRadius: '12px', height: '120px', margin: '12px 20px 16px', display: 'flex', alignItems: 'flex-end', padding: '16px', color: 'var(--linen)' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: '500' }}>34 saves</p>
            <p style={{ fontSize: '12px', opacity: 0.8 }}>Updated 2d ago</p>
          </div>
        </div>
        <div style={{ padding: '0 20px 80px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" onClick={() => onNavigate('save-detail')}>
              <div style={{ height: '80px', background: `var(--${['dune', 'sage', 'clay', 'mist'][i - 1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${['ti-mountain', 'ti-tent', 'ti-sun', 'ti-map-pin'][i - 1]}`} style={{ fontSize: '24px', color: 'var(--forest)' }}></i>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <p style={{ fontSize: '12px', fontWeight: '500' }}>Trip item {i}</p>
                <p style={{ fontSize: '10px', color: 'var(--slate)' }}>Travel</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
