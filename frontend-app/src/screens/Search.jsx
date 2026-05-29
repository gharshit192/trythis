import { useState, useEffect, useRef } from 'react';
import api from '../api';

const CATEGORY_MAP = {
  food: { label: 'Food & recipes', icon: 'ti-tools-kitchen-2', bg: '#fff0e8', color: '#b85c28' },
  travel: { label: 'Travel', icon: 'ti-map-2', bg: '#e8f4fc', color: '#1a5f8a' },
  'home-decor': { label: 'Home & decor', icon: 'ti-building-skyscraper', bg: '#e8f0e8', color: '#1b3a2f' },
  tech: { label: 'Tech', icon: 'ti-device-laptop', bg: '#e8e4f8', color: '#4a3db0' },
  shopping: { label: 'Shopping', icon: 'ti-shopping-bag', bg: '#fef0cc', color: '#9a6800' },
  experience: { label: 'Experience', icon: 'ti-ticket', bg: '#fce8df', color: '#b85c28' },
};

const SUGGESTED_SEARCHES = [
  'Goa trip',
  'café near me',
  'recipes',
  'admin dashboard',
  'travel ideas',
];

const getCategoryInfo = (category) => {
  return CATEGORY_MAP[category] || { label: category, icon: 'ti-bookmark', bg: '#e8efe9', color: '#1b3a2f' };
};

