import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import SectionLabel from '../../components/SectionLabel';
import EmptyState from '../../components/EmptyState';

// "For you" — smart notifications grouped by when they matter (ADR 0015).
// One action per row; unread rows carry the attention dot.
const PAGE = 30;
const DAY = 86400000;
const isUnread = (n) => n.status === 'sent' || n.status === 'pending';

// type → tile kind + glyph. Types are open strings from the trigger modules.
const glyphFor = (type = '', category = '') => {
  if (/nearby|location|distance/.test(type)) return { kind: 'place', icon: 'pin' };
  if (/weekend|time_|seasonal|weather|cultural/.test(type)) return { kind: 'food', icon: 'calendar' };
  if (/price/.test(type)) return { kind: 'shop', icon: 'trend' };
  if (/forgotten|resurface|intent/.test(type)) return { kind: 'place', icon: 'clock' };
  if (/upload/.test(type)) return { kind: 'learn', icon: 'sparkle' };
  if (/travel/.test(type)) return { kind: 'place', icon: 'pin' };
  return { kind: 'none', icon: 'bell' };
};
const saveIdOf = (n) => n.relatedSaveId?._id || n.relatedSaveId || (n.actionUrl || '').match(/\/saves\/([A-Za-z0-9]+)/)?.[1] || null;
const groupOf = (n) => {
  const age = Date.now() - new Date(n.sentAt || n.createdAt).getTime();
  if (age < DAY) return 'Right now';
  if (age < 7 * DAY) return 'This week';
  return 'Earlier';
};

export default function Notifications({ onNavigate, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.getNotifications(PAGE, 0);
      if (res?.status === 'success') setItems(res.data?.notifications || []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (n) => {
    if (isUnread(n)) { setItems((p) => p.map((x) => x._id === n._id ? { ...x, status: 'opened' } : x)); api.markNotificationRead(n._id).catch(() => {}); }
    const id = saveIdOf(n);
    if (id) onNavigate('save-detail', { id });
  };
  const dismiss = async (n) => {
    setItems((p) => p.filter((x) => x._id !== n._id));
    api.dismissNotification(n._id).catch(() => {});
  };
  const readAll = async () => {
    setItems((p) => p.map((x) => isUnread(x) ? { ...x, status: 'opened' } : x));
    api.markAllNotificationsRead().catch(() => {});
  };

  const groups = ['Right now', 'This week', 'Earlier'].map((g) => [g, items.filter((n) => groupOf(n) === g)]).filter(([, l]) => l.length);

  return (
    <div className="wt-screen">
      <div className="wt-topbar" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" className="wt-iconbtn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
          <h1 className="wt-title" style={{ fontSize: 28 }}>For you</h1>
        </div>
        {items.some(isUnread) && <span className="wt-link" style={{ fontSize: 13, fontWeight: 500 }} onClick={readAll}>Mark all read</span>}
      </div>

      {!loading && items.length === 0 && (
        <EmptyState title="Nothing yet" text="When something you saved becomes worth doing — you're nearby, it's the weekend, the price dropped — it shows up here." />
      )}

      {groups.map(([label, list]) => (
        <section key={label} style={{ marginBottom: 20 }}>
          <SectionLabel>{label}</SectionLabel>
          {list.map((n) => {
            const { kind, icon } = glyphFor(n.type, n.category);
            const unread = isUnread(n);
            const nearby = /nearby|location/.test(n.type || '');
            return (
              <div key={n._id} className="wt-row top" style={{ cursor: 'default' }}>
                <div className={`wt-tile ${kind}`}><Icon name={icon} size={20} /></div>
                <div className="wt-row-body" style={{ gap: 4 }}>
                  <span className="wt-row-title" style={{ fontSize: 17, color: unread ? 'var(--ink)' : 'var(--mute)' }} onClick={() => open(n)}>{n.title}</span>
                  {n.message && <span className="wt-row-meta" style={{ fontSize: 13.5, color: unread ? 'var(--mute)' : 'var(--faint)' }}>{n.message}</span>}
                  {unread && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button type="button" onClick={() => open(n)} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--teal)', border: 0, padding: '7px 13px', borderRadius: 9, cursor: 'pointer' }}>{nearby ? 'Directions' : saveIdOf(n) ? 'Open' : 'Got it'}</button>
                      <button type="button" onClick={() => dismiss(n)} style={{ fontSize: 13, fontWeight: 500, color: 'var(--mute)', background: 'none', border: 0, padding: '7px 10px', cursor: 'pointer' }}>Not today</button>
                    </div>
                  )}
                </div>
                {unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--attention)', flexShrink: 0, marginTop: 6 }} />}
              </div>
            );
          })}
        </section>
      ))}

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--faint)', paddingTop: 20 }}>
        <Icon name="settings" size={15} />
        <span style={{ fontSize: 13 }}>Only when something's worth it. Never more than one a day.</span>
      </div>
    </div>
  );
}
