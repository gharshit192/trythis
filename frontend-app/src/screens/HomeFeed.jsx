import { useState, useEffect } from 'react';
import api from '../api';
import SmartImage from '../components/SmartImage';

// Top-row pill label → Save.category enum value. "All" = null = no filter.
const PILL_CATEGORY = {
  All: null,
  Travel: 'travel',
  Food: 'food',
  Cafes: 'food',
  Experiences: 'experience',
  Shopping: 'shopping',
};
const PILLS = ['All', 'Travel', 'Food', 'Experiences', 'Shopping'];

export default function HomeFeed({ onNavigate }) {
  const [saves, setSaves] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePill, setActivePill] = useState('All');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userData);

    const fetchData = async () => {
      try {
        const result = await api.getSaves();
        if (result.status === 'success') {
          setSaves(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch saves:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: '13px', color: 'var(--slate)' }}>Hello, {user?.name?.split(' ')[0] || 'there'}</p>
            <h1 className="display" style={{ fontSize: '22px', marginTop: '2px' }}>Your saves</h1>
          </div>
          <div className="avatar">{user?.name?.substring(0, 2).toUpperCase() || 'HG'}</div>
        </div>

        <div style={{ height: '44px', background: 'var(--linen)', borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px', margin: '0 20px 16px' }}>
          <i className="ti ti-search" style={{ fontSize: '16px', color: 'var(--slate)' }}></i>
          <span style={{ fontSize: '14px', color: 'var(--slate)', flex: 1 }}>Search saves, places, vibes…</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '0 20px 18px', overflowX: 'auto', scrollbarWidth: 'none' }} className="hscroll">
          {PILLS.map((label) => (
            <div
              key={label}
              className={`pill${activePill === label ? ' active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => { setActivePill(label); setShowAll(false); }}
            >
              {label}
            </div>
          ))}
        </div>

        <div style={{ margin: '0 20px 16px', background: 'linear-gradient(135deg, var(--forest) 0%, #0a2118 100%)', borderRadius: '16px', padding: '16px', color: 'var(--linen)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(247,246,242,0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ti ti-calendar-event" style={{ fontSize: '20px', color: 'var(--linen)' }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: '500' }}>Long weekend in 12 days</p>
            <p style={{ fontSize: '11px', opacity: 0.75, marginTop: '3px' }}>3 Goa trips · 1 Himachal stay you saved</p>
          </div>
          <i className="ti ti-arrow-right" style={{ fontSize: '16px' }}></i>
        </div>

        <div style={{ margin: '0 20px 16px', borderRadius: '16px', background: 'var(--linen)', overflow: 'hidden' }}>
          <div className="thumb-1" style={{ height: '140px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="source-pill" style={{ position: 'absolute', top: '12px', left: '12px' }}>
              <i className="ti ti-brand-instagram" style={{ fontSize: '12px' }}></i>
              <span>Instagram</span>
            </div>
            <div style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', background: 'rgba(255,255,255,0.95)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-bookmark" style={{ fontSize: '14px', color: 'var(--forest)' }}></i>
            </div>
          </div>
          <div style={{ padding: '12px 14px 14px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <span className="tag tag-forest">CAFE</span>
              <span className="tag tag-neutral">BENGALURU</span>
            </div>
            <p className="display" style={{ fontSize: '16px', fontWeight: '500' }}>Third Wave Coffee, Indiranagar</p>
            <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '4px', lineHeight: '1.4' }}>Quiet mornings, oat flat white, plant-filled windows.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 20px 12px' }}>
          <p style={{ fontSize: '14px', fontWeight: '500' }}>
            {activePill === 'All' ? 'Recently saved' : activePill}
          </p>
          <span
            style={{ fontSize: '12px', color: 'var(--forest)', fontWeight: '500', cursor: 'pointer' }}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? 'Show less' : 'See all'}
          </span>
        </div>

        {(() => {
          const cat = PILL_CATEGORY[activePill];
          const filtered = cat ? saves.filter((s) => s.category === cat) : saves;
          const visible = showAll ? filtered : filtered.slice(0, 4);
          return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '0 20px 80px' }}>
          {loading ? (
            <p style={{ fontSize: '13px', color: 'var(--slate)', gridColumn: '1 / -1', textAlign: 'center' }}>Loading saves...</p>
          ) : visible.length > 0 ? (
            visible.map(save => (
              <div key={save._id} className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('save-detail', { id: save._id })}>
                <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dune)', overflow: 'hidden' }}>
                  {save.image ? (
                    <SmartImage saveId={save._id} src={save.image} alt={save.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <i className="ti ti-bookmark" style={{ fontSize: '28px', color: 'var(--forest)' }}></i>
                  )}
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '500', lineHeight: '1.3' }}>{save.title}</p>
                  <p style={{ fontSize: '10px', color: 'var(--slate)', marginTop: '4px' }}>{save.category || 'Uncategorized'}</p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--slate)', gridColumn: '1 / -1', textAlign: 'center' }}>
              {activePill === 'All' ? 'No saves yet' : `No ${activePill.toLowerCase()} saves yet`}
            </p>
          )}
        </div>
          );
        })()}

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
