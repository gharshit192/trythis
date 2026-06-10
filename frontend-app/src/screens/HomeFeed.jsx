import { useState, useEffect } from 'react';
import api from '../api';

const FILTER_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Videos' },
  { id: 'screenshots', label: 'Screenshots' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'shopping', label: 'Shopping' },
];

const getCategoryInfo = (category) => {
  const map = {
    food: { bg: '#fff0e8', color: '#9a3c14', icon: 'ti-tools-kitchen-2' },
    restaurant: { bg: '#fff0e8', color: '#9a3c14', icon: 'ti-tools-kitchen-2' },
    cafe: { bg: '#fff0e8', color: '#9a3c14', icon: 'ti-tools-kitchen-2' },
    travel: { bg: '#daeaf8', color: '#1a5f8a', icon: 'ti-map-2' },
    experience: { bg: '#fce8df', color: '#9a3c14', icon: 'ti-ticket' },
    shopping: { bg: '#fef0cc', color: '#9a6800', icon: 'ti-shopping-bag' },
    'home-decor': { bg: '#ebd9c2', color: '#7a4a10', icon: 'ti-building-skyscraper' },
    tech: { bg: '#e8e4f8', color: '#4a3db0', icon: 'ti-device-laptop' },
  };
  return map[category] || { bg: '#e8efe9', color: '#1b3a2f', icon: 'ti-bookmark' };
};

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
    || save.aiAnalysis?.screenshots?.length
    || 0;
};

const isVideo = (save) => save.contentType === 'video' || save.source === 'instagram' || save.source === 'youtube';
const isScreenshot = (save) => save.source === 'screenshot_bundle' || (save.contentType === 'image' && save.source === 'screenshot');
const isTravel = (save) => save.category === 'travel' || save.category === 'experience';
const isFood = (save) => save.category === 'food' || save.category === 'restaurant' || save.category === 'cafe';
const isShopping = (save) => save.category === 'shopping';

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

