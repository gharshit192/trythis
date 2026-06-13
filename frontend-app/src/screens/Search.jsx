import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { getCategoryBucket, getBucketMeta, CATEGORY_FILTERS } from '../categoryMeta';

const SUGGESTED_SEARCHES = [
  'Goa trip',
  'café near me',
  'recipes',
  'weekend plans',
  'travel ideas',
];

const getRelativeTime = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
};

const getSubLabel = (save, meta) => {
  const loc = save.extractedLocation?.city || save.extractedLocation?.name;
  if (loc) return `${meta.label} · ${loc}`;
  const src = save.source ? save.source[0].toUpperCase() + save.source.slice(1) : 'Saved';
  return `${meta.label} · ${src} · ${getRelativeTime(save.createdAt)}`;
};

// Group a list of saves by category bucket (Eat/Travel/Shop/Cook/Learn/Saved),
// preserving the order buckets first appear in.
const groupByBucket = (items) => {
  const groups = new Map();
  for (const item of items) {
    const bucket = getCategoryBucket(item.category);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(item);
  }
  return [...groups.entries()].map(([bucket, bucketItems]) => ({ bucket, meta: getBucketMeta(bucket), items: bucketItems }));
};

function ResultGroups({ items, onNavigate }) {
  return (
    <div className="srch-results">
      {groupByBucket(items).map(({ bucket, meta, items: groupItems }) => (
        <div key={bucket}>
          <div className="srch-cat-hdr">{meta.emoji} {meta.label}</div>
          {groupItems.map((save) => (
            <div key={save._id} className="srch-item" onClick={() => onNavigate('save-detail', { id: save._id })}>
              <div className="srch-dot" style={{ background: meta.color }}></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="srch-iname">{save.title}</div>
                <div className="srch-isub">{getSubLabel(save, meta)}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Search({ onNavigate, payload }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saves, setSaves] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('trythis_recent_searches') || '[]');
    } catch {
      return [];
    }
  });
  const searchTimeoutRef = useRef(null);

  // Load all saves on mount for category browse
  useEffect(() => {
    const fetchSaves = async () => {
      try {
        const res = await api.getSaves();
        if (res.status === 'success') setSaves(res.data);
      } catch (err) {
        // Silent fail
      }
    };
    fetchSaves();
  }, []);

  const runSearch = async (q) => {
    const term = (q ?? query).trim();
    if (!term) {
      setResults([]);
      setSearched(false);
      return;
    }

    // Save to recent searches
    if (!recentSearches.includes(term)) {
      const updated = [term, ...recentSearches].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('trythis_recent_searches', JSON.stringify(updated));
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await api.search(term);
      setResults(res.status === 'success' ? res.data?.saves || [] : []);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Clear timeout
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    // Debounce search
    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        runSearch(value);
      }, 300);
    } else {
      setResults([]);
      setSearched(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const removeRecentSearch = (search, e) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== search);
    setRecentSearches(updated);
    localStorage.setItem('trythis_recent_searches', JSON.stringify(updated));
  };

  // Counts per bucket (Eat/Travel/Shop/Cook/Learn/Saved) for the browse grid
  const bucketCounts = saves.reduce((acc, s) => {
    const bucket = getCategoryBucket(s.category);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});
  const browseBuckets = CATEGORY_FILTERS
    .filter((f) => f.id !== 'all')
    .map((f) => ({ id: f.id, meta: getBucketMeta(f.id), count: bucketCounts[f.id] || 0 }))
    .filter((b) => b.count > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className="h-header">
        <div className="h-greet">Find anything</div>
        <div className="h-title">Search your saves</div>
      </div>

      {/* Search bar */}
      <div className="srch-bar-active">
        <span>🔍</span>
        <input
          type="text"
          className="srch-q"
          placeholder="Cafés in Bangalore, Goa trip, recipes..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          autoFocus
        />
        {query && <button className="srch-x" onClick={clearSearch}>✕</button>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: 16 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--mute)', fontSize: 15 }}>
            Searching…
          </div>
        ) : !searched ? (
          <>
            {/* Browse by category */}
            {browseBuckets.length > 0 && (
              <>
                <div className="srch-sec">Browse by category</div>
                <div className="srch-chips">
                  {browseBuckets.map(({ id, meta, count }) => (
                    <button key={id} className={`chip ${meta.chipClass}`} onClick={() => onNavigate('savedList', { filter: id, title: meta.label })}>
                      {meta.emoji} {meta.label} · {count}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Recent / suggested searches */}
            <div className="srch-sec">{recentSearches.length > 0 ? 'Recent searches' : 'Try searching for'}</div>
            <div className="srch-chips">
              {(recentSearches.length > 0 ? recentSearches : SUGGESTED_SEARCHES).map((search) => (
                <div key={search} className="srch-chip" onClick={() => { setQuery(search); runSearch(search); }}>
                  {search}
                  {recentSearches.length > 0 && (
                    <span style={{ color: '#AAA' }} onClick={(e) => removeRecentSearch(search, e)}>✕</span>
                  )}
                </div>
              ))}
            </div>

            {/* Quick filters */}
            <div className="srch-sec">Quick filters</div>
            <div className="srch-chips">
              {['Near me', 'This weekend', 'Unvisited', 'With recipe'].map((filter) => (
                <div key={filter} className="srch-chip" onClick={() => { setQuery(filter); runSearch(filter); }}>
                  {filter}
                </div>
              ))}
            </div>

            {/* From your saves */}
            {saves.length > 0 && (
              <>
                <div className="srch-sec">From your saves</div>
                <ResultGroups items={saves.slice(0, 12)} onNavigate={onNavigate} />
              </>
            )}
          </>
        ) : results.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <i className="ti ti-search" style={{ fontSize: 48, color: 'var(--hairline-soft)', display: 'block', marginBottom: 16 }}></i>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No saves found</div>
            <div style={{ fontSize: 14, color: 'var(--mute)' }}>Try searching for a place, recipe, or category</div>
          </div>
        ) : (
          <>
            <div className="srch-sec">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</div>
            <ResultGroups items={results} onNavigate={onNavigate} />
          </>
        )}
      </div>
    </div>
  );
}
