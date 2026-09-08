import { useState, useEffect } from 'react';
import api from '../../api';
import Icon from '../../components/Icon';
import PasswordInput from '../../components/PasswordInput';
import Chip from '../../components/Chip';
import Button from '../../components/Button';
import SectionLabel from '../../components/SectionLabel';
import { enablePushNotifications, disablePushNotifications, getPushState } from '../../lib/push';

const PUSH_COPY = {
  denied: 'Notifications are blocked in your browser settings.',
  blocked: 'Notifications are blocked for this site — allow them in the browser\'s site settings, then try again.',
  unsupported: 'This browser can\'t receive push notifications.',
  'no-key': 'Push isn\'t configured on the server yet.',
  error: 'Could not turn notifications on. Try again.',
};

// Me: the numbers that matter (tried rate first), two switches, account.
export default function Profile({ onNavigate }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [saves, setSaves] = useState([]);
  const [push, setPush] = useState('off');
  const [note, setNote] = useState(null);
  const [loc, setLoc] = useState(localStorage.getItem('location_requested') === 'true');
  const [pw, setPw] = useState(false);
  // The four preferences that change what the app does (Ask, trip plans, nudge timing).
  const [prefs, setPrefs] = useState(user.preferences || {});
  const setPref = async (k, v) => {
    const next = { ...prefs, [k]: prefs[k] === v ? null : v };
    setPrefs(next);
    const r = await api.updateSettings({ preferences: { [k]: next[k] } }).catch(() => null);
    if (r?.status === 'success') { try { localStorage.setItem('user', JSON.stringify({ ...user, preferences: r.data?.preferences || next })); } catch {} }
    else setNote('Could not save that preference.');
  };
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [pwMsg, setPwMsg] = useState(null);
  // What we noticed, as opposed to what you told us. Derived only — every row
  // says where it came from (docs/MEMORY_ENGINE.md §8.5).
  const [known, setKnown] = useState(null);
  // What we know because they told us, as opposed to what we noticed.
  const [mem, setMem] = useState(null);
  const [openMem, setOpenMem] = useState(false);
  const [openKnown, setOpenKnown] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    api.getSaves({ signal: ctrl.signal }).then((r) => r?.status === 'success' && setSaves(r.data || []));
    setPush(getPushState());
    api.getKnowledge().then((r) => r?.status === 'success' && setKnown(r.data)).catch(() => {});
    api.getMemories().then((r) => r?.status === 'success' && setMem(r.data)).catch(() => {});
    api.getMe().then((r) => { const u = r?.data?.user || r?.data; if (u?.preferences) { setPrefs(u.preferences); try { localStorage.setItem('user', JSON.stringify({ ...user, ...u, id: user.id || u._id })); } catch {} } }).catch(() => {});
    return () => ctrl.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tried = saves.filter((s) => s.intentStatus === 'tried').length;
  const planned = saves.filter((s) => s.intentStatus === 'planned').length;
  const rate = saves.length ? Math.round((tried / saves.length) * 100) : 0;

  const togglePush = async () => {
    setNote(null);
    if (push === 'on') { await disablePushNotifications(); setPush(getPushState()); api.updateSettings({ notificationsEnabled: false }).catch(() => {}); return; }
    const r = await enablePushNotifications();
    setPush(getPushState());
    api.getKnowledge().then((r) => r?.status === 'success' && setKnown(r.data)).catch(() => {});
    api.getMemories().then((r) => r?.status === 'success' && setMem(r.data)).catch(() => {});
    if (r?.ok === false || r?.reason) setNote(PUSH_COPY[r.reason] || PUSH_COPY.error);
    else api.updateSettings({ notificationsEnabled: true }).catch(() => {});
  };
  const toggleLoc = () => {
    if (loc) { setLoc(false); localStorage.setItem('location_requested', 'denied'); api.updateSettings({ locationEnabled: false }).catch(() => {}); return; }
    navigator.geolocation?.getCurrentPosition(async (p) => {
      await api.updateLocation(p.coords.latitude, p.coords.longitude, null).catch(() => {});
      await api.updateSettings({ locationEnabled: true }).catch(() => {});
      localStorage.setItem('location_requested', 'true'); setLoc(true);
    }, () => setNote('Location is blocked in your browser settings.'), { timeout: 10000 });
  };
  const changePw = async () => {
    setPwMsg(null);
    if (next.length < 8) return setPwMsg('New password needs 8+ characters.');
    const r = await api.changePassword(cur, next);
    setPwMsg(r?.status === 'success' ? 'Password updated.' : (r?.error?.message || 'Could not update.'));
    if (r?.status === 'success') { setCur(''); setNext(''); setPw(false); }
  };
  const forget = async (id) => {
    const r = await api.forgetMemory(id).catch(() => null);
    if (r?.status !== 'success') { setNote('Could not forget that.'); return; }
    // Optimistic: drop it from view, and say plainly that saves are untouched.
    setMem((prev) => (prev ? { ...prev, groups: prev.groups.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== id) })).filter((g) => g.items.length) } : prev));
    setNote(`Forgotten. Your saves are untouched.`);
  };
  const confirmMem = async (id) => {
    await api.confirmMemory(id).catch(() => {});
    setMem((prev) => (prev ? { ...prev, groups: prev.groups.map((g) => ({ ...g, items: g.items.map((i) => (i.id === id ? { ...i, sureness: 'always' } : i)) })) } : prev));
  };
  const logout = () => { api.logout(); onNavigate('welcome'); };

  const Switch = ({ on, onClick }) => (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} style={{ width: 46, height: 28, borderRadius: 14, border: 0, background: on ? 'var(--teal)' : 'var(--card-2)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 11, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  );
  const Row = ({ icon, kind = 'none', title, sub, right, onClick }) => (
    <div className="wt-row" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <span className={`wt-tile ${kind}`}><Icon name={icon} size={20} /></span>
      <div className="wt-row-body"><span style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</span>{sub && <span className="wt-row-meta">{sub}</span>}</div>
      <div className="wt-row-trail">{right}</div>
    </div>
  );

  return (
    <div className="wt-screen has-nav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--sand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 600, color: '#6B5747' }}>{(user.name || '?')[0]}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 className="wt-title" style={{ fontSize: 26 }}>{user.name || 'You'}</h1>
          <span style={{ fontSize: 13.5, color: 'var(--mute)' }}>{user.email}</span>
        </div>
      </div>

      <div className="wt-stat-grid" style={{ marginBottom: 24 }}>
        <div className="wt-stat"><span className="k">Tried</span><span className="v">{tried}</span></div>
        <div className="wt-stat"><span className="k">Planning</span><span className="v">{planned}</span></div>
        <div className="wt-stat"><span className="k">Tried rate</span><span className="v">{rate}%</span></div>
      </div>

      <SectionLabel>Wanna Try can</SectionLabel>
      <Row icon="bell" kind="place" title="Nudge me" sub={push === 'on' ? 'When something\'s worth it. Never more than one a day.' : 'Off — you\'ll only see them in the app'} right={<Switch on={push === 'on'} onClick={togglePush} />} />
      <Row icon="pin" kind="food" title="Know where I am" sub={loc ? 'For "near you" and the nearby nudge' : 'Off — nearby is off too'} right={<Switch on={loc} onClick={toggleLoc} />} />
      {note && <div className="wt-note info" style={{ marginTop: 12 }}>{note}</div>}

      <Row icon="star" kind="food" title={`Your ${new Date().getFullYear()}`} sub={tried ? `${tried} tried so far — see the year` : 'Everything you try this year, in one place'} onClick={() => onNavigate('year-recap')} right={<Icon name="forward" size={18} style={{ color: 'var(--faint)' }} />} />

      {mem?.total > 0 && (
        <>
          <div style={{ marginTop: 24 }}><SectionLabel>What I know about you</SectionLabel></div>
          <Row
            icon="sparkle"
            kind="place"
            title={`${mem.total} thing${mem.total === 1 ? '' : 's'} you've told me`}
            sub={openMem ? 'Tap to hide' : 'Tap to see, correct or forget any of them'}
            onClick={() => setOpenMem((v) => !v)}
            right={<Icon name={openMem ? 'back' : 'forward'} size={18} style={{ color: 'var(--faint)' }} />}
          />
          {openMem && mem.groups.map((g) => (
            <div key={g.title} style={{ padding: '10px 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{g.title}</span>
              {g.items.map((it) => (
                <div key={it.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 14.5 }}>{it.statement}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>
                    {it.sureness}{it.scope ? ` \u00b7 ${it.scope}` : ''} \u00b7 {it.source}
                  </div>
                  {it.quote && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{it.quote}&rdquo;</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                    <Chip small onClick={() => confirmMem(it.id)}>That&rsquo;s right</Chip>
                    <Chip small onClick={() => forget(it.id)}>Forget this</Chip>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {known?.gist && (
        <>
          <div style={{ marginTop: 24 }}><SectionLabel>What I&rsquo;ve noticed</SectionLabel></div>
          <Row
            icon="sparkle"
            kind="learn"
            title={known.gist}
            sub={openKnown ? 'Tap to hide' : `${known.groups.reduce((n, g) => n + g.items.length, 0)} things, all from what you saved`}
            onClick={() => setOpenKnown((v) => !v)}
            right={<Icon name={openKnown ? 'back' : 'forward'} size={18} style={{ color: 'var(--faint)' }} />}
          />
          {openKnown && known.groups.map((g) => (
            <div key={g.title} style={{ padding: '10px 0 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{g.title}</span>
              {g.items.map((it, i) => (
                <div key={`${g.title}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ flex: 1, fontSize: 14.5 }}>{it.statement}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'right', flexShrink: 0 }}>
                    {it.sureness}{it.detail ? ` \u00b7 ${it.detail}` : ''}<br />{it.source}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 24 }}><SectionLabel>About you</SectionLabel></div>
      <p style={{ fontSize: 13.5, color: 'var(--mute)', margin: '4px 0 10px', lineHeight: 1.45 }}>Ask, trip plans and nudges use these. Tap again to clear.</p>
      {[
        ['budget', 'Budget', [['low', 'Keep it cheap'], ['mid', 'Mid-range'], ['high', 'Happy to splurge']]],
        ['company', 'Usually with', [['partner', 'Partner'], ['friends', 'Friends'], ['family', 'Family'], ['solo', 'Solo']]],
        ['nudgeTime', 'Nudge me in the', [['morning', 'Morning'], ['evening', 'Evening']]],
      ].map(([k, label, opts]) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
          <div className="wt-chips">{opts.map(([v, t]) => <Chip key={v} small on={prefs[k] === v} onClick={() => setPref(k, v)}>{t}</Chip>)}</div>
        </div>
      ))}

      <div style={{ marginTop: 24 }}><SectionLabel>Account</SectionLabel></div>
      {user.emailVerified === false && <Row icon="bell" kind="shop" title="Verify your email" sub="For password reset and nudges by mail" onClick={() => onNavigate('verify-email', { next: 'profile' })} right={<Icon name="forward" size={18} style={{ color: 'var(--faint)' }} />} />}
      <Row icon="lock" title="Change password" onClick={() => setPw((v) => !v)} right={<Icon name="forward" size={18} style={{ color: 'var(--faint)' }} />} />
      {pw && (
        <div style={{ padding: '12px 0 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pwMsg && <div className={`wt-note ${pwMsg.includes('updated') ? 'info' : 'error'}`}>{pwMsg}</div>}
          <PasswordInput placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          <PasswordInput placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <Button small onClick={changePw}>Update</Button>
        </div>
      )}
      <Row icon="folder" kind="learn" title="Collections" onClick={() => onNavigate('collections')} right={<Icon name="forward" size={18} style={{ color: 'var(--faint)' }} />} />

      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        <Button variant="ghost" onClick={logout}>Sign out</Button>
      </div>
    </div>
  );
}