export default function HomeFeed({ onNavigate, payload, nearbySaves = [], showNearbyBanner = false, onDismissNearby = () => {} }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = user?.name?.split(' ')[0] || '';
  const [saves, setSaves] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

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
    switch (activeFilter) {
      case 'video': return saves.filter(isVideo);
      case 'screenshots': return saves.filter(isScreenshot);
      case 'travel': return saves.filter(isTravel);
      case 'food': return saves.filter(isFood);
      case 'shopping': return saves.filter(isShopping);
      default: return saves;
    }
  };

  const filteredSaves = getFilteredSaves();
  const videoSaves = filteredSaves.filter(isVideo);
  const bundleSaves = filteredSaves.filter(isScreenshot);
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

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
        {/* Top bar */}
        <div style={{
          padding: '18px 16px 10px',
          background: 'var(--paper)',
          borderBottom: '0.5px solid var(--hairline)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>
                {getGreeting(userName)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 1 }}>
                {guidedSubtitle}
              </div>
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
                fontSize: 16,
                cursor: 'pointer',
                position: 'relative',
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
                  background: 'var(--forest)',
                }}></div>
              )}
            </button>
          </div>
        </div>

        {/* Guided progress bar */}
        {isNewUser && (
          <div style={{ height: 3, background: 'var(--forest-faint)', borderRadius: 2, margin: '8px 16px 0' }}>
            <div style={{
              height: '100%',
              borderRadius: 2,
              background: 'var(--forest)',
              width: `${Math.min(saveCount / 5 * 100, 100)}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        )}

        {/* Unlock banner */}
        {isNewUser && (
          <div style={{
            background: 'var(--forest-soft)',
            borderRadius: 8,
            padding: '8px 10px',
            margin: '8px 16px 0',
            fontSize: 11,
            color: 'var(--forest)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <i className="ti ti-target" style={{ fontSize: 13, flexShrink: 0 }} />
            Save <strong style={{ margin: '0 2px' }}>{5 - saveCount} more</strong> to unlock smart reminders
          </div>
        )}

        {/* Filter pills */}
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '8px 16px 0',
          overflow: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}>
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.id}
              onClick={() => setActiveFilter(pill.id)}
              style={{
                whiteSpace: 'nowrap',
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: activeFilter === pill.id ? 'none' : '0.5px solid var(--hairline)',
                background: activeFilter === pill.id ? 'var(--forest)' : 'var(--paper)',
                color: activeFilter === pill.id ? '#fff' : 'var(--slate)',
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Scrollable content area */}
        <div style={{ flex: 1 }}>
          {/* Nearby banner */}
          {showNearbyBanner && nearbySaves.length > 0 && (
            <div style={{
              margin: '16px 16px 0',
              background: '#E1F5EE',
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
                background: '#9FE1CB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <i className="ti ti-map-pin" style={{ fontSize: 18, color: '#0F6E56' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#085041', marginBottom: 2 }}>
                  {nearbySaves.length === 1 ? `You saved "${nearbySaves[0].title}" nearby` : `${nearbySaves.length} of your saves are nearby`}
                </div>
                <div style={{ fontSize: 11, color: '#0F6E56' }}>Tap to see them</div>
              </div>
              <button
                onClick={() => onNavigate('savedList', { filter: 'nearby', saves: nearbySaves, title: 'Nearby saves' })}
                style={{ fontSize: 11, fontWeight: 500, color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                View →
              </button>
              <button
                onClick={onDismissNearby}
                style={{ fontSize: 18, color: '#6BAF94', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          )}

          {filteredSaves.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16 }}>
              <i className="ti ti-inbox" style={{ fontSize: 48, color: '#ccc' }}></i>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>No saves yet</div>
                <div style={{ fontSize: 12, color: 'var(--mute)' }}>Tap + to add your first save</div>
              </div>
            </div>
          ) : (
            <>
              {/* Videos section */}
              {videoSaves.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    <span>Videos & reels</span>
                    <button onClick={() => onNavigate('savedList', { filter: 'video', title: 'Videos & reels' })} style={{ fontSize: 12, color: 'var(--amber-link)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
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
                          padding: '10px 16px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          width: 52,
                          height: 52,
                          borderRadius: 10,
                          background: getCategoryInfo(save.category).bg,
                          flexShrink: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          color: getCategoryInfo(save.category).color,
                        }}>
                          {save.thumbnail ? <img src={save.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ti ti-player-play"></i>}
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
                              background: getCategoryInfo(save.category).bg,
                              color: getCategoryInfo(save.category).color,
                            }}>
                              {save.category?.charAt(0).toUpperCase() + save.category?.slice(1)}
                            </span>
                            {save.source ? save.source.charAt(0).toUpperCase() + save.source.slice(1) : 'Saved'} · {getRelativeTime(save.createdAt)}
                          </div>
                        </div>
                        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--mute)', flexShrink: 0 }}></i>
                      </div>
                      <div style={{ height: '0.5px', background: 'var(--hairline)', margin: '0 16px' }}></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Screenshot bundles section */}
              {bundleSaves.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    <span>Screenshot bundles</span>
                    <button onClick={() => onNavigate('savedList', { filter: 'bundle', title: 'Screenshot bundles' })} style={{ fontSize: 12, color: 'var(--amber-link)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                      {bundleSaves.length} bundles →
                    </button>
                  </div>
                  {displayBundles.map((save) => {
                    const catInfo = getCategoryInfo(save.category);
                    const screenshotCount = getScreenshotCount(save);
                    return (
                      <div
                        key={save._id}
                        onClick={() => onNavigate('save-detail', { id: save._id })}
                        style={{
                          margin: '0 16px 8px',
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
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: catInfo.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: catInfo.color,
                          fontSize: 18,
                          flexShrink: 0,
                        }}>
                          <i className={`ti ${catInfo.icon}`}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                            {save.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                            {screenshotCount > 0 && `${screenshotCount} screenshot${screenshotCount !== 1 ? 's' : ''} · `}
                            {save.category?.charAt(0).toUpperCase() + save.category?.slice(1)} · {getRelativeTime(save.createdAt)}
                          </div>
                        </div>
                        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--mute)', flexShrink: 0 }}></i>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Smart Reminders Strip */}
              {getSmartNotifications(notifications).length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    <span>Smart reminders</span>
                    <button onClick={() => onNavigate('notifications')} style={{ fontSize: 12, color: 'var(--amber-link)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                      See all →
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 12, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3, maxHeight: '2.6em', overflow: 'hidden' }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notif.message}
                        </div>
                        <button style={{
                          fontSize: 10,
                          background: 'var(--forest)',
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
                  <div style={{ padding: '16px 16px 8px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>
                    Recently completed
                  </div>
                  <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
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
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: getCategoryInfo(save.category).bg,
                          flexShrink: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          color: getCategoryInfo(save.category).color,
                          position: 'relative',
                        }}>
                          {save.thumbnail ? <img src={save.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className={`ti ${getCategoryInfo(save.category).icon}`}></i>}
                          <div style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            width: 16,
                            height: 16,
                            background: 'var(--forest)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 600,
                          }}>
                            ✓
                          </div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
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