const getRelativeTime = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
};

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

  const getTopCategories = () => {
    const cats = {};
    saves.forEach((s) => {
      if (s.category && CATEGORY_MAP[s.category]) {
        cats[s.category] = (cats[s.category] || 0) + 1;
      }
    });
    let categories = Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([cat, count]) => ({ cat, count }));

    // If less than 4 categories, add "All saves" card
    if (categories.length < 4) {
      categories.push({
        cat: 'all',
        count: saves.length,
        isAll: true,
      });
    }

    return categories;
  };

  const removeRecentSearch = (search, e) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== search);
    setRecentSearches(updated);
    localStorage.setItem('trythis_recent_searches', JSON.stringify(updated));
  };

  const topCategories = getTopCategories();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 10px', background: 'var(--paper)', flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Search saves</div>
        <div style={{ fontSize: 12, color: 'var(--mute)' }}>Find anything across your library</div>
      </div>

      {/* Search bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '12px 16px 0',
        background: 'var(--paper)',
        border: '0.5px solid var(--hairline)',
        borderRadius: 12,
        padding: '10px 14px',
        flexShrink: 0,
      }}>
        <i className="ti ti-search" style={{ color: 'var(--mute)', fontSize: 16 }}></i>
        <input
          type="text"
          placeholder="Cafés in Bangalore, Goa trip, recipes..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          style={{
            flex: 1,
            border: 'none',
            background: 'none',
            fontSize: 14,
            color: 'var(--ink)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--mute)', fontSize: 14 }}>
            Searching…
          </div>
        ) : !searched ? (
          <>
            {/* Browse by category */}
            {topCategories.length > 0 && (
              <div>
                <div style={{ padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                  Browse by category
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 16px' }}>
                  {topCategories.map(({ cat, count, isAll }) => {
                      const info = isAll
                        ? { label: 'All saves', icon: 'ti-bookmark', bg: '#e8efe9', color: '#1b3a2f' }
                        : getCategoryInfo(cat);
                      return (
                        <div
                          key={cat}
                          onClick={() => {
                            if (isAll) {
                              setQuery('');
                              setResults([]);
                              setSearched(false);
                            } else {
                              setQuery(cat);
                              runSearch(cat);
                            }
                          }}
                          style={{
                            background: 'var(--paper)',
                            border: '0.5px solid var(--hairline-soft)',
                            borderRadius: 14,
                            padding: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: info.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            color: info.color,
                            marginBottom: 8,
                          }}>
                            <i className={`ti ${info.icon}`}></i>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                            {info.label}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                            {count} save{count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Recent searches or Suggested searches */}
            {recentSearches.length > 0 || SUGGESTED_SEARCHES.length > 0 ? (
              <div>
                <div style={{ padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                  {recentSearches.length > 0 ? 'Recent searches' : 'Try searching for'}
                </div>
                {(recentSearches.length > 0 ? recentSearches : SUGGESTED_SEARCHES).map((search, idx) => (
                  <div key={search}>
                    <div
                      onClick={() => {
                        setQuery(search);
                        runSearch(search);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 16px',
                        cursor: 'pointer',
                      }}
                    >
                      <i className={`ti ${recentSearches.length > 0 ? 'ti-clock' : 'ti-search'}`} style={{ color: 'var(--mute)', fontSize: 15 }}></i>
                      <span style={{ fontSize: 13, color: 'var(--slate)', flex: 1 }}>{search}</span>
                      {recentSearches.length > 0 && (
                        <button
                          onClick={(e) => removeRecentSearch(search, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--mute)',
                            fontSize: 13,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <i className="ti ti-x"></i>
                        </button>
                      )}
                    </div>
                    {idx < (recentSearches.length > 0 ? recentSearches : SUGGESTED_SEARCHES).length - 1 && <div style={{ height: '0.5px', background: 'var(--hairline)', margin: '0 16px' }}></div>}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Quick filters */}
            <div>
              <div style={{ padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                Quick filters
              </div>
              <div style={{
                display: 'flex',
                gap: 6,
                padding: '0 16px 12px',
                overflow: 'auto',
                scrollbarWidth: 'none',
                scrollPaddingRight: '16px',
              }}>
                {['Near me', 'This weekend', 'Unvisited', 'With recipe', 'Price dropped'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setQuery(filter);
                      runSearch(filter);
                    }}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: '0.5px solid var(--hairline)',
                      background: 'var(--paper)',
                      color: 'var(--slate)',
                      flexShrink: 0,
                    }}
                  >
                    {filter}
                  </button>
                ))}
                <div style={{ width: '1px', flexShrink: 0 }}></div>
              </div>
            </div>

            {/* From your saves */}
            {saves.length > 0 && (
              <div>
                <div style={{ padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                  From your saves
                </div>
                {saves.slice(0, 10).map((save, idx) => {
                  const catInfo = getCategoryInfo(save.category);
                  return (
                    <div key={save._id}>
                      <div
                        onClick={() => onNavigate('save-detail', { id: save._id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 16px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          width: 52,
                          height: 52,
                          borderRadius: 10,
                          background: catInfo.bg,
                          flexShrink: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          color: catInfo.color,
                        }}>
                          {save.thumbnail ? <img src={save.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className={`ti ${catInfo.icon}`}></i>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                            {save.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                            <span style={{
                              display: 'inline-block',
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 20,
                              marginRight: 4,
                              background: catInfo.bg,
                              color: catInfo.color,
                            }}>
                              {save.category?.charAt(0).toUpperCase() + save.category?.slice(1)}
                            </span>
                            {save.source ? save.source.charAt(0).toUpperCase() + save.source.slice(1) : 'Saved'} · {getRelativeTime(save.createdAt)}
                          </div>
                        </div>
                        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--mute)', flexShrink: 0 }}></i>
                      </div>
                      {idx < saves.slice(0, 10).length - 1 && <div style={{ height: '0.5px', background: 'var(--hairline)', margin: '0 16px' }}></div>}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ height: 16 }}></div>
          </>
        ) : results.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <i className="ti ti-search" style={{ fontSize: 48, color: 'var(--hairline-soft)', display: 'block', marginBottom: 16 }}></i>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No saves found</div>
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>Try searching for a place, recipe, or category</div>
          </div>
        ) : (
          <div>
            <div style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </div>
            {results.map((save, idx) => {
              const catInfo = getCategoryInfo(save.category);
              return (
                <div key={save._id}>
                  <div
                    onClick={() => onNavigate('save-detail', { id: save._id })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      background: catInfo.bg,
                      flexShrink: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      color: catInfo.color,
                    }}>
                      {save.thumbnail ? <img src={save.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className={`ti ${catInfo.icon}`}></i>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                        {save.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 20,
                          marginRight: 4,
                          background: catInfo.bg,
                          color: catInfo.color,
                        }}>
                          {save.category?.charAt(0).toUpperCase() + save.category?.slice(1)}
                        </span>
                        {save.source ? save.source.charAt(0).toUpperCase() + save.source.slice(1) : 'Saved'} · {getRelativeTime(save.createdAt)}
                      </div>
                    </div>
                    <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--mute)', flexShrink: 0 }}></i>
                  </div>
                  {idx < results.length - 1 && <div style={{ height: '0.5px', background: 'var(--hairline)', margin: '0 16px' }}></div>}
                </div>
              );
            })}
            <div style={{ height: 16 }}></div>
          </div>
        )}
        </div>
    </div>
  );
}
