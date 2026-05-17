import { useState } from 'react';
import api from '../api';

export default function Search({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async (q) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.search(term);
      setResults(res.status === 'success' ? res.data.saves : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 20px 14px' }}><h1 className="display" style={{ fontSize: '22px' }}>Search</h1></div>
        <div style={{ height: '44px', background: 'var(--linen)', borderRadius: '12px', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px', margin: '0 20px 16px' }}>
          <i className="ti ti-search" style={{ fontSize: '16px', color: 'var(--slate)' }}></i>
          <input
            type="text"
            placeholder="Search saves, places, vibes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '14px', outline: 'none', color: 'var(--ink)' }}
          />
          <button onClick={() => runSearch()} style={{ background: 'var(--forest)', color: 'var(--linen)', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Go</button>
        </div>

        <div style={{ flex: 1, padding: '0 20px 80px' }}>
          {loading ? (
            <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>Searching…</p>
          ) : !searched ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
              <i className="ti ti-search" style={{ fontSize: '48px', color: 'var(--mute)', marginBottom: '16px' }}></i>
              <p style={{ fontSize: '14px', color: 'var(--slate)' }}>Search your saves</p>
            </div>
          ) : results.length === 0 ? (
            <p style={{ color: 'var(--slate)', textAlign: 'center', padding: 24 }}>No results for "{query}"</p>
          ) : (
            results.map((s) => (
              <div key={s._id} className="card" style={{ marginBottom: 8, cursor: 'pointer', padding: 12 }} onClick={() => onNavigate('save-detail', { id: s._id })}>
                <p style={{ fontSize: 14, fontWeight: 500 }}>{s.title}</p>
                <p style={{ fontSize: 12, color: 'var(--slate)' }}>{s.metadata?.location || s.category || ''}</p>
              </div>
            ))
          )}
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
