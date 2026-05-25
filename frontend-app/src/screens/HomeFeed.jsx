import { useState, useEffect } from 'react';
import api from '../api';

const FILTERS = [
  { id: 'all',       icon: 'ti-layout-grid',      label: 'All' },
  { id: 'video',     icon: 'ti-player-play',      label: 'Videos' },
  { id: 'link',      icon: 'ti-link',             label: 'Links' },
  { id: 'bundle',    icon: 'ti-files',            label: 'Bundles' },
  { id: 'travel',    icon: 'ti-map-pin',          label: 'Travel' },
  { id: 'food',      icon: 'ti-tools-kitchen-2',  label: 'Food' },
  { id: 'shopping',  icon: 'ti-shopping-bag',     label: 'Shopping' },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getRelativeTime = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days/7)} week${Math.floor(days/7)>1?'s':''} ago`;
  return `${Math.floor(days/30)} month${Math.floor(days/30)>1?'s':''} ago`;
};

const getDomain = (url) => {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return ''; }
};

const getCategoryColors = (category) => {
  const map = {
    travel:     { bg: '#E1F5EE', color: '#0F6E56', icon: 'ti-map' },
    food:       { bg: '#FAEEDA', color: '#854F0B', icon: 'ti-coffee' },
    restaurant: { bg: '#FAEEDA', color: '#854F0B', icon: 'ti-tools-kitchen-2' },
    cafe:       { bg: '#FAEEDA', color: '#854F0B', icon: 'ti-tools-kitchen-2' },
    shopping:   { bg: '#EEEDFE', color: '#534AB7', icon: 'ti-shoe' },
    tech:       { bg: '#E6F1FB', color: '#185FA5', icon: 'ti-device-laptop' },
    blog:       { bg: '#E6F1FB', color: '#185FA5', icon: 'ti-article' },
  };
  return map[category] || { bg: '#F1EFE8', color: '#5F5E5A', icon: 'ti-world' };
};

const isVideo = (save) =>
  save.contentType === 'video' ||
  save.source === 'instagram' ||
  save.source === 'youtube';

const isLink = (save) =>
  (save.contentType === 'link' || save.contentType === 'article' || save.source === 'url') &&
  !isVideo(save);

const isBundle = (save) =>
  save.source === 'screenshot_bundle' ||
  save.contentType === 'screenshot';

const isTravelCategory = (save) => save.category === 'travel';
const isFoodCategory = (save) =>
  save.category === 'food' || save.category === 'restaurant' || save.category === 'cafe';
const isShoppingCategory = (save) => save.category === 'shopping';

const isCategoryFilter = (filterId) =>
  ['travel', 'food', 'shopping'].includes(filterId);

const getFilteredSaves = (allSaves, filter) => {
  switch(filter) {
    case 'all':      return allSaves;
    case 'video':    return allSaves.filter(isVideo);
    case 'link':     return allSaves.filter(isLink);
    case 'bundle':   return allSaves.filter(isBundle);
    case 'travel':   return allSaves.filter(isTravelCategory);
    case 'food':     return allSaves.filter(isFoodCategory);
    case 'shopping': return allSaves.filter(isShoppingCategory);
    default:         return allSaves;
  }
};

export default function HomeFeed({ onNavigate }) {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchData = async () => {
      try {
        const result = await api.getSaves();
        if (result.status === 'success') {
          setSaves(result.data);
        } else {
          setFetchError(result.error?.message || 'Failed to load saves');
        }
      } catch (err) {
        setFetchError('Connection error. Pull down to retry.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="phone-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (saves.length === 0) {
    return (
      <div className="phone-frame">
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{getGreeting()}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>0 saves</div>
          </div>
          <button onClick={() => onNavigate('search')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 22 }}>
            <i className="ti ti-search" style={{ color: '#888' }}></i>
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16 }}>
          <i className="ti ti-inbox" style={{ fontSize: 48, color: '#ccc' }}></i>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>No saves yet</div>
            <div style={{ fontSize: 12, color: '#888' }}>Tap + to add your first save</div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate which save types exist for dynamic filter visibility
  const hasVideos = saves.some(isVideo);
  const hasLinks = saves.some(isLink);
  const hasBundles = saves.some(isBundle);
  const hasTravel = saves.some(isTravelCategory);
  const hasFood = saves.some(isFoodCategory);
  const hasShopping = saves.some(isShoppingCategory);

  // Filter circles only show for types that exist
  const visibleFilters = FILTERS.filter(f => {
    if (f.id === 'all') return true;
    if (f.id === 'video') return hasVideos;
    if (f.id === 'link') return hasLinks;
    if (f.id === 'bundle') return hasBundles;
    if (f.id === 'travel') return hasTravel;
    if (f.id === 'food') return hasFood;
    if (f.id === 'shopping') return hasShopping;
    return false;
  });

  // If active filter is no longer visible, reset to 'all'
  if (!visibleFilters.some(f => f.id === activeFilter)) {
    setActiveFilter('all');
  }

  const filteredSaves = getFilteredSaves(saves, activeFilter);
  const videoSaves = filteredSaves.filter(isVideo);
  const linkSaves = filteredSaves.filter(isLink).slice(0, activeFilter === 'link' ? undefined : 5);
  const bundleSaves = filteredSaves.filter(isBundle);

  const showNoResults = activeFilter !== 'all' && filteredSaves.length === 0;

  return (
    <div className="phone-frame">
      <div style={{ background: 'white', minHeight: '100vh', paddingBottom: 20, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid #eee' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{getGreeting()}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{saves.length} saves</div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={() => onNavigate('search')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 22 }}>
              <i className="ti ti-search" style={{ color: '#888' }}></i>
            </button>
            <button onClick={() => onNavigate('notifications')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 22 }}>
              <i className="ti ti-bell" style={{ color: '#888' }}></i>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '0 16px 14px', overflow: 'visible' }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {visibleFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0
                }}
              >
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: activeFilter === filter.id ? '#1B3A2F' : '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: activeFilter === filter.id ? 'none' : '0.5px solid #ddd'
                }}>
                  <i className={`ti ${filter.icon}`} style={{
                    fontSize: 22,
                    color: activeFilter === filter.id ? 'white' : '#888'
                  }}></i>
                </div>
                <span style={{ fontSize: 10, color: activeFilter === filter.id ? '#1B3A2F' : '#888', fontWeight: 500 }}>
                  {filter.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '0.5px', background: '#eee' }}></div>

        {/* Content */}
        {showNoResults ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16 }}>
            <i className="ti ti-inbox" style={{ fontSize: 48, color: '#ccc' }}></i>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                No {visibleFilters.find(f => f.id === activeFilter)?.label.toLowerCase()} yet
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>Tap + to add your first save</div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Video section */}
            {(activeFilter === 'all' || activeFilter === 'video' || isCategoryFilter(activeFilter)) && videoSaves.length > 0 && (
              <div>
                <div style={{ padding: '18px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Videos & reels</span>
                  <button
                    onClick={() => onNavigate('savedList', { filter: 'video', title: 'Videos & reels' })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: 0 }}>
                    {videoSaves.length} saves →
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 12, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {videoSaves.slice(0, activeFilter === 'video' ? undefined : 6).map((save) => (
                    <div key={save._id} style={{ flex: '0 0 148px', cursor: 'pointer' }} onClick={() => onNavigate('saveDetail', { saveId: save._id })}>
                      <div style={{
                        width: 148,
                        height: 110,
                        borderRadius: 12,
                        background: getCategoryColors(save.category).bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        marginBottom: 8,
                        overflow: 'hidden'
                      }}>
                        {save.thumbnail ? (
                          <img src={save.thumbnail} alt={save.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : null}
                        <i className="ti ti-player-play" style={{ fontSize: 30, color: getCategoryColors(save.category).color, position: 'absolute' }}></i>
                        {save.aiAnalysis?.structuredData?.duration && (
                          <div style={{ position: 'absolute', bottom: 8, right: 8, background: '#085041', color: '#9FE1CB', fontSize: 10, padding: '2px 7px', borderRadius: 999 }}>
                            {save.aiAnalysis.structuredData.duration}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.4, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {save.title}
                      </div>
                      {save.category && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            background: getCategoryColors(save.category).bg,
                            color: getCategoryColors(save.category).color,
                            fontSize: 10,
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                          }}>
                            {save.category.charAt(0).toUpperCase() + save.category.slice(1)}
                          </span>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {save.source ? save.source.charAt(0).toUpperCase() + save.source.slice(1) : 'Saved'} · {getRelativeTime(save.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ height: '0.5px', background: '#eee', margin: '18px 0 0' }}></div>
              </div>
            )}

            {/* Link section */}
            {(activeFilter === 'all' || activeFilter === 'link' || isCategoryFilter(activeFilter)) && linkSaves.length > 0 && (
              <div>
                <div style={{ padding: '18px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Links & articles</span>
                  <button
                    onClick={() => onNavigate('savedList', { filter: 'link', title: 'Links & articles' })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: 0 }}>
                    {saves.filter(isLink).length} saves →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 16px' }}>
                  {linkSaves.map((save, idx) => {
                    const colors = getCategoryColors(save.category);
                    return (
                      <div
                        key={save._id}
                        onClick={() => onNavigate('saveDetail', { saveId: save._id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 0',
                          borderBottom: idx < linkSaves.length - 1 ? '0.5px solid #eee' : 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: colors.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <i className={`ti ${colors.icon}`} style={{ fontSize: 18, color: colors.color }}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                            {save.title}
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                            {save.category && (
                              <span style={{
                                background: colors.bg,
                                color: colors.color,
                                fontSize: 10,
                                padding: '3px 8px',
                                borderRadius: 999,
                                fontWeight: 500,
                                whiteSpace: 'nowrap'
                              }}>
                                {save.category.charAt(0).toUpperCase() + save.category.slice(1)}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#888' }}>
                            {getDomain(save.url) || save.source}
                          </div>
                        </div>
                        <i className="ti ti-chevron-right" style={{ fontSize: 16, color: '#bbb', flexShrink: 0 }}></i>
                      </div>
                    );
                  })}
                </div>
                <div style={{ height: '0.5px', background: '#eee', marginTop: 6 }}></div>
              </div>
            )}

            {/* Bundle section */}
            {(activeFilter === 'all' || activeFilter === 'bundle' || isCategoryFilter(activeFilter)) && bundleSaves.length > 0 && (
              <div>
                <div style={{ padding: '18px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Screenshot bundles</span>
                  <button
                    onClick={() => onNavigate('savedList', { filter: 'bundle', title: 'Screenshot bundles' })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: 0 }}>
                    {bundleSaves.length} bundles →
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 12, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {bundleSaves.slice(0, activeFilter === 'bundle' ? undefined : 4).map((save) => {
                    const data = save.aiAnalysis?.screenshotAnalysis?.data || {};
                    const colors = getCategoryColors(save.category);
                    const facts = save.aiAnalysis?.keyPoints?.slice(0, 3) ||
                                 save.aiAnalysis?.summary?.split('\n').slice(0, 3) ||
                                 ['Tap to view analysis'];
                    const categories = data.categories?.slice(0, 3) || [];

                    return (
                      <div
                        key={save._id}
                        onClick={() => onNavigate('screenshotSummary', { sessionId: save._id, summary: data, saveId: save._id })}
                        style={{
                          flex: '0 0 180px',
                          borderRadius: 12,
                          border: '0.5px solid #eee',
                          padding: 14,
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: colors.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <i className={`ti ${colors.icon}`} style={{ fontSize: 18, color: colors.color }}></i>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>{save.title}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>{save.aiAnalysis?.screenshots?.length || 0} screenshots</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.7, marginBottom: 10 }}>
                          {facts.map((f, i) => (
                            <div key={i}>{typeof f === 'string' ? f.substring(0, 40) : f}</div>
                          ))}
                        </div>
                        {categories.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {categories.map((cat, i) => {
                              const catColors = getCategoryColors(cat.name);
                              return (
                                <span key={i} style={{
                                  background: catColors.bg,
                                  color: catColors.color,
                                  fontSize: 9,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontWeight: 500
                                }}>
                                  {cat.count} {cat.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '12px 0', borderTop: '0.5px solid #eee', background: 'white', position: 'sticky', bottom: 0 }}>
        <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, color: '#1B3A2F' }}>
          <i className="ti ti-home" style={{ fontSize: 22 }}></i>
          <span>Home</span>
        </button>
        <button onClick={() => onNavigate('search')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
          <i className="ti ti-search" style={{ fontSize: 22 }}></i>
          <span>Search</span>
        </button>
        <button onClick={() => onNavigate('add-save')} style={{ background: '#1B3A2F', border: 'none', cursor: 'pointer', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: 48, height: 48, color: 'white', marginTop: -16 }}>
          <i className="ti ti-plus" style={{ fontSize: 24 }}></i>
        </button>
        <button onClick={() => onNavigate('collections')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
          <i className="ti ti-folder" style={{ fontSize: 22 }}></i>
          <span>Collections</span>
        </button>
        <button onClick={() => onNavigate('profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
          <i className="ti ti-user" style={{ fontSize: 22 }}></i>
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}
