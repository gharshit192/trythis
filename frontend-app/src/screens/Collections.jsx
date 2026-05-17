import { useState, useEffect } from 'react';
import api from '../api';

export default function Collections({ onNavigate }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const result = await api.getCollections();
        if (result.status === 'success') {
          setCollections(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch collections:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 className="display" style={{ fontSize: '22px' }}>Collections</h1>
            <div style={{ width: '34px', height: '34px', background: 'var(--linen)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <i className="ti ti-plus" style={{ fontSize: '16px', color: 'var(--forest)' }}></i>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--slate)', marginTop: '4px' }}>12 collections · 248 saves</p>
        </div>

        <div style={{ display: 'flex', gap: '18px', padding: '0 20px', borderBottom: '0.5px solid var(--hairline)' }}>
          <div style={{ padding: '10px 0', fontSize: '13px', color: 'var(--slate)', cursor: 'pointer' }}>Mine</div>
          <div style={{ padding: '10px 0', fontSize: '13px', color: 'var(--forest)', fontWeight: '500', borderBottom: '2px solid var(--forest)', cursor: 'pointer' }}>Auto
            <span style={{ display: 'inline-block', background: 'var(--forest)', color: 'var(--linen)', fontSize: '9px', padding: '1px 5px', borderRadius: '6px', marginLeft: '4px', fontWeight: '500', verticalAlign: 'top', marginTop: '-1px' }}>5</span>
          </div>
          <div style={{ padding: '10px 0', fontSize: '13px', color: 'var(--slate)', cursor: 'pointer' }}>Shared</div>
        </div>

        <div style={{ margin: '16px 20px 8px', background: 'var(--forest-faint)', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="ti ti-sparkles" style={{ fontSize: '16px', color: 'var(--forest)' }}></i>
          <p style={{ fontSize: '12px', color: 'var(--forest)', lineHeight: '1.4' }}>TryThis grouped your saves into 5 collections based on patterns it spotted.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '12px 20px 80px' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: 'var(--slate)', gridColumn: '1 / -1', textAlign: 'center' }}>Loading collections...</p>
          ) : collections.length > 0 ? (
            collections.map(col => (
              <div key={col._id} className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('collection-detail', { id: col._id })}>
                <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dune)', position: 'relative' }}>
                  {col.metadata?.isAuto && <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(255,255,255,0.95)', padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: '500', color: 'var(--forest)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <i className="ti ti-sparkles" style={{ fontSize: '8px' }}></i> Auto
                  </div>}
                  <i className="ti ti-folder" style={{ fontSize: '28px', color: 'var(--forest)' }}></i>
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(14,14,12,0.7)', color: 'var(--linen)', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: '500' }}>{col.saves?.length || 0}</div>
                </div>
                <div style={{ padding: '9px 11px 11px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '500' }}>{col.name}</p>
                  <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '3px' }}>Collection</p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--slate)', gridColumn: '1 / -1', textAlign: 'center' }}>No collections yet</p>
          )}
        </div>

        <div className="tab-bar">
          <div className="tab" onClick={() => onNavigate('home')}>
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
          <div className="tab active" onClick={() => onNavigate('collections')}>
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
