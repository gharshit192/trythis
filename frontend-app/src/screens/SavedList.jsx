import { useState, useEffect } from 'react';
import api from '../api';
import SmartImage from '../components/SmartImage';
import SaveCard from '../components/SaveCard';
import { getCategoryMeta, categoryMatchesFilter } from '../categoryMeta';

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

const isVideo = (save) =>
  save.contentType === 'video' ||
  save.source === 'instagram' ||
  save.source === 'youtube';

const isLink = (save) =>
  (save.contentType === 'link' || save.contentType === 'article' || save.source === 'url') &&
  !isVideo(save);

const isBundle = (save) =>
  save.contentType === 'image' || save.source === 'screenshot';

const toRad = (deg) => (deg * Math.PI) / 180;

// Distance between two lat/lng points in metres (haversine)
const distanceMetres = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const formatDistance = (m) => {
  if (m == null) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
};

const SORT_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recent' },
  { id: 'nearby', label: 'Near Me' },
];

function CategoryThumb({ save, meta }) {
  if (save.thumbnail) {
    return (
      <div className="cv-thumb">
        <SmartImage saveId={save._id} src={save.thumbnail} alt={save.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
      </div>
    );
  }
  return (
    <div className={`cv-thumb ${meta.gradientClass}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 21 }}>
      <i className={`ti ${meta.icon}`}></i>
    </div>
  );
}

export default function SavedList({ filter, title, saves = [], onNavigate }) {
  const [filteredSaves, setFilteredSaves] = useState([]);
  const [allSaves, setAllSaves] = useState(saves);
  const [loading, setLoading] = useState(!saves || saves.length === 0);
  const [sortMode, setSortMode] = useState('all');
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    // Always refresh on entry. App-level saves can be stale after creating a
    // screenshot summary document, so relying only on the passed prop hides it.
    setLoading(true);
    api.getSaves()
      .then(result => {
        if (result.status === 'success') {
          setAllSaves(result.data || []);
        } else {
          setAllSaves(saves || []);
        }
      })
      .catch(err => {
        console.error('Failed to fetch saves:', err);
        setAllSaves(saves || []);
      })
      .finally(() => setLoading(false));
  }, [saves]);

  const isCategoryView = !['video', 'link', 'bundle'].includes(filter);

  useEffect(() => {
    let filtered;
    switch (filter) {
      case 'video':
        filtered = allSaves.filter(isVideo);
        break;
      case 'link':
        filtered = allSaves.filter(isLink);
        break;
      case 'bundle':
        filtered = allSaves.filter(isBundle);
        break;
      case 'all':
      case undefined:
      case null:
        filtered = allSaves;
        break;
      default:
        // Bucket-id filter (eat / travel / shop / cook / learn / saved)
        filtered = allSaves.filter((s) => categoryMatchesFilter(s.category, filter));
    }

    if (isCategoryView) {
      if (sortMode === 'recent') {
        filtered = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (sortMode === 'nearby' && userCoords) {
        filtered = filtered
          .map((s) => {
            const loc = s.extractedLocation;
            const dist = (loc?.lat != null && loc?.lng != null)
              ? distanceMetres(userCoords.lat, userCoords.lng, loc.lat, loc.lng)
              : null;
            return { ...s, _distance: dist };
          })
          .sort((a, b) => {
            if (a._distance == null && b._distance == null) return 0;
            if (a._distance == null) return 1;
            if (b._distance == null) return -1;
            return a._distance - b._distance;
          });
      }
    }

    setFilteredSaves(filtered);
  }, [allSaves, filter, sortMode, userCoords, isCategoryView]);

  const handleSortClick = (mode) => {
    if (mode === 'nearby' && !userCoords) {
      if (!navigator.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
          setSortMode('nearby');
        },
        () => setLocating(false),
        { timeout: 10000, maximumAge: 300000 }
      );
      return;
    }
    setSortMode(mode);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
      <div className="cv-nav">
        <span className="cv-back" onClick={() => onNavigate('home')}>←</span>
        <span className="cv-title">{title}</span>
        <span className="cv-more">⋯</span>
      </div>
      <div className="cv-stats">{filteredSaves.length} save{filteredSaves.length !== 1 ? 's' : ''}</div>

      {isCategoryView && (
        <div className="cv-filters">
          {SORT_OPTIONS.map((opt) => (
            <div
              key={opt.id}
              className={`cv-f ${sortMode === opt.id ? 'cv-f-a' : 'cv-f-i'}`}
              onClick={() => handleSortClick(opt.id)}
            >
              {opt.id === 'nearby' && locating ? 'Locating…' : opt.label}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: 'var(--mute)' }}>Loading...</div>
        </div>
      ) : filteredSaves.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <i className="ti ti-inbox" style={{ fontSize: 48, color: 'var(--hairline-soft)', marginBottom: 16, display: 'block' }}></i>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>No {title.toLowerCase()} yet</div>
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>Tap + to add your first save</div>
        </div>
      ) : filter === 'video' ? (
        <div className="save-card-grid" style={{ padding: '0 20px 20px' }}>
          {filteredSaves.map((save) => (
            <SaveCard key={save._id} save={save} onNavigate={onNavigate} />
          ))}
        </div>
      ) : filter === 'bundle' ? (
        <div className="save-card-grid" style={{ padding: '0 20px 20px' }}>
          {filteredSaves.map((save) => {
            const meta = getCategoryMeta(save.category);
            const facts = save.aiAnalysis?.keyPoints?.slice(0, 3) ||
              save.aiAnalysis?.summary?.split('\n').slice(0, 3) ||
              ['Tap to view analysis'];

            return (
              <div key={save._id} className="save-card" onClick={() => onNavigate('save-detail', { id: save._id })} style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div className={`save-card-img ${meta.gradientClass}`} style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`ti ${meta.icon}`} style={{ color: '#fff', fontSize: 17 }}></i>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="save-card-name" style={{ marginBottom: 2 }}>{save.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--mute)' }}>{save.metadata?.screenshotCount || save.aiAnalysis?.screenshotAnalysis?.data?.totalScreenshots || save.screenshots?.length || 0} screenshots</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 1.7, marginBottom: 10 }}>
                  {facts.map((f, i) => (
                    <div key={i}>{typeof f === 'string' ? f.substring(0, 40) : f}</div>
                  ))}
                </div>
                <span className={`chip ${meta.chipClass}`}>{meta.emoji} {meta.shortLabel}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cv-list" style={{ paddingBottom: 20 }}>
          {filteredSaves.map((save) => {
            const meta = getCategoryMeta(save.category);
            const loc = save.extractedLocation?.name || save.extractedLocation?.city;
            const distLabel = formatDistance(save._distance);
            return (
              <div key={save._id} className="cv-item" onClick={() => onNavigate('save-detail', { id: save._id })}>
                <CategoryThumb save={save} meta={meta} />
                <div className="cv-info">
                  <div className="cv-iname">{save.title}</div>
                  <div className="cv-isub">
                    {loc ? `📍 ${loc}` : (filter === 'link' ? (getDomain(save.url) || save.source || 'Saved') : meta.label)}
                  </div>
                  <span className={`chip ${meta.chipClass}`} style={{ fontSize: 10 }}>{meta.emoji} {meta.shortLabel}</span>
                </div>
                <div className="cv-dist" style={distLabel ? {} : { color: 'var(--mute)', fontWeight: 500, fontSize: 11 }}>
                  {distLabel || getRelativeTime(save.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
