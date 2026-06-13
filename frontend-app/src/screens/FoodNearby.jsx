export default function FoodNearby({ onNavigate }) {
  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: '21px', cursor: 'pointer' }} onClick={() => onNavigate('collections')}></i>
          <h1 className="display" style={{ fontSize: '19px' }}>Food Nearby</h1>
          <div style={{ width: '24px' }}></div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, var(--sand) 0%, var(--coral) 100%)', borderRadius: '12px', height: '120px', margin: '12px 20px 16px', display: 'flex', alignItems: 'flex-end', padding: '16px', color: 'var(--linen)' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: '500' }}>15 cafes & restaurants</p>
            <p style={{ fontSize: '13px', opacity: 0.8 }}>Within 5km radius</p>
          </div>
        </div>
        <div style={{ padding: '0 20px 80px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card" onClick={() => onNavigate('save-detail')}>
              <div style={{ height: '80px', background: `var(--${['clay', 'dune', 'sand', 'sage'][i - 1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${['ti-coffee', 'ti-utensils', 'ti-icecream', 'ti-cup'][i - 1]}`} style={{ fontSize: '25px', color: 'var(--coral)' }}></i>
              </div>
              <div style={{ padding: '8px 10px' }}>
                <p style={{ fontSize: '13px', fontWeight: '500' }}>Place {i}</p>
                <p style={{ fontSize: '11px', color: 'var(--slate)' }}>{2 + i}km away</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
