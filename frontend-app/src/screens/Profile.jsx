import { useEffect, useMemo, useState } from 'react';
import api from '../api';

const APP_VERSION = 'v1.0';

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
  const [showAbout, setShowAbout] = useState(false);
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

  const stats = useMemo(() => deriveStats(saves), [saves]);

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
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div className="pf-hdr">
          <span className="pf-htitle">Profile</span>
          <span className="pf-hico">⚙️</span>
        </div>

        {/* Identity */}
        <div className="pf-av">
          <div className="pf-circle">{initials}</div>
          <div className="pf-name">{user?.name || 'Unnamed'}</div>
          <div className="pf-email">{user?.email || ''}</div>
          {memberSince && (
            <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 4 }}>
              <i className="ti ti-calendar" style={{ marginRight: 4 }}></i>
              Member since {fmtDate(memberSince)}
            </p>
          )}
        </div>

        {/* Headline stats */}
        <div className="pf-stats">
          <div className="pf-stat"><div className="pf-snum">{loading ? '…' : stats.totalSaves}</div><div className="pf-slbl">Saves</div></div>
          <div className="pf-stat"><div className="pf-snum">{loading ? '…' : stats.topCategories.length}</div><div className="pf-slbl">Categories</div></div>
          <div className="pf-stat"><div className="pf-snum">{loading ? '…' : collections.length}</div><div className="pf-slbl">Collections</div></div>
        </div>

        {/* Settings */}
        <div className="pf-section">
          <div className="pf-sitems">
            <div className="pf-item" onClick={settingsSaving ? undefined : handleNotificationsToggle} style={{ cursor: settingsSaving ? 'not-allowed' : 'pointer', opacity: settingsSaving ? 0.6 : 1 }}>
              <span className="pf-iname">🔔 Notifications</span>
              <span className="pf-ival" style={{ color: notificationsEnabled ? 'var(--cook)' : 'var(--mute)' }}>{notificationsEnabled ? 'On' : 'Off'}</span>
            </div>
            <div className="pf-item" onClick={settingsSaving ? undefined : handleLocationToggle} style={{ cursor: settingsSaving ? 'not-allowed' : 'pointer', opacity: settingsSaving ? 0.6 : 1 }}>
              <span className="pf-iname">📍 Nearby radius</span>
              <span className="pf-ival">{locationEnabled ? '2 km ›' : 'Off ›'}</span>
            </div>
            <div className="pf-item" onClick={() => onNavigate('collections')}>
              <span className="pf-iname">🗂️ Categories</span>
              <span className="pf-ival">{loading ? '… ' : stats.topCategories.length} active ›</span>
            </div>
            <div className="pf-item" onClick={() => { window.location.href = 'mailto:support@wannatry.app?subject=Wanna%20Try%20Feedback'; }}>
              <span className="pf-iname">💬 Help & Feedback</span>
              <span className="pf-ival">↗</span>
            </div>
            <div className="pf-item" onClick={() => setShowAbout(true)}>
              <span className="pf-iname">ℹ️ About Wanna Try</span>
              <span className="pf-ival">{APP_VERSION} ›</span>
            </div>
            <div className="pf-item" onClick={() => { resetPwForm(); setShowChangePw(true); }}>
              <span className="pf-iname">🔒 Change password</span>
              <span className="pf-ival">›</span>
            </div>
          </div>
        </div>

        <div className="pf-logout" onClick={() => setConfirmLogout(true)}>Log out</div>
        <div style={{ height: 24 }} />
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
                <i className="ti ti-logout" style={{ fontSize: 21, color: 'var(--error,#d33)' }}></i>
              </div>
              <h3 className="display" style={{ fontSize: 18, textAlign: 'center', marginBottom: 6 }}>Log out of Wanna Try?</h3>
              <p style={{ fontSize: 14, color: 'var(--slate)', textAlign: 'center', marginBottom: 16 }}>
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
              <h3 className="display" style={{ fontSize: 19, marginBottom: 6 }}>Change password</h3>
              <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>Enter your current password and a new one.</p>

              <p className="label">Current password</p>
              <input type="password" className="input" style={{ marginBottom: 10 }} placeholder="Current password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} disabled={pwSaving} />

              <p className="label">New password</p>
              <input type="password" className="input" style={{ marginBottom: 10 }} placeholder="At least 6 characters" value={pwNew} onChange={(e) => setPwNew(e.target.value)} disabled={pwSaving} />

              <p className="label">Confirm new password</p>
              <input type="password" className="input" style={{ marginBottom: 14 }} placeholder="Re-enter new password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} disabled={pwSaving} />

              {pwInfo  && <p style={{ color: 'var(--coral)', fontSize: 14, marginBottom: 8 }}>{pwInfo}</p>}
              {pwError && <p style={{ color: 'var(--error,#d33)', fontSize: 14, marginBottom: 8 }}>{pwError}</p>}

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

        {showAbout && (
          <div
            onClick={() => setShowAbout(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,12,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--paper)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', textAlign: 'center' }}
            >
              <div className="pf-circle" style={{ margin: '0 auto 12px' }}>🔖</div>
              <h3 className="display" style={{ fontSize: 19, marginBottom: 4 }}>Wanna Try</h3>
              <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 10 }}>See it. Save it. Try it.</p>
              <p style={{ fontSize: 13, color: 'var(--mute)', marginBottom: 16 }}>{APP_VERSION}</p>
              <button className="btn-secondary" onClick={() => setShowAbout(false)}>Close</button>
            </div>
          </div>
        )}
    </>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function deriveStats(saves) {
  // Exclude template/demo saves from all stats
  const realSaves = saves.filter(s => !s.isTemplate);

  const categories = {};
  for (const s of realSaves) {
    const cat = s.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  }

  const topCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }));

  return {
    totalSaves: realSaves.length,
    topCategories,
  };
}
