import { useEffect, useState } from 'react';
import api from '../api';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function Notifications({ onNavigate }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      if (res.status === 'success') setList(res.data.notifications);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDismiss = async (id) => {
    await api.dismissNotification(id);
    setList((prev) => prev.filter((n) => n._id !== id));
  };

  const handleMarkRead = async (id) => {
    await api.markNotificationRead(id);
    setList((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="phone-frame">
      <div style={{ background: 'var(--paper)', flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '12px 16px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid #eee' }}>
          <button onClick={() => onNavigate('home')} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <h1 className="display" style={{ fontSize: '18px', margin: 0 }}>Notifications</h1>
        </div>
        <div style={{ padding: '0 20px 80px', flex: 1 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--slate)', textAlign: 'center', padding: 24 }}>Loading…</p>
          ) : error ? (
            <p style={{ color: 'var(--error,#d33)', padding: 16 }}>{error}</p>
          ) : list.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--slate)', textAlign: 'center', padding: 24 }}>No notifications.</p>
          ) : (
            list.map((n) => (
              <div
                key={n._id}
                style={{
                  background: n.read ? 'var(--linen)' : 'var(--forest-faint)',
                  borderRadius: '12px', padding: '12px 14px', marginBottom: '10px',
                  display: 'flex', gap: '12px', cursor: 'pointer',
                }}
                onClick={() => !n.read && handleMarkRead(n._id)}
              >
                <div style={{ width: '36px', height: '36px', background: 'var(--forest)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="ti ti-bell" style={{ fontSize: '16px', color: 'var(--linen)' }}></i>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--ink)' }}>{n.message}</p>
                  <p style={{ fontSize: '12px', color: 'var(--slate)', marginTop: '2px' }}>{n.trigger || n.type}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <p style={{ fontSize: '11px', color: 'var(--mute)', whiteSpace: 'nowrap' }}>{timeAgo(n.createdAt)}</p>
                  <button onClick={(e) => { e.stopPropagation(); handleDismiss(n._id); }} style={{ background: 'transparent', border: 'none', color: 'var(--slate)', cursor: 'pointer', fontSize: 11 }}>Dismiss</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
