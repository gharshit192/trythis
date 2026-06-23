import { useEffect, useState } from 'react';
import api from '../api';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

const formatPrice = (price) => {
  if (!price) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(price);
};

const getSeasonIcon = (season) => {
  if (!season) return 'ti-cloud-rain';
  const seasonLower = season.toLowerCase();
  if (seasonLower.includes('monsoon')) return 'ti-cloud-rain';
  if (seasonLower.includes('summer')) return 'ti-sun';
  if (seasonLower.includes('winter')) return 'ti-snowflake';
  return 'ti-leaf';
};

const TYPE_STYLE = {
  upload_completed: { bg: 'rgba(0,168,107,.12)', color: 'var(--cook)', icon: 'ti-bookmark-check' },
  upload_failed: { bg: 'rgba(14,124,123,.1)', color: 'var(--coral)', icon: 'ti-alert-circle' },
  price_drop: { bg: 'rgba(255,154,0,.12)', color: '#9a6800', icon: 'ti-trending-down' },
  nearby_rediscovery: { bg: 'rgba(14,124,123,.12)', color: 'var(--coral)', icon: 'ti-map-pin' },
  time_behavioral: { bg: 'rgba(0,102,255,.1)', color: 'var(--travel)', icon: 'ti-calendar-event' },
  forgotten_intent: { bg: 'rgba(124,34,255,.1)', color: 'var(--shop)', icon: 'ti-clock-hour-4' },
  seasonal: { bg: 'rgba(0,102,255,.1)', color: 'var(--travel)', icon: 'ti-cloud-rain' },
  smart_collection: { bg: 'rgba(0,168,107,.12)', color: 'var(--cook)', icon: 'ti-layout-grid' },
  default: { bg: 'rgba(176,174,167,.15)', color: 'var(--mute)', icon: 'ti-bell' },
};

// Emoji per type — always render (some tabler glyphs are missing in this build,
// which left the icon tiles blank). Used as the tile glyph / thumbnail fallback.
const TYPE_EMOJI = {
  upload_completed: '✅',
  upload_failed: '⚠️',
  price_drop: '🏷️',
  nearby_rediscovery: '📍',
  time_behavioral: '🗓️',
  forgotten_intent: '⏳',
  seasonal: '🌦️',
  smart_collection: '🗂️',
  weekend_reminder: '🎒',
  resurface: '🔁',
  travel_intelligence: '✈️',
  cultural_event: '🎉',
  weather_good: '☀️',
  weather_aware: '🌦️',
  default: '🔔',
};

// Backend bakes an emoji into some titles (e.g. "✅ Upload ready!"). The icon
// tile already carries the glyph, so strip a leading emoji to avoid doubling up.
const stripLeadingEmoji = (s = '') => s.replace(/^[^\p{L}\p{N}]+/u, '').trim();

const ACTION_STYLE = {
  coral: { background: 'var(--coral)', color: '#fff' },
  amber: { background: 'rgba(255,154,0,.15)', color: '#9a6800' },
  purple: { background: 'rgba(124,34,255,.12)', color: 'var(--shop)' },
  ghost: { background: 'var(--linen)', color: 'var(--slate)' },
};

