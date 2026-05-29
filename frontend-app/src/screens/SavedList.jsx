import { useState, useEffect } from 'react';
import api from '../api';

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
  save.contentType === 'image' || save.source === 'screenshot';

export default function SavedList({ filter, title, saves = [], onNavigate, payload }) {
  const [filteredSaves, setFilteredSaves] = useState([]);
  const [allSaves, setAllSaves] = useState(saves);
  const [loading, setLoading] = useState(!saves || saves.length === 0);

  useEffect(() => {
    // If saves not provided or empty, fetch them from API
    if (!saves || saves.length === 0) {
      setLoading(true);
      api.getSaves()
        .then(result => {
          if (result.status === 'success') {
            setAllSaves(result.data);
          }
        })
        .catch(err => console.error('Failed to fetch saves:', err))
        .finally(() => setLoading(false));
    } else {
      setAllSaves(saves);
    }
  }, [saves]);

  useEffect(() => {
    let filtered = allSaves;
    switch(filter) {
      case 'video':
        filtered = allSaves.filter(isVideo);
        break;
      case 'link':
        filtered = allSaves.filter(isLink);
        break;
      case 'bundle':
        filtered = allSaves.filter(isBundle);
        break;
      default:
        filtered = allSaves;
    }
    setFilteredSaves(filtered);
  }, [allSaves, filter]);

  return (
    <div className="phone-frame">
      <div style={{ background: 'white', minHeight: '100vh', paddingBottom: 20 }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid #eee' }}>
          <button
            onClick={() => onNavigate('home')}
            style={{
              background: '#f5f5f5',
              border: 'none',
              cursor: 'pointer',
              width: 32,
              height: 32,
              borderRadius: 8,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{title}</h1>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, color: '#888' }}>Loading...</div>
          </div>
        ) : filteredSaves.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <i className="ti ti-inbox" style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }}></i>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>No {title.toLowerCase()} yet</div>
            <div style={{ fontSize: 12, color: '#888' }}>Tap + to add your first save</div>
          </div>
        ) : (
          <div style={{ padding: '16px 16px' }}>
            {filter === 'video' ? (
              // 2-column grid for videos
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {filteredSaves.map((save) => (
                  <div
                    key={save._id}
                    onClick={() => onNavigate('save-detail', { id: save._id })}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{
                      width: '100%',
                      height: 120,
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
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 3 }}>
                      {save.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {save.source ? save.source.charAt(0).toUpperCase() + save.source.slice(1) : 'Saved'} · {getRelativeTime(save.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : filter === 'link' ? (
              // Vertical list for links
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {filteredSaves.map((save, idx) => {
                  const colors = getCategoryColors(save.category);
                  return (
                    <div
                      key={save._id}
                      onClick={() => onNavigate('save-detail', { id: save._id })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 0',
                        borderBottom: idx < filteredSaves.length - 1 ? '0.5px solid #eee' : 'none',
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
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {save.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                          {getDomain(save.url) || save.source}
                        </div>
                      </div>
                      <i className="ti ti-chevron-right" style={{ fontSize: 16, color: '#bbb', flexShrink: 0 }}></i>
                    </div>
                  );
                })}
              </div>
            ) : (
              // 2-column grid for bundles
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {filteredSaves.map((save) => {
                  const data = save.aiAnalysis?.screenshotAnalysis?.data || {};
                  const colors = getCategoryColors(save.category);
                  const facts = save.aiAnalysis?.keyPoints?.slice(0, 3) ||
                               save.aiAnalysis?.summary?.split('\n').slice(0, 3) ||
                               ['Tap to view analysis'];
                  const categories = data.categories?.slice(0, 3) || [];

                  return (
                    <div
                      key={save._id}
                      onClick={() => onNavigate('save-detail', { id: save._id })}
                      style={{
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
