import { useState, useEffect } from 'react';
import api from '../api';
import { getCategoryMeta, categoryMatchesFilter, CATEGORY_FILTERS } from '../categoryMeta';
import SaveCard from '../components/SaveCard';
import SearchBar from '../components/SearchBar';

const getGreeting = (userName) => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}${userName ? `, ${userName}` : ''}`;
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

const getNewCount = (saves) => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return saves.filter(s => new Date(s.createdAt).getTime() > weekAgo).length;
};

const getScreenshotCount = (save) => {
  // Try multiple field paths for screenshot count
  return save.screenshotCount
    || save.screenshots?.length
    || save.raw?.screenshots?.length
    || save.metadata?.screenshotCount
    || save.aiAnalysis?.screenshotAnalysis?.data?.totalScreenshots
    || save.aiAnalysis?.screenshots?.length
    || 0;
};

const isVideo = (save) => save.contentType === 'video' || save.source === 'instagram' || save.source === 'youtube';
const isScreenshot = (save) => save.source === 'screenshot_bundle' || (save.contentType === 'image' && save.source === 'screenshot');

const getSmartNotifications = (notifications) => {
  const smartTypes = ['time_behavioral', 'seasonal', 'nearby_rediscovery', 'forgotten_intent'];
  return notifications
    .filter(n => smartTypes.includes(n.type) && n.status === 'sent')
    .slice(0, 3);
};

const getCompletedSaves = (saves) => {
  return saves
    .filter(s => s.intentStatus === 'tried')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5);
};

// Small chip showing a save's category bucket (Eat / Travel / Shop / Cook / Learn / Saved)
function CategoryChip({ category }) {
  const meta = getCategoryMeta(category);
  return <span className={`chip ${meta.chipClass}`}>{meta.emoji} {meta.shortLabel}</span>;
}

// Round/square thumbnail: shows the save's image, or a category-colored gradient + icon
function Thumb({ save, size, radius, fallbackIcon }) {
  const meta = getCategoryMeta(save.category);
  return (
    <div className={save.thumbnail ? '' : meta.gradientClass} style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36,
      color: '#fff', position: 'relative',
    }}>
      {save.thumbnail
        ? <img src={save.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <i className={`ti ${fallbackIcon || meta.icon}`}></i>}
    </div>
  );
}

export default function HomeFeed({ onNavigate, payload, nearbySaves = [], showNearbyBanner = false, onDismissNearby = () => {} }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user?.name?.split(' ')[0] || '';
  const [saves, setSaves] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [savesRes, notifsRes] = await Promise.all([
          api.getSaves(),
          api.getNotifications(),
        ]);
        if (savesRes.status === 'success') setSaves(savesRes.data);
        if (notifsRes.status === 'success') {
          setNotifications(notifsRes.data?.notifications || []);
        }
      } catch (err) {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (payload?.refresh) {
      setLoading(true);
      const fetch = async () => {
        try {
          const result = await api.getSaves();
          if (result.status === 'success') setSaves(result.data);
        } finally {
          setLoading(false);
        }
      };
      fetch();
    }
  }, [payload?.refresh]);

  const getFilteredSaves = () => {
    if (activeFilter === 'all') return saves;
    return saves.filter(s => categoryMatchesFilter(s.category, activeFilter));
  };

  const filteredSaves = getFilteredSaves();
  const videoSaves = filteredSaves.filter(isVideo);
  const bundleSaves = filteredSaves.filter(isScreenshot);
  const otherSaves = filteredSaves.filter(s => !isVideo(s) && !isScreenshot(s)); // Travel, food, links, etc
  const unreadCount = notifications.filter(n => n.status === 'sent').length;

  // Show limited preview on home (all filter), full list when filtering
  const displayVideos = activeFilter === 'all' ? videoSaves.slice(0, 3) : videoSaves;
  const displayBundles = activeFilter === 'all' ? bundleSaves.slice(0, 2) : bundleSaves;

  // Guided new-user state
  const saveCount = saves.filter(s => !s.isTemplate).length;
  const isNewUser = saveCount < 5 && !user?.onboarding?.completed;

  const guidedSubtitle = (() => {
    if (!isNewUser) return `${saveCount} saves · ${getNewCount(saves)} new this week`;
    if (saveCount === 0) return "Let's build your library";
    if (saveCount === 1) return '1 save · keep going!';
    if (saveCount < 5) return `${saveCount} saves · ${5 - saveCount} more to unlock reminders`;
    return `${saveCount} saves · reminders active`;
  })();

  const hasNearby = nearbySaves.length > 0;
  const gridSaves = (showNearbyOnly && hasNearby ? nearbySaves : filteredSaves).slice(0, 4);

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div className="h-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="h-greet">{getGreeting(userName)} 👋</div>
            <div className="h-title">What do you<br />wanna try?</div>
          </div>
          <button
            onClick={() => onNavigate('notifications')}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--paper)',
              border: '0.5px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--slate)',
              fontSize: 17,
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <i className="ti ti-bell"></i>
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--coral)',
              }}></div>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '8px 20px 0' }}>
          <SearchBar onClick={() => onNavigate('search')} />
        </div>

        {/* Category pill row */}
        <div className="hscroll" style={{ display: 'flex', gap: 7, padding: '10px 20px 0' }}>
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`cat-pill ${activeFilter === f.id ? 'cat-pill-active' : ''}`}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Guided progress bar */}
        {isNewUser && (
          <div style={{ height: 3, background: 'var(--coral-faint)', borderRadius: 2, margin: '14px 20px 0' }}>
            <div style={{
              height: '100%',
              borderRadius: 2,
              background: 'var(--coral)',
              width: `${Math.min(saveCount / 5 * 100, 100)}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        )}

        {/* Unlock banner */}
        {isNewUser && (
          <div style={{
            background: 'var(--coral-soft)',
            borderRadius: 8,
            padding: '8px 10px',
            margin: '8px 20px 0',
            fontSize: 12,
            color: 'var(--coral)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <i className="ti ti-target" style={{ fontSize: 14, flexShrink: 0 }} />
            Save <strong style={{ margin: '0 2px' }}>{5 - saveCount} more</strong> to unlock smart reminders
          </div>
        )}

        {/* Subtitle (saves count / new this week) */}
        <div style={{ padding: '8px 20px 0', fontSize: 13, color: 'var(--mute)' }}>
          {guidedSubtitle}
        </div>

        {/* Scrollable content area */}
        <div style={{ flex: 1 }}>
          {/* Nearby banner */}
          {showNearbyBanner && hasNearby && (
            <div style={{
              margin: '14px 20px 0',
              background: '#E5F0FF',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#B8D9FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <i className="ti ti-map-pin" style={{ fontSize: 19, color: 'var(--travel)' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#003D99', marginBottom: 2 }}>
                  {nearbySaves.length === 1 ? `You saved "${nearbySaves[0].title}" nearby` : `${nearbySaves.length} of your saves are nearby`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--travel)' }}>Tap to see them</div>
              </div>
              <button
                onClick={() => onNavigate('nearby')}
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--travel)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                View →
              </button>
              <button
                onClick={onDismissNearby}
                style={{ fontSize: 19, color: '#6BAF94', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          )}

          {filteredSaves.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16, padding: '60px 20px' }}>
              <i className="ti ti-inbox" style={{ fontSize: 48, color: '#ccc' }}></i>
              <div>
                <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>No saves yet</div>
                <div style={{ fontSize: 13, color: 'var(--mute)' }}>Tap + to add your first save</div>
              </div>
            </div>
          ) : (
            <>
              {/* Saved recently / Near you grid */}
              <div className="h-row">
                <span className="h-sec">{showNearbyOnly && hasNearby ? 'Near you' : 'Saved recently'}</span>
                {hasNearby && (
                  <div
                    className={`tgl ${showNearbyOnly ? 'tgl-on' : ''}`}
                    onClick={() => setShowNearbyOnly(v => !v)}
                  >
                    <div className="tgl-k"></div>
                  </div>
                )}
              </div>
              <div className="save-card-grid" style={{ paddingBottom: 14 }}>
                {gridSaves.map((save) => (
                  <SaveCard key={save._id} save={save} onNavigate={onNavigate} />
                ))}
              </div>

              {/* Videos section */}
              {videoSaves.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    <span>Videos & reels</span>
                    <button onClick={() => onNavigate('savedList', { filter: 'video', title: 'Videos & reels' })} style={{ fontSize: 13, color: 'var(--amber-link)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                      {videoSaves.length} saves →
                    </button>
                  </div>
                  {displayVideos.map((save) => (
                    <div key={save._id}>
                      <div
                        onClick={() => onNavigate('save-detail', { id: save._id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 20px',
                          cursor: 'pointer',
                        }}
                      >
                        <Thumb save={save} size={52} radius={10} fallbackIcon="ti-player-play" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                            {save.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--mute)' }}>
                            <CategoryChip category={save.category} />
                            <span>{save.source ? save.source.charAt(0).toUpperCase() + save.source.slice(1) : 'Saved'} · {getRelativeTime(save.createdAt)}</span>
                          </div>
                        </div>
                        <i className="ti ti-chevron-right" style={{ fontSize: 15, color: 'var(--mute)', flexShrink: 0 }}></i>
                      </div>
                      <div style={{ height: '0.5px', background: 'var(--hairline)', margin: '0 20px' }}></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Screenshot bundles section */}
              {bundleSaves.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    <span>Screenshot bundles</span>
                    <button onClick={() => onNavigate('savedList', { filter: 'bundle', title: 'Screenshot bundles' })} style={{ fontSize: 13, color: 'var(--amber-link)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                      {bundleSaves.length} bundles →
                    </button>
                  </div>
                  {displayBundles.map((save) => {
                    const screenshotCount = getScreenshotCount(save);
                    return (
                      <div
                        key={save._id}
                        onClick={() => onNavigate('save-detail', { id: save._id })}
                        style={{
                          margin: '0 20px 8px',
                          background: 'var(--paper)',
                          border: '0.5px solid var(--hairline-soft)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <Thumb save={save} size={44} radius={10} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                            {save.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--mute)' }}>
                            <CategoryChip category={save.category} />
                            <span>
                              {screenshotCount > 0 && `${screenshotCount} screenshot${screenshotCount !== 1 ? 's' : ''} · `}
                              {getRelativeTime(save.createdAt)}
                            </span>
                          </div>
                        </div>
                        <i className="ti ti-chevron-right" style={{ fontSize: 15, color: 'var(--mute)', flexShrink: 0 }}></i>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Other saves (Travel, Food, Links, etc) */}
              {otherSaves.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    <span>Saved</span>
                    <button onClick={() => onNavigate('savedList', { filter: 'all', title: 'All saves' })} style={{ fontSize: 13, color: 'var(--amber-link)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                      {otherSaves.length} saves →
                    </button>
                  </div>
                  {otherSaves.slice(0, activeFilter === 'all' ? 5 : otherSaves.length).map((save) => (
                    <div key={save._id}>
                      <div
                        onClick={() => onNavigate('save-detail', { id: save._id })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 20px',
                          cursor: 'pointer',
                        }}
                      >
                        <Thumb save={save} size={52} radius={10} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                            {save.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--mute)' }}>
                            <CategoryChip category={save.category} />
                            <span>{save.source ? save.source.charAt(0).toUpperCase() + save.source.slice(1) : 'Saved'} · {getRelativeTime(save.createdAt)}</span>
                          </div>
                        </div>
                        <i className="ti ti-chevron-right" style={{ fontSize: 15, color: 'var(--mute)', flexShrink: 0 }}></i>
                      </div>
                      <div style={{ height: '0.5px', background: 'var(--hairline)', margin: '0 20px' }}></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Smart Reminders Strip */}
              {getSmartNotifications(notifications).length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    <span>Smart reminders</span>
                    <button onClick={() => onNavigate('notifications')} style={{ fontSize: 13, color: 'var(--amber-link)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                      See all →
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 12, padding: '0 20px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {getSmartNotifications(notifications).map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => onNavigate('notifications')}
                        style={{
                          flex: '0 0 200px',
                          background: 'var(--paper)',
                          border: '0.5px solid var(--hairline)',
                          borderRadius: 14,
                          padding: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3, maxHeight: '2.6em', overflow: 'hidden' }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notif.message}
                        </div>
                        <button style={{
                          fontSize: 11,
                          background: 'var(--coral)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 20,
                          padding: '3px 10px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}>
                          Explore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recently Completed */}
              {getCompletedSaves(saves).length > 0 && (
                <div>
                  <div style={{ padding: '16px 20px 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    Recently completed
                  </div>
                  <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {getCompletedSaves(saves).map((save) => (
                      <div
                        key={save._id}
                        onClick={() => onNavigate('save-detail', { id: save._id })}
                        style={{
                          flex: '0 0 auto',
                          background: 'var(--paper)',
                          border: '0.5px solid var(--hairline)',
                          borderRadius: 10,
                          padding: '8px 12px',
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        <div style={{ position: 'relative' }}>
                          <Thumb save={save} size={36} radius={8} />
                          <div style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            width: 16,
                            height: 16,
                            background: 'var(--coral)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            ✓
                          </div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                          {save.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ height: 16 }}></div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