function ActionButton({ variant, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ ...ACTION_STYLE[variant], border: 'none', fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 14, cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}

const NotificationCard = ({
  notification,
  save,
  onMarkRead,
  onDismiss,
  onNavigateToSave,
}) => {
  const { _id, type, title, message, metadata, sentAt, relatedSaveId } = notification;
  const isUnread = notification.status === 'sent' || notification.status === 'pending';

  const handleCardClick = () => {
    if (isUnread) {
      onMarkRead(_id);
    }
  };

  const handleDismissClick = (e) => {
    e.stopPropagation();
    onDismiss(_id);
  };

  const handleViewSave = (e) => {
    e.stopPropagation();
    if (relatedSaveId) {
      onNavigateToSave(relatedSaveId);
    }
  };

  const handleOpenInMaps = (e) => {
    e.stopPropagation();
    const saveName = metadata?.saveName || 'location';
    const url = `https://maps.google.com/?q=${encodeURIComponent(saveName)}`;
    window.open(url, '_blank');
  };

  const handleTryAgain = (e) => {
    e.stopPropagation();
    window.location.href = '/#/add-save';
  };

  const handleNotInterested = (e) => {
    e.stopPropagation();
  };

  const renderActions = () => {
    switch (type) {
      case 'upload_completed':
        return <ActionButton variant="coral" onClick={handleViewSave}>View save</ActionButton>;

      case 'upload_failed':
        return <ActionButton variant="amber" onClick={handleTryAgain}>Try again</ActionButton>;

      case 'price_drop':
        return (
          <>
            <ActionButton variant="amber" onClick={handleViewSave}>Book now</ActionButton>
            <ActionButton variant="ghost" onClick={handleViewSave}>View save</ActionButton>
          </>
        );

      case 'nearby_rediscovery':
        return (
          <>
            <ActionButton variant="coral" onClick={handleOpenInMaps}>Open in Maps</ActionButton>
            <ActionButton variant="ghost" onClick={handleViewSave}>View save</ActionButton>
          </>
        );

      case 'time_behavioral':
        return <ActionButton variant="coral" onClick={handleViewSave}>Plan trip</ActionButton>;

      case 'forgotten_intent':
        return (
          <>
            <ActionButton variant="purple" onClick={handleViewSave}>View save</ActionButton>
            <ActionButton variant="ghost" onClick={handleNotInterested}>Not interested</ActionButton>
          </>
        );

      case 'seasonal':
      case 'smart_collection':
        return (
          <ActionButton variant="coral" onClick={handleViewSave}>
            {type === 'smart_collection' ? 'View collection' : 'View save'}
          </ActionButton>
        );

      default:
        return null;
    }
  };

  const style = TYPE_STYLE[type] || TYPE_STYLE.default;
  const emoji = TYPE_EMOJI[type] || TYPE_EMOJI.default;
  const actions = renderActions();

  // Use the related save (joined client-side) or the notification metadata
  // (set at creation) to make generic upload notifications meaningful.
  const saveName = save?.title || metadata?.saveTitle || null;
  const thumb = save?.thumbnail || metadata?.thumbnail || null;
  const headline = type === 'upload_completed' && saveName
    ? saveName
    : stripLeadingEmoji(title);
  const subline = type === 'upload_completed'
    ? (saveName ? 'Saved · ready to view' : stripLeadingEmoji(message))
    : message;

  return (
    <div className={`nf-item ${isUnread ? 'nf-item-unread' : 'nf-read-item'}`} onClick={handleCardClick}>
      {isUnread && (
        <button className="nf-dismiss" onClick={handleDismissClick} aria-label="Dismiss notification" title="Dismiss">
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      )}

      <div className="nf-ico" style={{ background: style.bg, color: style.color, overflow: 'hidden', position: 'relative' }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
        {thumb && (
          <img
            src={thumb}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.currentTarget.remove(); }}
          />
        )}
      </div>

      <div className="nf-body">
        <div className="nf-iname">{headline}</div>
        <div className="nf-isub">{subline}</div>

        {type === 'price_drop' && metadata?.priceOld && metadata?.priceNew && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF0CC', color: '#7a5000', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, marginTop: 5 }}>
            <span style={{ textDecoration: 'line-through', color: 'var(--mute)', fontWeight: 400 }}>{formatPrice(metadata.priceOld)}</span>
            <span>→</span>
            <span style={{ color: '#1b5e1f' }}>{formatPrice(metadata.priceNew)}</span>
          </div>
        )}

        {type === 'nearby_rediscovery' && metadata?.distanceKm != null && (
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>{metadata.distanceKm.toFixed(1)} km away</div>
        )}

        {type === 'forgotten_intent' && metadata?.daysOldSave && (
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>{metadata.daysOldSave} days ago</div>
        )}

        {(type === 'time_behavioral' || type === 'seasonal') && metadata?.savedCount > 1 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--coral-soft)', color: 'var(--coral)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, marginTop: 5, marginRight: 5 }}>
            <i className="ti ti-bookmark" aria-hidden="true" /> {metadata.savedCount} saved places
          </div>
        )}

        {type === 'seasonal' && metadata?.season && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--coral-soft)', color: 'var(--coral)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, marginTop: 5 }}>
            <i className={`ti ${getSeasonIcon(metadata.season)}`} aria-hidden="true" /> {metadata.season} season
          </div>
        )}

        {actions && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {actions}
          </div>
        )}
      </div>

      <span className="nf-time">{timeAgo(sentAt)}</span>
    </div>
  );
};

