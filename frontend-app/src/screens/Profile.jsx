import { useEffect, useMemo, useState } from 'react';
import api from '../api';

const SOURCE_LABEL = {
  instagram: 'Instagram',
  youtube:   'YouTube',
  tiktok:    'TikTok',
  pinterest: 'Pinterest',
  web:       'Web',
  screenshot:'Screenshots',
  manual:    'Manual',
  url:       'Links',
};

const SOURCE_ICON = {
  instagram:  'ti-brand-instagram',
  youtube:    'ti-brand-youtube',
  tiktok:     'ti-brand-tiktok',
  pinterest:  'ti-brand-pinterest',
  web:        'ti-world',
  screenshot: 'ti-photo',
  manual:     'ti-edit',
  url:        'ti-link',
};

const CATEGORY_ICON = {
  food: '🍳', travel: '✈️', shopping: '🛍️', experience: '🎟️',
  blog: '📰', fashion: '👗', beauty: '💄', tech: '💻',
  other: '📌', general: '📥',
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export default function Profile({ onNavigate }) {
  const [user, setUser] = useState(null);
  const [saves, setSaves] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Notification & Location settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Modals
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState(null);
  const [pwInfo, setPwInfo] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(storedUser);
    // Initialize settings from user data
    if (storedUser) {
      setNotificationsEnabled(storedUser.notificationsEnabled ?? true);
      setLocationEnabled(storedUser.locationEnabled ?? false);
    }

    const ctrl = new AbortController();
    (async () => {
      try {
        const [s, c] = await Promise.all([
          api.getSaves({ signal: ctrl.signal }),
          api.getCollections({ signal: ctrl.signal }),
        ]);
        if (ctrl.signal.aborted) return;
        if (s.status === 'success') setSaves(s.data || []);
        if (c.status === 'success') setCollections(c.data || []);
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Profile load failed', err);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const stats = useMemo(() => deriveStats(saves, collections), [saves, collections]);

  const handleLogout = () => {
    api.logout();
    onNavigate('login');
  };

  const resetPwForm = () => {
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    setPwError(null); setPwInfo(null);
  };

  const handleNotificationsToggle = async () => {
    setSettingsSaving(true);
    try {
      const newValue = !notificationsEnabled;
      await api.updateSettings({ notificationsEnabled: newValue });
      setNotificationsEnabled(newValue);
      // Update localStorage
      const updatedUser = { ...user, notificationsEnabled: newValue };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Failed to update notifications setting', err);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLocationToggle = async () => {
    if (locationEnabled) {
      // Turning off location
      setSettingsSaving(true);
      try {
        await api.updateSettings({ locationEnabled: false });
        setLocationEnabled(false);
        const updatedUser = { ...user, locationEnabled: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (err) {
        console.error('Failed to update location setting', err);
      } finally {
        setSettingsSaving(false);
      }
    } else {
      // Turning on location — request geolocation first
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setSettingsSaving(true);
          try {
            await api.updateLocation(lat, lng, null);
            await api.updateSettings({ locationEnabled: true });
            setLocationEnabled(true);
            const updatedUser = { ...user, locationEnabled: true };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          } catch (err) {
            console.error('Failed to enable location', err);
          } finally {
            setSettingsSaving(false);
          }
        },
        (err) => {
          console.error('Geolocation permission denied', err);
          alert('Location permission required. Please enable it in your browser settings.');
        },
        { timeout: 10000 }
      );
    }
  };

  const handleChangePassword = async () => {
    setPwError(null); setPwInfo(null);
    if (!pwCurrent || !pwNew || !pwConfirm) return setPwError('All fields are required.');
    if (pwNew.length < 6) return setPwError('New password must be at least 6 characters.');
    if (pwNew !== pwConfirm) return setPwError('New passwords do not match.');
    if (pwCurrent === pwNew) return setPwError('New password must differ from the current one.');
    setPwSaving(true);
    try {
      const res = await api.changePassword(pwCurrent, pwNew);
      if (res.status === 'success') {
        setPwInfo('Password updated.');
        setPwCurrent(''); setPwNew(''); setPwConfirm('');
        setTimeout(() => { setShowChangePw(false); resetPwForm(); }, 900);
      } else {
        setPwError(res.error?.message || 'Failed to change password.');
      }
    } catch (err) {
      setPwError(err.message || 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const initials = (user?.name || user?.email || 'U')
    .split(/[\s@]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const memberSince = user?.createdAt
    || (saves.length ? saves[saves.length - 1].createdAt : null);

  return (
    <>
      <div style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="display" style={{ fontSize: '22px' }}>Profile</h1>
          <i
            className="ti ti-logout"
            title="Log out"
            onClick={() => setConfirmLogout(true)}
            style={{ fontSize: 18, cursor: 'pointer', color: 'var(--slate)' }}
          />
        </div>

        {/* Identity card */}
        <div style={{ padding: '4px 20px 20px', textAlign: 'center' }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 24, margin: '0 auto 10px' }}>{initials}</div>
          <h2 className="display" style={{ fontSize: 18, marginBottom: 2 }}>{user?.name || 'Unnamed'}</h2>
          <p style={{ fontSize: 12, color: 'var(--slate)' }}>{user?.email || ''}</p>
          {memberSince && (
            <p style={{ fontSize: 11, color: 'var(--mute,#9ca3af)', marginTop: 4 }}>
              <i className="ti ti-calendar" style={{ marginRight: 4 }}></i>
              Member since {fmtDate(memberSince)}
            </p>
          )}
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* Headline stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
            <StatCard value={loading ? '…' : stats.totalSaves}  label="Saves" />
            <StatCard value={loading ? '…' : collections.length} label="Collections" />
            <StatCard value={loading ? '…' : stats.savesThisWeek}  label="This week" />
            <StatCard value={loading ? '…' : stats.savesThisMonth} label="This month" />
          </div>

          {/* Intent breakdown */}
          {!loading && stats.totalSaves > 0 && (
            <Section title="Your intent" subtitle="What you've done with your saves">
              <IntentBar buckets={stats.intent} total={stats.totalSaves} />
            </Section>
          )}

          {/* Top categories */}
          {!loading && stats.topCategories.length > 0 && (
            <Section title="Top categories">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {stats.topCategories.map(({ key, count }) => (
                  <span key={key} style={pill}>
                    <span style={{ fontSize: 13 }}>{CATEGORY_ICON[key] || '📌'}</span>
                    <span style={{ textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ color: 'var(--slate)' }}>· {count}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Sources */}
          {!loading && stats.sources.length > 0 && (
            <Section title="Where you save from">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stats.sources.map(({ key, count, pct }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className={`ti ${SOURCE_ICON[key] || 'ti-link'}`} style={{ fontSize: 14, color: 'var(--forest)', width: 16 }}></i>
                    <span style={{ fontSize: 12, width: 80 }}>{SOURCE_LABEL[key] || key}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--linen)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--forest)' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--slate)', width: 24, textAlign: 'right' }}>{count}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recent collections */}
          {!loading && collections.length > 0 && (
            <Section
              title="Recent collections"
              subtitle={`${collections.filter(c => c.isAuto).length} auto · ${collections.filter(c => !c.isAuto).length} manual`}
              action={<span onClick={() => onNavigate('collections')} style={linkText}>See all</span>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {stats.recentCollections.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => onNavigate('collection-detail', { id: c._id, from: 'profile' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '0.5px solid var(--hairline)', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 18 }}>{c.icon || '📁'}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--slate)' }}>{(c.saves?.length || 0)} saves{c.isAuto ? ' · auto' : ''}</p>
                    </div>
                    <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--mute,#bbb)' }}></i>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Empty state */}
          {!loading && stats.totalSaves === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 12px', background: 'var(--linen)', borderRadius: 12, marginBottom: 18 }}>
              <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 10 }}>Your stats will appear once you have a few saves.</p>
              <button className="btn-primary" onClick={() => onNavigate('add-save')}>Add your first save</button>
            </div>
          )}

          {/* Settings */}
          <Section title="Settings">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '0.5px solid var(--hairline)' }}>
                <i className="ti ti-bell" style={{ fontSize: 16, color: 'var(--forest)', width: 18 }}></i>
                <p style={{ fontSize: 13, flex: 1 }}>Notifications</p>
                <button
                  onClick={handleNotificationsToggle}
                  disabled={settingsSaving}
                  style={{
                    background: notificationsEnabled ? 'var(--forest)' : 'var(--mute,#cbd5e1)',
                    border: 'none',
                    borderRadius: 12,
                    width: 40,
                    height: 24,
                    cursor: settingsSaving ? 'not-allowed' : 'pointer',
                    opacity: settingsSaving ? 0.6 : 1,
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    top: 2,
                    left: notificationsEnabled ? 18 : 2,
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '0.5px solid var(--hairline)' }}>
                <i className="ti ti-map-pin" style={{ fontSize: 16, color: 'var(--forest)', width: 18 }}></i>
                <p style={{ fontSize: 13, flex: 1 }}>Location-based saves</p>
                <button
                  onClick={handleLocationToggle}
                  disabled={settingsSaving}
                  style={{
                    background: locationEnabled ? 'var(--forest)' : 'var(--mute,#cbd5e1)',
                    border: 'none',
                    borderRadius: 12,
                    width: 40,
                    height: 24,
                    cursor: settingsSaving ? 'not-allowed' : 'pointer',
                    opacity: settingsSaving ? 0.6 : 1,
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    top: 2,
                    left: locationEnabled ? 18 : 2,
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            </div>
          </Section>

          {/* Account */}
          <Section title="Account">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                role="button"
                onClick={() => { resetPwForm(); setShowChangePw(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '0.5px solid var(--hairline)', cursor: 'pointer' }}
              >
                <i className="ti ti-lock" style={{ fontSize: 16, color: 'var(--forest)', width: 18 }}></i>
                <p style={{ fontSize: 13, flex: 1 }}>Change password</p>
                <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--mute,#bbb)' }}></i>
              </div>
              <div
                role="button"
                onClick={() => setConfirmLogout(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', cursor: 'pointer' }}
              >
                <i className="ti ti-logout" style={{ fontSize: 16, color: 'var(--error,#d33)', width: 18 }}></i>
                <p style={{ fontSize: 13, color: 'var(--error,#d33)', flex: 1 }}>Log out</p>
                <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--mute,#bbb)' }}></i>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {confirmLogout && (
          <div
            onClick={() => setConfirmLogout(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,12,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--paper)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(211,51,51,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <i className="ti ti-logout" style={{ fontSize: 20, color: 'var(--error,#d33)' }}></i>
              </div>
              <h3 className="display" style={{ fontSize: 17, textAlign: 'center', marginBottom: 6 }}>Log out of TryThis?</h3>
              <p style={{ fontSize: 13, color: 'var(--slate)', textAlign: 'center', marginBottom: 16 }}>
                You'll need your email and password to sign back in.
              </p>
              <button
                className="btn-primary"
                style={{ background: 'var(--error,#d33)' }}
                onClick={handleLogout}
              >
                Log out
              </button>
              <button
                className="btn-secondary"
                style={{ marginTop: 8 }}
                onClick={() => setConfirmLogout(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showChangePw && (
          <div
            onClick={() => !pwSaving && (setShowChangePw(false), resetPwForm())}
            style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,12,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--paper)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
            >
              <h3 className="display" style={{ fontSize: 18, marginBottom: 6 }}>Change password</h3>
              <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 14 }}>Enter your current password and a new one.</p>

              <p className="label">Current password</p>
              <input type="password" className="input" style={{ marginBottom: 10 }} placeholder="Current password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} disabled={pwSaving} />

              <p className="label">New password</p>
              <input type="password" className="input" style={{ marginBottom: 10 }} placeholder="At least 6 characters" value={pwNew} onChange={(e) => setPwNew(e.target.value)} disabled={pwSaving} />

              <p className="label">Confirm new password</p>
              <input type="password" className="input" style={{ marginBottom: 14 }} placeholder="Re-enter new password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} disabled={pwSaving} />

              {pwInfo  && <p style={{ color: 'var(--forest)', fontSize: 13, marginBottom: 8 }}>{pwInfo}</p>}
              {pwError && <p style={{ color: 'var(--error,#d33)', fontSize: 13, marginBottom: 8 }}>{pwError}</p>}

              <button className="btn-primary" onClick={handleChangePassword} disabled={pwSaving}>
                {pwSaving ? 'Saving…' : 'Update password'}
              </button>
              <button
                className="btn-secondary"
                style={{ marginTop: 8 }}
                onClick={() => { setShowChangePw(false); resetPwForm(); }}
                disabled={pwSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
    </>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function deriveStats(saves, collections) {
  const now = Date.now();
  const WEEK = 7 * 24 * 3600 * 1000;
  const MONTH = 30 * 24 * 3600 * 1000;

  // Exclude template/demo saves from all stats
  const realSaves = saves.filter(s => !s.isTemplate);

  const intent = { saved: 0, planned: 0, tried: 0, dismissed: 0 };
  const categories = {};
  const sources = {};
  let savesThisWeek = 0;
  let savesThisMonth = 0;

  for (const s of realSaves) {
    const created = s.createdAt ? new Date(s.createdAt).getTime() : 0;
    if (now - created <= WEEK)  savesThisWeek++;
    if (now - created <= MONTH) savesThisMonth++;

    const i = s.intentStatus || 'saved';
    if (intent[i] !== undefined) intent[i]++;

    const cat = s.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;

    const src = s.source || 'web';
    sources[src] = (sources[src] || 0) + 1;
  }

  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));

  const totalForSources = Math.max(1, realSaves.length);
  const sourceList = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, count]) => ({ key, count, pct: Math.round((count / totalForSources) * 100) }));

  const recentCollections = [...collections]
    .sort((a, b) => {
      const ax = new Date(a.metadata?.lastUpdated || a.updatedAt || 0).getTime();
      const bx = new Date(b.metadata?.lastUpdated || b.updatedAt || 0).getTime();
      return bx - ax;
    })
    .slice(0, 3);

  return {
    totalSaves: realSaves.length,
    savesThisWeek,
    savesThisMonth,
    intent,
    topCategories,
    sources: sourceList,
    recentCollections,
  };
}

// ── presentational bits ──────────────────────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <div style={{ background: 'var(--linen)', borderRadius: 10, padding: '12px 4px', textAlign: 'center' }}>
      <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--forest)' }}>{value}</p>
      <p style={{ fontSize: 9, color: 'var(--slate)', marginTop: 2 }}>{label}</p>
    </div>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500 }}>{title}</p>
          {subtitle && <p style={{ fontSize: 10, color: 'var(--slate)', marginTop: 2 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function IntentBar({ buckets, total }) {
  const segs = [
    { key: 'saved',     color: 'var(--forest)',         label: 'Saved'     },
    { key: 'planned',   color: 'var(--forest-faint)',   label: 'Planned'   },
    { key: 'tried',     color: '#81b29a',               label: 'Tried'     },
    { key: 'dismissed', color: 'var(--mute,#cbd5e1)',   label: 'Dismissed' },
  ];
  return (
    <>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--linen)', marginBottom: 8 }}>
        {segs.map((s) => {
          const v = buckets[s.key] || 0;
          if (v === 0) return null;
          return <div key={s.key} title={`${s.label}: ${v}`} style={{ flexBasis: `${(v / total) * 100}%`, background: s.color }} />;
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {segs.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--slate)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            {s.label} <span style={{ color: 'var(--ink,#222)', fontWeight: 500 }}>{buckets[s.key] || 0}</span>
          </div>
        ))}
      </div>
    </>
  );
}

const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--linen)',
  borderRadius: 14,
  padding: '4px 10px',
  fontSize: 12,
};

const linkText = {
  fontSize: 11,
  color: 'var(--forest)',
  cursor: 'pointer',
  fontWeight: 500,
};
