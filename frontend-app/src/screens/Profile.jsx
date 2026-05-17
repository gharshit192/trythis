import { useEffect, useState } from 'react';
import api from '../api';

export default function Profile({ onNavigate }) {
  const [user, setUser] = useState(null);
  const [saveCount, setSaveCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setUser(JSON.parse(localStorage.getItem('user') || 'null'));
        const [s, c] = await Promise.all([api.getSaves(), api.getCollections()]);
        setSaveCount(s.data?.length || 0);
        setCollectionCount(c.data?.length || 0);
      } catch (err) {
        console.warn('Profile load failed', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = () => {
    api.logout();
    onNavigate('login');
  };

  const initials = (user?.name || user?.email || 'U')
    .split(/[\s@]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px 14px' }}><h1 className="display" style={{ fontSize: '22px' }}>Profile</h1></div>
        <div style={{ padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
          <div className="avatar" style={{ width: '60px', height: '60px', fontSize: '24px', margin: '0 auto 12px' }}>{initials}</div>
          <h2 className="display" style={{ fontSize: '18px', marginBottom: '4px' }}>{user?.name || '—'}</h2>
          <p style={{ fontSize: '13px', color: 'var(--slate)' }}>{user?.email || ''}</p>
        </div>
        <div style={{ padding: '0 20px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--linen)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--forest)' }}>{loading ? '…' : saveCount}</p>
              <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '4px' }}>Saves</p>
            </div>
            <div style={{ background: 'var(--linen)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: '600', color: 'var(--forest)' }}>{loading ? '…' : collectionCount}</p>
              <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '4px' }}>Collections</p>
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