export default function Notifications({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [screenMounted, setScreenMounted] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [, setPagination] = useState(null);
  const [savesById, setSavesById] = useState({});

  const PAGE_SIZE = 10;

  // Join notifications to the user's saves so generic "Upload ready"
  // notifications can show the real save title + thumbnail.
  useEffect(() => {
    api.getSaves()
      .then((res) => {
        if (res.status === 'success' && Array.isArray(res.data)) {
          const map = {};
          res.data.forEach((s) => { map[s._id] = s; });
          setSavesById(map);
        }
      })
      .catch(() => {});
  }, []);

  // Only load notifications when screen mounts (lazy load)
  useEffect(() => {
    setScreenMounted(true);
  }, []);

  useEffect(() => {
    if (screenMounted) {
      loadNotifications(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenMounted]);

  const loadNotifications = async (pageOffset) => {
    if (pageOffset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await api.getNotifications(PAGE_SIZE, pageOffset);
      if (res.status === 'success') {
        const newNotifications = res.data.notifications || [];
        if (pageOffset === 0) {
          setNotifications(newNotifications);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
        }
        setPagination(res.data.pagination);
        setHasMore(res.data.pagination?.hasMore || false);
        setOffset(pageOffset);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadNotifications(offset + PAGE_SIZE);
    }
  };

  const handleMarkRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === id ? { ...n, status: 'opened' } : n
      )
    );
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      loadNotifications(0);
    }
  };

  const handleDismiss = async (id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await api.dismissNotification(id);
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      loadNotifications(0);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications
      .filter((n) => n.status === 'sent' || n.status === 'pending')
      .map((n) => n._id);

    if (unreadIds.length === 0) return;

    setNotifications((prev) =>
      prev.map((n) =>
        unreadIds.includes(n._id) ? { ...n, status: 'opened' } : n
      )
    );

    try {
      await Promise.all(
        unreadIds.map((id) => api.markNotificationRead(id))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      loadNotifications(0);
    }
  };

  const handleNavigateToSave = (saveId) => {
    onNavigate('save-detail', { id: saveId });
  };

  const unreadCount = notifications.filter(
    (n) => n.status === 'sent' || n.status === 'pending'
  ).length;

  const UPLOAD_TYPES = ['upload_completed', 'upload_failed'];
  // Everything that isn't an upload is a "smart reminder" — covers all current
  // and future trigger types (weekend_reminder, resurface, travel_*, weather_*…).
  const smartReminders = notifications.filter((n) => !UPLOAD_TYPES.includes(n.type));
  const uploads = notifications.filter((n) => UPLOAD_TYPES.includes(n.type));

  if (!loading && notifications.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
        <div className="nf-hdr">
          <span className="nf-title">Notifications</span>
        </div>
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <i className="ti ti-bell" style={{ fontSize: 48, color: 'var(--hairline-soft)', marginBottom: 16, display: 'block' }}></i>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>You're all caught up</div>
          <div style={{ fontSize: 13, color: 'var(--mute)' }}>Smart reminders will appear here</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
      <div className="nf-hdr">
        <span className="nf-title">Notifications</span>
        {unreadCount > 0 && (
          <span className="nf-read" onClick={handleMarkAllAsRead}>Mark all read</span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: 'var(--mute)' }}>Loading...</div>
        </div>
      ) : error ? (
        <div style={{ padding: '20px' }}>
          <p style={{ color: '#d33', fontSize: 14 }}>{error}</p>
        </div>
      ) : (
        <>
          {smartReminders.length > 0 && (
            <>
              <div className="nf-grp">Smart reminders</div>
              <div className="nf-list">
                {smartReminders.map((notif) => (
                  <NotificationCard
                    key={notif._id}
                    notification={notif}
                    save={savesById[notif.relatedSaveId]}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismiss}
                    onNavigateToSave={handleNavigateToSave}
                  />
                ))}
              </div>
            </>
          )}

          {uploads.length > 0 && (
            <>
              <div className="nf-grp" style={{ marginTop: 12 }}>Uploads</div>
              <div className="nf-list">
                {uploads.map((notif) => (
                  <NotificationCard
                    key={notif._id}
                    notification={notif}
                    save={savesById[notif.relatedSaveId]}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismiss}
                    onNavigateToSave={handleNavigateToSave}
                  />
                ))}
              </div>
            </>
          )}

          {hasMore && (
            <div style={{ padding: '16px 20px 20px' }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 12, background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          <div style={{ height: 20 }} />
        </>
      )}
    </div>
  );
}
