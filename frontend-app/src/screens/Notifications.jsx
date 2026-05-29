import { useEffect, useState } from 'react';
import api from '../api';
import './Notifications.css';

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

const NotificationCard = ({
  notification,
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

  const handleActionClick = (e) => {
    e.stopPropagation();
  };

  const handleViewSave = (e) => {
    handleActionClick(e);
    if (relatedSaveId) {
      onNavigateToSave(relatedSaveId);
    }
  };

  const handleBookNow = (e) => {
    handleActionClick(e);
    if (relatedSaveId) {
      onNavigateToSave(relatedSaveId);
    }
  };

  const handleOpenInMaps = (e) => {
    handleActionClick(e);
    const saveName = metadata?.saveName || 'location';
    const url = `https://maps.google.com/?q=${encodeURIComponent(saveName)}`;
    window.open(url, '_blank');
  };

  const handleTryAgain = (e) => {
    handleActionClick(e);
    window.location.href = '/#/add-save';
  };

  const handlePlanTrip = (e) => {
    handleActionClick(e);
    if (relatedSaveId) {
      onNavigateToSave(relatedSaveId);
    }
  };

  const renderActions = () => {
    switch (type) {
      case 'upload_completed':
        return (
          <div className="notif-actions">
            <button
              className="action-btn btn-forest"
              onClick={handleViewSave}
            >
              View save
            </button>
          </div>
        );

      case 'upload_failed':
        return (
          <div className="notif-actions">
            <button
              className="action-btn btn-amber"
              onClick={handleTryAgain}
            >
              Try again
            </button>
          </div>
        );

      case 'price_drop':
        return (
          <div className="notif-actions">
            <button className="action-btn btn-amber" onClick={handleBookNow}>
              Book now
            </button>
            <button className="action-btn btn-ghost" onClick={handleViewSave}>
              View save
            </button>
          </div>
        );

      case 'nearby_rediscovery':
        return (
          <div className="notif-actions">
            <button className="action-btn btn-forest" onClick={handleOpenInMaps}>
              Open in Maps
            </button>
            <button className="action-btn btn-ghost" onClick={handleViewSave}>
              View save
            </button>
          </div>
        );

      case 'time_behavioral':
        return (
          <div className="notif-actions">
            <button className="action-btn btn-forest" onClick={handlePlanTrip}>
              Plan trip
            </button>
          </div>
        );

      case 'forgotten_intent':
        return (
          <div className="notif-actions">
            <button className="action-btn btn-purple" onClick={handleViewSave}>
              View save
            </button>
            <button className="action-btn btn-ghost" onClick={handleActionClick}>
              Not interested
            </button>
          </div>
        );

      case 'seasonal':
      case 'smart_collection':
        return (
          <div className="notif-actions">
            <button className="action-btn btn-forest" onClick={handleViewSave}>
              {type === 'smart_collection' ? 'View collection' : 'View save'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const getCardConfig = () => {
    const configs = {
      upload_completed: {
        cardClass: 'upload-success-card',
        iconBg: 'ico-success',
        icon: 'ti-bookmark-check',
      },
      upload_failed: {
        cardClass: 'failed-card',
        iconBg: 'ico-failed',
        icon: 'ti-alert-circle',
      },
      price_drop: {
        cardClass: 'price-card',
        iconBg: 'ico-price',
        icon: 'ti-trending-down',
      },
      nearby_rediscovery: {
        cardClass: 'nearby-card',
        iconBg: 'ico-nearby',
        icon: 'ti-map-pin',
      },
      time_behavioral: {
        cardClass: 'weekend-card',
        iconBg: 'ico-weekend',
        icon: 'ti-calendar-event',
      },
      forgotten_intent: {
        cardClass: 'resurface-card',
        iconBg: 'ico-resurface',
        icon: 'ti-clock-hour-4',
      },
      seasonal: {
        cardClass: 'seasonal-card',
        iconBg: 'ico-seasonal',
        icon: 'ti-cloud-rain',
      },
      smart_collection: {
        cardClass: 'smart-collection-card',
        iconBg: 'ico-success',
        icon: 'ti-layout-grid',
      },
    };

    return configs[type] || {
      cardClass: 'default-card',
      iconBg: 'ico-success',
      icon: 'ti-bell',
    };
  };

  const config = getCardConfig();

  return (
    <div
      className={`notif-card ${config.cardClass} ${isUnread ? 'unread-card' : ''}`}
      onClick={handleCardClick}
    >
      <div className={`notif-icon-wrap ${config.iconBg}`}>
        <i className={`ti ${config.icon}`} aria-hidden="true" />
      </div>

      <div className="notif-body">
        <div className="notif-title">{title}</div>
        <div className="notif-msg">{message}</div>

        {/* Price badge for price_drop */}
        {type === 'price_drop' && metadata?.priceOld && metadata?.priceNew && (
          <div className="price-badge">
            <i className="ti ti-tag" aria-hidden="true" />
            <span className="price-old">{formatPrice(metadata.priceOld)}</span>
            <span style={{ color: 'var(--mute)' }}>→</span>
            <span className="price-new">{formatPrice(metadata.priceNew)}</span>
          </div>
        )}

        {/* Distance display for nearby_rediscovery */}
        {type === 'nearby_rediscovery' && metadata?.distanceKm && (
          <div style={{ fontSize: '13px', color: 'var(--slate)', marginTop: '6px' }}>
            {metadata.distanceKm.toFixed(1)} km away
          </div>
        )}

        {/* Days old save for forgotten_intent */}
        {type === 'forgotten_intent' && metadata?.daysOldSave && (
          <div style={{ fontSize: '13px', color: 'var(--slate)', marginTop: '6px' }}>
            {metadata.daysOldSave} days ago
          </div>
        )}

        {/* Save count chip for time_behavioral or seasonal */}
        {(type === 'time_behavioral' || type === 'seasonal') && metadata?.savedCount > 1 && (
          <div className="save-chip">
            <i className="ti ti-bookmark" aria-hidden="true" />
            {metadata.savedCount} saved places
          </div>
        )}

        {/* Season chip for seasonal */}
        {type === 'seasonal' && metadata?.season && (
          <div className="save-chip">
            <i className={`ti ${getSeasonIcon(metadata.season)}`} aria-hidden="true" />
            {metadata.season} season
          </div>
        )}

        {/* Actions */}
        {renderActions()}
      </div>

      <div className="notif-right">
        <span className="notif-time">{timeAgo(sentAt)}</span>
        {/* Only show dismiss button for unread notifications */}
        {isUnread && (
          <button
            className="dismiss-btn"
            onClick={handleDismissClick}
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>

      {isUnread && <div className="unread-dot" />}
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

  const PAGE_SIZE = 10;

  // Only load notifications when screen mounts (lazy load)
  useEffect(() => {
    setScreenMounted(true);
  }, []);

  useEffect(() => {
    if (screenMounted) {
      loadNotifications(0);
    }
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
      loadNotifications();
    }
  };

  const handleDismiss = async (id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await api.dismissNotification(id);
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      loadNotifications();
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
      loadNotifications();
    }
  };

  const handleNavigateToSave = (saveId) => {
    onNavigate('save-detail', { id: saveId });
  };

  const unreadCount = notifications.filter(
    (n) => n.status === 'sent' || n.status === 'pending'
  ).length;

  const smartReminders = notifications.filter(
    (n) =>
      [
        'price_drop',
        'nearby_rediscovery',
        'time_behavioral',
        'seasonal',
        'forgotten_intent',
        'smart_collection',
      ].includes(n.type)
  );

  const uploads = notifications.filter(
    (n) => ['upload_completed', 'upload_failed'].includes(n.type)
  );

  if (!loading && notifications.length === 0) {
    return (
      <div className="phone-frame">
        <div className="notifications-container">
          <div className="topbar">
            <button
              className="back-btn"
              onClick={() => onNavigate('home')}
              aria-label="Go back"
            >
              <i className="ti ti-arrow-left" aria-hidden="true" />
            </button>
            <h1 className="topbar-title">Notifications</h1>
            <span className="unread-pill all-read">All read</span>
          </div>

          <div className="notifications-empty">
            <i className="ti ti-bell" aria-hidden="true" />
            <h2>You're all caught up</h2>
            <p>Smart reminders will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      <div className="notifications-container">
        <div className="topbar sticky">
          <button
            className="back-btn"
            onClick={() => onNavigate('home')}
            aria-label="Go back"
          >
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <h1 className="topbar-title">Notifications</h1>
          <span className={`unread-pill ${unreadCount === 0 ? 'all-read' : ''}`}>
            {unreadCount > 0 ? `${unreadCount} new` : 'All read'}
          </span>
        </div>

        {unreadCount > 0 && (
          <button className="mark-all-btn" onClick={handleMarkAllAsRead}>
            <i className="ti ti-checks" aria-hidden="true" />
            Mark all as read
          </button>
        )}

        {loading ? (
          <div className="notifications-loading">
            <p>Loading…</p>
          </div>
        ) : error ? (
          <div className="notifications-error">
            <p>{error}</p>
          </div>
        ) : (
          <div className="notifications-content">
            {/* Smart Reminders Section */}
            {smartReminders.length > 0 && (
              <>
                <div className="section-label">Smart reminders</div>
                <div className="notif-list">
                  {smartReminders.map((notif) => (
                    <NotificationCard
                      key={notif._id}
                      notification={notif}
                      onMarkRead={handleMarkRead}
                      onDismiss={handleDismiss}
                      onNavigateToSave={handleNavigateToSave}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Uploads Section */}
            {uploads.length > 0 && (
              <>
                <div className="section-label">Uploads</div>
                <div className="notif-list">
                  {uploads.map((notif) => (
                    <NotificationCard
                      key={notif._id}
                      notification={notif}
                      onMarkRead={handleMarkRead}
                      onDismiss={handleDismiss}
                      onNavigateToSave={handleNavigateToSave}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Load More Button */}
            {hasMore && (
              <button
                className="load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore && <span className="load-more-spinner" />}
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            )}

            <div className="section-end" />
          </div>
        )}
      </div>
    </div>
  );
}
