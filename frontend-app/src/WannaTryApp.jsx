import { useEffect, useRef, useState } from 'react';
import api from './api';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: 'ti-home' },
  { key: 'collections', label: 'Saved', icon: 'ti-bookmark' },
  { key: 'add-save', label: 'Add', icon: 'ti-plus' },
  { key: 'explore-map', label: 'Explore', icon: 'ti-map' },
  { key: 'profile', label: 'Profile', icon: 'ti-user' },
];


const interestOptions = ['Travel', 'Cafés', 'Recipes', 'Products', 'Events', 'Hotels'];

const PLAN_MODE_ICON = { Flights: 'ti-plane', Trains: 'ti-train', Bus: 'ti-bus' };


const smileInitials = 'H';

const asArray = (value) => Array.isArray(value) ? value : [];
const first = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);
const getTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return days + 'd ago';
};
const getLocationLabel = (save) => {
  const place = save?.aiAnalysis?.structuredData?.place || {};
  const itinerary = save?.aiAnalysis?.structuredData?.itinerary || {};
  const loc = [place.name, place.city, place.country].filter(Boolean).join(', ');
  return loc || itinerary.destination || save?.userNote || save?.author || '';
};
const getCategoryLabel = (save) => {
  const cat = String(save?.category || 'saved');
  if (['food', 'cafe', 'cafes', 'restaurant', 'restaurants', 'recipes'].includes(cat)) return 'Eat';
  if (['travel', 'experience', 'experiences', 'hotels'].includes(cat)) return 'Travel';
  if (['shopping', 'fashion', 'beauty', 'product'].includes(cat)) return 'Shop';
  if (['blog', 'tech', 'learning', 'productivity'].includes(cat)) return 'Learn';
  return 'Saved';
};
const getSaveAccent = (save) => {
  const cat = getCategoryLabel(save);
  if (cat === 'Eat') return '#F0A050';
  if (cat === 'Travel') return '#2EC4A0';
  if (cat === 'Shop') return '#E07090';
  if (cat === 'Learn') return '#8080D0';
  return '#565656';
};
const getInitials = (name) => (name || '').split(/\s+/).filter(Boolean).slice(0,2).map((s) => s[0]).join('').toUpperCase() || 'H';

// Home feed grouping (mirrors the production buckets).
const isVideoSave = (s) => s?.contentType === 'video' || s?.source === 'instagram' || s?.source === 'youtube' || s?.source === 'tiktok';
const isScreenshotSave = (s) => s?.source === 'screenshot_bundle' || (s?.contentType === 'image' && (s?.source === 'screenshot' || s?.source === 'manual'));
const getScreenshotCount = (s) => s?.screenshotCount || asArray(s?.screenshots).length || asArray(s?.aiAnalysis?.screenshots).length || 0;
// Category chip filter: 'All' matches everything, otherwise match the save's bucket label.
const matchesFilter = (save, filter) => filter === 'All' || getCategoryLabel(save) === filter;

function PhoneFrame({ children, height = 420 }) {
  return (
    <div className="mobile-shell">
      <div className="screen" style={{ minHeight: height }}>
        {children}
      </div>
    </div>
  );
}

function NavBar({ currentScreen, onNavigate }) {
  return (
    <>
    <div className="bnav-spacer" aria-hidden="true" />
    <div className="bnav">
      {NAV_ITEMS.map((item) => {
        const active =
          item.key === currentScreen ||
          (item.key === 'home' && currentScreen === 'home-empty') ||
          (item.key === 'collections' && ['collections', 'collection-detail', 'save-detail'].includes(currentScreen)) ||
          (item.key === 'explore-map' && ['explore-map', 'nearby', 'place-detail'].includes(currentScreen));
        return (
          <button
            key={item.key}
            type="button"
            className={`nav-item ${item.key === 'add-save' ? 'nav-add' : ''} ${active ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.key === 'add-save' ? (
              <span className="nav-add-btn">
                <i className={`ti ${item.icon}`} style={{ fontSize: 15, color: active ? '#fff' : '#2EC4A0' }} aria-hidden="true" />
              </span>
            ) : (
              <i className={`ti ${item.icon}`} style={{ fontSize: 18, color: active ? '#2EC4A0' : '#6b6b6b' }} aria-hidden="true" />
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
    </>
  );
}

function TopArt() {
  return (
    <div className="top-art">
      <div className="art-circle-lg" />
      <div className="art-circle-sm" />
      <div className="art-logo">wanna<em>try</em></div>
      <div className="art-tag">Save now. Experience later.</div>
    </div>
  );
}

function OnboardArt() {
  return (
    <div className="onboard-art">
      <div className="ob-icons">
        <div className="ob-icon ob-icon-a"><i className="ti ti-mountain" style={{ fontSize: 18, color: '#2EC4A0' }} aria-hidden="true" /></div>
        <div className="ob-icon ob-icon-b"><i className="ti ti-coffee" style={{ fontSize: 18, color: '#F0A050' }} aria-hidden="true" /></div>
        <div className="ob-icon ob-icon-c"><i className="ti ti-chef-hat" style={{ fontSize: 18, color: '#8080D0' }} aria-hidden="true" /></div>
        <div className="ob-icon ob-icon-d"><i className="ti ti-shopping-bag" style={{ fontSize: 18, color: '#E07090' }} aria-hidden="true" /></div>
      </div>
      <div className="ob-label">Travel · Cafés · Recipes · Products</div>
    </div>
  );
}


function LoginScreen({ onNavigate, onComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email.trim(), password);
      if (res.status === 'success') {
        onComplete('home');
      } else {
        setError(res.error?.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell">
      <div className="screen" style={{ minHeight: 420 }}>
        <TopArt />
        <div className="body">
          <div className="auth-title">Welcome back</div>
          <div className="auth-sub">Sign in to your saves, reminders and collections.</div>

          <button className="social-btn" type="button">
            <i className="ti ti-brand-google" style={{ fontSize: 13, color: '#EA4335' }} aria-hidden="true" />
            <span>Continue with Google</span>
          </button>

          <div className="divider-row">
            <div className="div-line" />
            <div className="div-text">or</div>
            <div className="div-line" />
          </div>

          <div className="input-group">
            <div className="input-label">Email</div>
            <input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div className="input-group">
            <div className="input-label">Password</div>
            <input className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
          </div>
          <div className="forgot"><span>Forgot password?</span></div>

          {error ? <div style={{ color: '#d33', fontSize: 8, marginTop: 8, marginBottom: 8 }}>{error}</div> : null}
          <button className="btn-primary" type="button" onClick={signIn} disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          <button className="auth-footer auth-link" type="button" onClick={() => onNavigate('signup')}>
            Don't have an account? <em>Sign up</em>
          </button>
        </div>
      </div>
    </div>
  );
}

function SignupScreen({ onNavigate, onComplete }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = Math.min(4, [/[A-Z]/.test(password), /[0-9]/.test(password), password.length >= 8, password.length >= 12].filter(Boolean).length || 0);

  const createAccount = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.signup(email.trim(), password, name.trim());
      if (res.status === 'success') {
        onComplete('onboarding');
      } else {
        setError(res.error?.message || 'Signup failed');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell">
      <div className="screen" style={{ minHeight: 420 }}>
        <TopArt />
        <div className="body">
          <div className="auth-title">Create account</div>
          <div className="auth-sub">Start saving places, recipes, and things you love.</div>

          <button className="social-btn" type="button">
            <i className="ti ti-brand-google" style={{ fontSize: 13, color: '#EA4335' }} aria-hidden="true" />
            <span>Continue with Google</span>
          </button>

          <div className="divider-row">
            <div className="div-line" />
            <div className="div-text">or</div>
            <div className="div-line" />
          </div>

          <div className="input-group">
            <div className="input-label">Full name</div>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="input-group">
            <div className="input-label">Email</div>
            <input className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div className="input-group">
            <div className="input-label">Password</div>
            <input className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Create a password" />
            <div className="strength-row">
              {[0, 1, 2, 3].map((i) => <div key={i} className={i < strength ? 'strength-bar s-fill' : 'strength-bar s-empty'} />)}
            </div>
            <div className="strength-label">Good password</div>
          </div>

          {error ? <div style={{ color: '#d33', fontSize: 8, marginTop: 8, marginBottom: 8 }}>{error}</div> : null}
          <button className="btn-primary mint" type="button" onClick={createAccount} disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>

          <div className="terms">By continuing you agree to our <em>Terms of Service</em> and <em>Privacy Policy</em>.</div>
          <button className="auth-footer auth-link" type="button" onClick={() => onNavigate('login')}>
            Already have an account? <em>Sign in</em>
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingScreen({ onNavigate, onComplete }) {
  const [selected, setSelected] = useState(['Travel', 'Cafés']);
  const [allowLocation, setAllowLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    api.getTemplateSaves().then((res) => {
      if (res.status === 'success') setTemplates(res.data || []);
    }).catch(() => {});
  }, []);

  const toggleInterest = (label) => {
    setSelected((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]));
  };

  const finish = async () => {
    setLoading(true);
    try {
      await api.updateOnboarding({ completed: true, currentStep: 3, firstSaveAt: new Date().toISOString() });
      await api.updateSettings({ notificationsEnabled: true, locationEnabled: allowLocation });
      if (allowLocation && navigator.geolocation) {
        await new Promise((resolve) => navigator.geolocation.getCurrentPosition(async (pos) => {
          try { await api.updateLocation(pos.coords.latitude, pos.coords.longitude, null); } catch (e) {}
          resolve();
        }, () => resolve(), { timeout: 8000, maximumAge: 300000 }));
      }
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          user.onboarding = { ...(user.onboarding || {}), completed: true };
          localStorage.setItem('user', JSON.stringify(user));
        } catch (e) {}
      }
      onComplete('home');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell">
      <div className="screen" style={{ minHeight: 420 }}>
        <OnboardArt />
        <div className="body">
          <div className="auth-title">What do you<br />love saving?</div>
          <div className="auth-sub">We'll personalise your feed. Pick all that apply.</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {interestOptions.map((item) => {
              const active = selected.includes(item);
              return (
                <button key={item} type="button" onClick={() => toggleInterest(item)} className="interest-chip" style={{ background: active ? (item === 'Travel' ? '#F0FBF8' : item === 'Cafés' ? '#FFF8F0' : '#F5F5F5') : '#F5F5F5', borderColor: active ? (item === 'Travel' ? '#2EC4A0' : item === 'Cafés' ? '#F0A050' : '#EFEFEF') : '#EFEFEF', color: active ? (item === 'Travel' ? '#1A7A64' : item === 'Cafés' ? '#7A4A0A' : '#565656') : '#565656', fontWeight: active ? 500 : 400 }}>
                  {item}
                </button>
              );
            })}
          </div>

          {templates.length > 0 ? (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {templates.slice(0, 2).map((template) => (
                <div key={template._id} style={{ minWidth: 118, background: '#fff', border: '1px solid #efefef', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 8, color: '#6b6b6b', marginBottom: 4 }}>{getCategoryLabel(template)}</div>
                  <div style={{ fontSize: 9, fontWeight: 500, color: '#111', lineHeight: 1.3 }}>{template.title}</div>
                  <div style={{ fontSize: 7, color: '#565656', marginTop: 4 }}>{getLocationLabel(template) || 'Template save'}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 8, color: '#565656', marginBottom: 8 }}>Allow location for nearby alerts?</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setAllowLocation(true)} style={{ flex: 1, background: allowLocation ? '#F0FBF8' : '#F7F7F7', border: allowLocation ? '1px solid #B8EDE2' : '1px solid #EFEFEF', borderRadius: 9, padding: 9, textAlign: 'center', fontSize: 8, fontWeight: 500, color: allowLocation ? '#1A7A64' : '#6b6b6b' }}>Yes, allow</button>
              <button type="button" onClick={() => setAllowLocation(false)} style={{ flex: 1, background: !allowLocation ? '#F0FBF8' : '#F7F7F7', border: !allowLocation ? '1px solid #B8EDE2' : '1px solid #EFEFEF', borderRadius: 9, padding: 9, textAlign: 'center', fontSize: 8, color: !allowLocation ? '#1A7A64' : '#6b6b6b' }}>Not now</button>
            </div>
          </div>

          <button className="btn-primary" type="button" style={{ marginTop: 14 }} onClick={finish} disabled={loading}>{loading ? 'Saving…' : 'Get started'}</button>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 12 }}>
            <div style={{ width: 16, height: 4, borderRadius: 2, background: '#111' }} />
            <div style={{ width: 6, height: 4, borderRadius: 2, background: '#DDD' }} />
            <div style={{ width: 6, height: 4, borderRadius: 2, background: '#DDD' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeFeedScreen({ onNavigate }) {
  const [saves, setSaves] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState({});
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [expand, setExpand] = useState({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [meRes, savesRes, notifsRes, nearbyRes] = await Promise.all([
          api.getMe().catch(() => null),
          api.getSaves().catch(() => null),
          api.getNotifications().catch(() => null),
          (async () => {
            if (!navigator.geolocation) return null;
            return await new Promise((resolve) => navigator.geolocation.getCurrentPosition(async (pos) => {
              try {
                const res = await api.getNearbySaves(pos.coords.latitude, pos.coords.longitude, 5000);
                resolve(res);
              } catch (e) { resolve(null); }
            }, () => resolve(null), { timeout: 6000, maximumAge: 300000 }));
          })(),
        ]);
        if (!alive) return;
        if (meRes?.status === 'success') setUser(meRes.data || {});
        const rawSaves = savesRes?.status === 'success' ? savesRes.data || [] : [];
        setSaves(rawSaves.filter((s) => !s.isTemplate));
        setNotifications(notifsRes?.status === 'success' ? (notifsRes.data?.notifications || []) : []);
        setNearby(nearbyRes?.status === 'success' ? nearbyRes.saves || [] : []);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const userName = (user.name || '').split(' ')[0] || 'there';
  const topSaves = saves.slice(0, 4);
  const unreadCount = notifications.filter((n) => n.status === 'sent' || n.status === 'pending').length;
  const nearbyHighlight = first(nearby) || first(saves.filter((s) => getLocationLabel(s)));

  // Apply the active category chip, then split into the 3 home sections.
  const filteredSaves = saves.filter((s) => matchesFilter(s, activeFilter));
  const videoSaves = filteredSaves.filter(isVideoSave);
  const bundleSaves = filteredSaves.filter((s) => !isVideoSave(s) && isScreenshotSave(s));
  const recentlySaved = filteredSaves.filter((s) => !isVideoSave(s) && !isScreenshotSave(s));
  // On "All" show a preview of each; when filtered (or a section is expanded) show everything.
  const all = activeFilter === 'All';
  const toggle = (k) => setExpand((e) => ({ ...e, [k]: !e[k] }));
  const displayRecent = all && !expand.recent ? recentlySaved.slice(0, 4) : recentlySaved;
  const displayVideos = all && !expand.videos ? videoSaves.slice(0, 3) : videoSaves;
  const displayBundles = all && !expand.bundles ? bundleSaves.slice(0, 2) : bundleSaves;

  const feedCard = (save) => (
    <button key={save._id} className="feed-card" type="button" onClick={() => onNavigate('save-detail', { saveId: save._id })}>
      <div className="fc-img fc-img-1">
        {save.thumbnail ? <img src={save.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className={'ti ' + getSaveIcon(save)} style={{ fontSize: 32, color: getSaveAccent(save), opacity: 0.15, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />}
        <span className="badge" style={{ background: getSaveAccent(save), color: '#fff' }}>{getCategoryLabel(save)}</span>
        {isScreenshotSave(save) && getScreenshotCount(save) ? <span className="t-saves">{getScreenshotCount(save)} shots</span> : null}
      </div>
      <div className="fc-body">
        <div className="fc-name">{save.title}</div>
        <div className="fc-loc"><i className="ti ti-map-pin" style={{ fontSize: 8 }} aria-hidden="true" /> {getLocationLabel(save) || getCategoryLabel(save)}</div>
        <div className="fc-row"><span className="fc-rating">{save.intentStatus || 'saved'}</span><div className="fc-meta"><span className="fc-time">{getTimeAgo(save.createdAt)}</span></div></div>
      </div>
    </button>
  );

  if (loading) {
    return <div className="mobile-shell"><div className="screen" style={{ minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#565656' }}>Loading…</div></div>;
  }

  if (!saves.length) {
    return <HomeEmptyScreen onNavigate={onNavigate} />;
  }

  return (
    <div className="mobile-shell">
      <div className="screen" style={{ minHeight: 480 }}>
        <div className="hdr">
          <div className="hdr-top">
            <div className="logo">wanna<em>try</em></div>
            <div className="hdr-right">
              <button className="icon-btn" type="button">
                <i className="ti ti-bell" style={{ fontSize: 13, color: '#6b6b6b' }} aria-hidden="true" />
                {unreadCount > 0 ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2EC4A0', position: 'absolute', marginTop: -12, marginLeft: 12 }} /> : null}
              </button>
              <div className="avatar">{getInitials(user.name || smileInitials)}</div>
            </div>
          </div>
          <div className="greeting">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {userName}</div>
          <div className="hdr-title">What are you<br />saving today?</div>
        </div>
        <button className="search" type="button" onClick={() => onNavigate('explore-map')}>
          <i className="ti ti-search" style={{ fontSize: 12, color: '#767676' }} aria-hidden="true" />
          <span>Search saves, trips, recipes…</span>
        </button>
        <div className="chips">
          {['All', 'Travel', 'Eat', 'Shop', 'Learn'].map((chip) => (
            <button key={chip} type="button" className={activeFilter === chip ? 'chip on' : 'chip off'} onClick={() => setActiveFilter(chip)}>{chip}</button>
          ))}
        </div>
        <button className="alert" type="button" onClick={() => onNavigate('nearby')}>
          <div className="alert-dot"><i className="ti ti-map-pin" style={{ fontSize: 12, color: '#003D30' }} aria-hidden="true" /></div>
          <div>
            <div className="alert-title">{nearbyHighlight ? nearbyHighlight.title + ' is nearby' : 'Location is ready for nearby saves'}</div>
            <div className="alert-sub">{nearbyHighlight ? (getLocationLabel(nearbyHighlight) || 'Open it now') : 'Turn on location to surface saves close to you'}</div>
          </div>
        </button>
        <div className="sec"><div className="sec-title">Trending spots</div><div className="sec-link" role="button" onClick={() => onNavigate('explore-map')}>See all</div></div>
        <div className="trending-scroll">
          {(topSaves.length ? topSaves : saves).map((save) => (
            <button key={save._id} type="button" className="t-card" onClick={() => onNavigate('place-detail', { saveId: save._id })}>
              <div className={save.thumbnail ? 't-img' : 't-img ' + (getCategoryLabel(save) === 'Travel' ? 't-img-1' : getCategoryLabel(save) === 'Eat' ? 't-img-2' : getCategoryLabel(save) === 'Shop' ? 't-img-4' : 't-img-3')}>
                {save.thumbnail ? <img src={save.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className={'ti ' + (save.category === 'shopping' ? 'ti-shopping-bag' : save.category === 'recipe' ? 'ti-chef-hat' : save.category === 'tech' ? 'ti-device-laptop' : 'ti-map-2')} style={{ fontSize: 22, color: getSaveAccent(save), opacity: 0.5 }} aria-hidden="true" />}
                <div className="t-saves">{getTimeAgo(save.createdAt)}</div>
              </div>
              <div className="t-body">
                <div className="t-name">{save.title}</div>
                <div className="t-loc">{getLocationLabel(save) || getCategoryLabel(save)}</div>
              </div>
            </button>
          ))}
        </div>
        {recentlySaved.length ? (
          <>
            <div className="sec"><div className="sec-title">Recently saved</div>
              {all && recentlySaved.length > 4 ? <div className="sec-link" role="button" onClick={() => toggle('recent')}>{expand.recent ? 'Show less' : `${recentlySaved.length} saves`}</div> : null}
            </div>
            {displayRecent.map(feedCard)}
          </>
        ) : null}
        {videoSaves.length ? (
          <>
            <div className="sec"><div className="sec-title">Videos &amp; reels</div>
              {all && videoSaves.length > 3 ? <div className="sec-link" role="button" onClick={() => toggle('videos')}>{expand.videos ? 'Show less' : `${videoSaves.length} saves`}</div> : null}
            </div>
            {displayVideos.map(feedCard)}
          </>
        ) : null}
        {bundleSaves.length ? (
          <>
            <div className="sec"><div className="sec-title">Screenshot bundles</div>
              {all && bundleSaves.length > 2 ? <div className="sec-link" role="button" onClick={() => toggle('bundles')}>{expand.bundles ? 'Show less' : `${bundleSaves.length} bundles`}</div> : null}
            </div>
            {displayBundles.map(feedCard)}
          </>
        ) : null}
        {filteredSaves.length === 0 ? (
          <div className="wt-empty-placeholder">No saves match “{activeFilter}”.</div>
        ) : null}
        <div style={{ height: 8 }} />
        <NavBar currentScreen="home" onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function useAppShell() {
  const [, setHistory] = useState([]);
  const [route, setRoute] = useState({ screen: 'login', payload: null });

  useEffect(() => {
    try {
      const token = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('user');
      if (token && storedUser) {
        const user = JSON.parse(storedUser);
        setRoute({ screen: user?.onboarding?.completed === false ? 'onboarding' : 'home', payload: null });
      } else {
        setRoute({ screen: 'login', payload: null });
      }
    } catch {
      setRoute({ screen: 'login', payload: null });
    }
  }, []);

  const navigate = (nextScreen, payload = null) => {
    setHistory((prev) => [...prev, route]);
    setRoute({ screen: nextScreen, payload });
  };

  const goBack = () => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const next = prev[prev.length - 1];
      setRoute(next);
      return prev.slice(0, -1);
    });
  };

  return {
    currentScreen: route.screen,
    currentPayload: route.payload,
    navigate,
    goBack,
    setCurrentScreen: (screen, payload = null) => setRoute({ screen, payload }),
  };
}

const formatShortDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRelative = (value) => getTimeAgo(value) || formatShortDate(value);

const getSaveLocation = (save) => {
  const place = save?.aiAnalysis?.structuredData?.place || {};
  const itinerary = save?.aiAnalysis?.structuredData?.itinerary || {};
  return [
    place.name,
    place.address,
    place.city,
    place.country,
    itinerary.destination,
    save?.userNote,
    save?.description,
  ].find(Boolean) || '';
};

const getSaveTags = (save) => {
  const fromSave = asArray(save?.tags);
  if (fromSave.length) return fromSave.slice(0, 4);
  const structured = save?.aiAnalysis?.structuredData || {};
  const place = structured.place || {};
  const itinerary = structured.itinerary || {};
  const tags = [
    place.cuisine,
    place.priceRange,
    itinerary.bestSeason,
    ...asArray(itinerary.highlights),
    save?.intentType,
    save?.source,
  ].filter(Boolean);
  return [...new Set(tags)].slice(0, 4);
};

const getSaveIcon = (save) => {
  const category = String(save?.category || '').toLowerCase();
  if (['food', 'cafes', 'restaurants', 'recipes', 'restaurant', 'cafe'].includes(category)) return 'ti-coffee';
  if (['shopping', 'fashion', 'product'].includes(category)) return 'ti-shopping-bag';
  if (['learning', 'productivity', 'tech'].includes(category)) return 'ti-device-laptop';
  if (['events', 'experiences', 'experience', 'hotels', 'travel'].includes(category)) return 'ti-mountain';
  return 'ti-bookmark';
};

const getCollectionCount = (collection) => collection?.metadata?.itemCount ?? asArray(collection?.saves).length;

function SaveDetailScreen({ onNavigate, goBack, payload }) {
  const saveId = payload?.saveId || payload?.id;
  const [save, setSave] = useState(payload?.save || null);
  const [loading, setLoading] = useState(Boolean(saveId) && !payload?.save);
  const [insights, setInsights] = useState([]);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [related, setRelated] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!saveId) {
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    Promise.all([
      api.getSaveById(saveId).catch(() => null),
      api.getRecommendations(saveId).catch(() => null),
    ]).then(([saveRes, recRes]) => {
      if (!alive) return;
      if (saveRes?.status === 'success') setSave(saveRes.data || null);
      setRelated(asArray(recRes?.data || recRes?.data?.recommendations || recRes?.data?.items));
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [saveId]);

  const planTrip = async () => {
    if (!save?._id || busy) return;
    setBusy('plan');
    const res = await api.getPlan(save._id).catch(() => null);
    if (res?.status === 'success') setPlan(res.data || null);
    setBusy('');
  };

  const refreshInsights = async () => {
    if (!save?._id || busy) return;
    setBusy('insights');
    const res = await api.getInsights(save._id).catch(() => null);
    const data = res?.data ?? res;
    if (res?.status === 'success') setInsights(Array.isArray(data) ? data : []);
    setBusy('');
  };

  const heroIcon = getSaveIcon(save);
  const heroTitle = save?.title || 'Save details';
  const heroSubtitle = getSaveLocation(save) || save?.author || save?.source || 'No location attached';
  const tags = getSaveTags(save);
  const aiSummary = save?.aiAnalysis?.summary || save?.description || save?.userNote || '';
  const keyPoints = asArray(save?.aiAnalysis?.keyPoints).slice(0, 8);
  const place = save?.aiAnalysis?.structuredData?.place || {};
  const itinerary = save?.aiAnalysis?.structuredData?.itinerary || {};

  // Location is only meaningful for place-based saves (travel, cafés, restaurants, events).
  // Recipes, screenshots and products have no useful location — hide the map card for them.
  const sdType = String(save?.aiAnalysis?.structuredData?.type || '').toLowerCase();
  const catLower = String(save?.category || '').toLowerCase();
  const recipe = save?.aiAnalysis?.structuredData?.recipe || null;
  const isRecipe = sdType === 'recipe' || catLower === 'recipes' || Boolean(recipe?.isRecipe);
  const isScreenshot = save?.contentType === 'image' || save?.source === 'manual' || asArray(save?.screenshots).length > 0;
  const isProduct = sdType === 'product' || ['shopping', 'fashion', 'beauty', 'product'].includes(catLower);
  const locName = place.name || place.city || save?.extractedLocation?.name || save?.extractedLocation?.city || save?.place?.city || itinerary.destination || '';
  const showLocation = Boolean(locName) && !isRecipe && !isScreenshot && !isProduct;

  if (loading) {
    return <div className="mobile-shell"><div className="screen" style={{ minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#565656' }}>Loading…</div></div>;
  }

  if (!save) {
    return <PhoneFrame height={480}><div className="body" style={{ paddingTop: 40, textAlign: 'center', color: '#777', fontSize: 12 }}>Save not found.</div></PhoneFrame>;
  }

  return (
    <PhoneFrame height={480}>
      <div className="hero">
        {save.thumbnail ? (
          <img src={save.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <i className={`ti ${heroIcon}`} style={{ fontSize: 80, color: getSaveAccent(save), opacity: 0.12, position: 'absolute', right: -10, bottom: -10 }} aria-hidden="true" />
        )}
        <button className="back" type="button" onClick={goBack || (() => onNavigate('home'))}>
          <i className="ti ti-arrow-left" style={{ fontSize: 11, color: '#333' }} aria-hidden="true" />
        </button>
        <div className="hero-bottom">
          <div className="hero-cat">{getCategoryLabel(save)}</div>
          <div className="hero-src"><i className="ti ti-link" style={{ fontSize: 8 }} aria-hidden="true" /> {save.source || 'saved item'}</div>
        </div>
      </div>
      <div className="title-block">
        <div className="det-title">{heroTitle}</div>
        <div className="det-sub"><i className="ti ti-map-pin" style={{ fontSize: 8 }} aria-hidden="true" /> {heroSubtitle} &nbsp;·&nbsp; <span className="det-rating">{save.intentStatus || 'saved'}</span></div>
        <div className="tags">
          {tags.length ? tags.map((tag) => <span key={tag} className="tag">{tag}</span>) : <span className="tag">No tags yet</span>}
        </div>
        {(!isRecipe && !isScreenshot) ? (
          <div className="cta-row">
            <button className="cta cta-primary" type="button" onClick={refreshInsights} disabled={Boolean(busy)}>
              <i className="ti ti-sparkles" aria-hidden="true" /> {busy === 'insights' ? 'Finding…' : 'Find more'}
            </button>
            {showLocation ? (
              <button className="cta cta-secondary" type="button" onClick={planTrip} disabled={Boolean(busy) || save.processingStatus === 'pending'}>
                <i className="ti ti-route" aria-hidden="true" /> {busy === 'plan' ? 'Planning…' : 'Plan trip'}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="actions" style={{ marginTop: 8 }}>
          {save.url ? (
            <button className="btn-icon" type="button" onClick={() => window.open(save.url, '_blank', 'noopener,noreferrer')} title="Open source"><i className="ti ti-external-link" style={{ fontSize: 14, color: '#565656' }} aria-hidden="true" /></button>
          ) : null}
          {showLocation ? (
            <button className="btn-icon" type="button" onClick={() => onNavigate('explore-map', { saveId })} title="Directions"><i className="ti ti-directions" style={{ fontSize: 14, color: '#565656' }} aria-hidden="true" /></button>
          ) : null}
          <button className="btn-icon" type="button" onClick={() => save.url && window.open(save.url, '_blank', 'noopener,noreferrer')} title="Share"><i className="ti ti-share" style={{ fontSize: 14, color: '#565656' }} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr">
          <i className="ti ti-sparkles" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
          <div className="card-hdr-title">AI summary</div>
        </div>
        <div className="card-body">
          <div className="ai-text">{aiSummary || 'No analysis available yet.'}</div>
        </div>
      </div>
      {keyPoints.length ? (
        <div className="card">
          <div className="card-hdr">
            <i className="ti ti-list-check" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
            <div className="card-hdr-title">Key points</div>
          </div>
          <div className="card-body">
            {keyPoints.map((point, i) => (
              <div key={i} className="highlight-item"><div className="h-dot" /><div className="h-text">{point}</div></div>
            ))}
          </div>
        </div>
      ) : null}
      {isRecipe && recipe ? (
        <div className="card">
          <div className="card-hdr">
            <i className="ti ti-chef-hat" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
            <div className="card-hdr-title">Recipe</div>
          </div>
          <div className="card-body">
            {recipe.cookingTime || recipe.servings || recipe.cuisine ? (
              <div className="plan-cost" style={{ marginTop: 0 }}>
                {recipe.cookingTime ? <span className="plan-cost-item"><i className="ti ti-clock" aria-hidden="true" /> {recipe.cookingTime}</span> : null}
                {recipe.servings ? <span className="plan-cost-item"><i className="ti ti-users" aria-hidden="true" /> {recipe.servings}</span> : null}
                {recipe.cuisine ? <span className="plan-cost-item"><i className="ti ti-world" aria-hidden="true" /> {recipe.cuisine}</span> : null}
              </div>
            ) : null}
            {asArray(recipe.ingredients).length ? (
              <>
                <div className="plan-sub-label">Ingredients</div>
                {asArray(recipe.ingredients).map((ing, i) => (
                  <div key={i} className="highlight-item"><div className="h-dot" /><div className="h-text">{typeof ing === 'string' ? ing : (ing?.name || '')}</div></div>
                ))}
              </>
            ) : null}
            {asArray(recipe.steps).length ? (
              <>
                <div className="plan-sub-label">Steps</div>
                {asArray(recipe.steps).map((step, i) => (
                  <div key={i} className="step-row">
                    <span className="step-num">{i + 1}</span>
                    <div className="h-text">{typeof step === 'string' ? step : (step?.text || '')}</div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {insights.length ? (
        <div className="card">
          <div className="card-hdr">
            <i className="ti ti-bulb" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
            <div className="card-hdr-title">Discover more</div>
          </div>
          <div className="card-body">
            {insights.map((it, i) => {
              const text = typeof it === 'string' ? it : (it?.text || '');
              const domain = typeof it === 'object' ? (it?.source_domain || '') : '';
              const url = typeof it === 'object' ? it?.url : '';
              if (!text) return null;
              return (
                <div key={i} className="highlight-item">
                  <div className="h-dot" />
                  <div className="h-text">
                    {text}
                    {url ? (
                      <>{' '}<a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mint-text)', textDecoration: 'none' }}>{domain || 'source'}</a></>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div className="ai-disclaimer"><i className="ti ti-sparkles" aria-hidden="true" /> AI-generated from web search · results may vary</div>
          </div>
        </div>
      ) : null}
      {plan && Array.isArray(plan.destinations) && plan.destinations.length ? (
        <div className="card">
          <div className="card-hdr">
            <i className="ti ti-route" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
            <div className="card-hdr-title">Trip plan{plan.origin ? ` from ${plan.origin}` : ''}</div>
          </div>
          <div className="card-body">
            {plan.destinations.map((d, i) => (
              <div key={i} className="plan-dest">
                <div className="plan-dest-name">{d.name || d.city}</div>
                {d.flightApprox || d.hotelApprox ? (
                  <div className="plan-cost">
                    {d.flightApprox ? (
                      <span className="plan-cost-item"><i className="ti ti-plane" aria-hidden="true" /> {d.flightApprox} <small>round trip</small></span>
                    ) : null}
                    {d.hotelApprox ? (
                      <span className="plan-cost-item"><i className="ti ti-bed" aria-hidden="true" /> {d.hotelApprox} <small>per night</small></span>
                    ) : null}
                  </div>
                ) : null}

                {asArray(d.gettingThere).length ? (
                  <>
                    <div className="plan-sub-label">Getting there</div>
                    <div className="plan-rows">
                      {asArray(d.gettingThere).map((g, gi) => (
                        <a key={`g${gi}`} className="plan-row" href={g.url} target="_blank" rel="noopener noreferrer">
                          <span className="plan-row-ic"><i className={`ti ${PLAN_MODE_ICON[g.mode] || 'ti-arrow-right'}`} style={{ fontSize: 15, color: '#2EC4A0' }} aria-hidden="true" /></span>
                          <div className="plan-row-main">
                            <div className="plan-row-title">{g.mode}</div>
                            <div className="plan-row-sub">{[g.provider, g.approx].filter(Boolean).join(' · ') || 'Search options'}</div>
                          </div>
                          <i className="ti ti-chevron-right" style={{ fontSize: 13, color: '#767676' }} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </>
                ) : null}

                {asArray(d.stays).length ? (
                  <>
                    <div className="plan-sub-label">Where to stay</div>
                    <div className="plan-rows">
                      {asArray(d.stays).map((s, si) => (
                        <a key={`s${si}`} className="plan-row" href={s.url} target="_blank" rel="noopener noreferrer">
                          <span className="plan-row-ic"><i className="ti ti-building" style={{ fontSize: 15, color: '#2EC4A0' }} aria-hidden="true" /></span>
                          <div className="plan-row-main">
                            <div className="plan-row-title">{s.provider}</div>
                            <div className="plan-row-sub">{[s.tier, s.approx].filter(Boolean).join(' · ') || 'View stays'}</div>
                          </div>
                          <i className="ti ti-chevron-right" style={{ fontSize: 13, color: '#767676' }} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </>
                ) : null}

                {asArray(d.explore).length ? (
                  <div className="plan-explore">
                    {asArray(d.explore).map((x, xi) => <span key={xi} className="vibe">{x}</span>)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="card">
        <div className="card-hdr">
          <i className="ti ti-video" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
          <div className="card-hdr-title">Saved from</div>
        </div>
        <div className="card-body">
          <div className="highlight-item"><div className="h-dot" /><div className="h-text">{save.author || 'Unknown author'} {save.authorHandle ? `@${save.authorHandle}` : ''}</div></div>
          <div className="highlight-item"><div className="h-dot" /><div className="h-text">{save.url || 'No URL stored'}</div></div>
          <div className="highlight-item"><div className="h-dot" /><div className="h-text">{formatRelative(save.createdAt)}</div></div>
        </div>
      </div>
      {showLocation ? (
        <div className="card">
          <div className="card-hdr">
            <i className="ti ti-map-pin" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
            <div className="card-hdr-title">Location</div>
          </div>
          <div className="map-placeholder">
            <div className="map-pin-dot" />
            <div className="map-label">{locName}</div>
          </div>
        </div>
      ) : null}
      {(() => {
        // Only render fields that actually have data — never show "No budget info".
        const rows = [
          ['Place', itinerary.destination || locName],
          ['Duration', itinerary.duration],
          ['Best season', itinerary.bestSeason],
          ['Est. cost', itinerary.estimatedCost],
        ].filter(([, v]) => v);
        const highlights = asArray(itinerary.highlights || save?.aiAnalysis?.structuredData?.highlights).slice(0, 8);
        if (!rows.length && !highlights.length) return null;
        return (
          <div className="card">
            <div className="card-hdr">
              <i className="ti ti-map-2" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
              <div className="card-hdr-title">Trip details</div>
            </div>
            <div className="card-body">
              {rows.map(([label, value]) => (
                <div key={label} className="kv-row">
                  <span className="kv-label">{label}</span>
                  <span className="kv-value">{value}</span>
                </div>
              ))}
              {highlights.length ? (
                <>
                  <div className="plan-sub-label" style={{ marginTop: rows.length ? 10 : 0 }}>Highlights</div>
                  <div className="chips-row">
                    {highlights.map((h, i) => <span key={i} className="vibe">{typeof h === 'string' ? h : (h?.name || '')}</span>)}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        );
      })()}
      {related.length ? (
        <div className="card">
          <div className="card-hdr">
            <i className="ti ti-map-2" style={{ fontSize: 12, color: '#2EC4A0' }} aria-hidden="true" />
            <div className="card-hdr-title">Related saves</div>
          </div>
          <div className="nearby-scroll">
            {related.slice(0, 4).map((item) => (
              <button key={item._id || item.url || item.title} className="nb" type="button" onClick={() => item._id && onNavigate('place-detail', { saveId: item._id })}>
                <div className="nb-img nb-a">
                  {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : <i className={`ti ${getSaveIcon(item)}`} style={{ fontSize: 16, color: getSaveAccent(item), opacity: 0.6 }} aria-hidden="true" />}
                </div>
                <div className="nb-name">{item.title}<div className="nb-loc">{getSaveLocation(item) || getCategoryLabel(item)}</div></div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div style={{ height: 14 }} />
      <NavBar currentScreen={payload?.from || ''} onNavigate={onNavigate} />
    </PhoneFrame>
  );
}

function PlaceDetailScreen({ onNavigate, goBack, payload }) {
  return <SaveDetailScreen onNavigate={onNavigate} goBack={goBack || (() => onNavigate('explore-map'))} payload={payload} />;
}

function ExploreMapScreen({ onNavigate }) {
  const [saves, setSaves] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [meRes, savesRes] = await Promise.all([
        api.getMe().catch(() => null),
        api.getSaves().catch(() => null),
      ]);
      if (!alive) return;
      if (meRes?.status === 'success') setUser(meRes.data || {});
      const data = savesRes?.status === 'success' ? savesRes.data || [] : [];
      setSaves(data.filter((item) => !item.isTemplate));
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const res = await api.getNearbySaves(pos.coords.latitude, pos.coords.longitude, 5000);
            if (!alive) return;
            setNearby(asArray(res?.saves));
          } catch {
            if (alive) setNearby([]);
          } finally {
            if (alive) setLoading(false);
          }
        }, () => {
          if (alive) setLoading(false);
        }, { timeout: 5000, maximumAge: 300000 });
      } else {
        setLoading(false);
      }
    };
    load().finally(() => {
      if (alive && !navigator.geolocation) setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const pins = (nearby.length ? nearby : saves).slice(0, 4);
  const city = user?.location?.city || user?.metadata?.location || 'Your area';
  const list = nearby.length ? nearby : saves.slice(0, 3);

  if (loading) {
    return <div className="mobile-shell"><div className="screen" style={{ minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#565656' }}>Loading…</div></div>;
  }

  return (
    <PhoneFrame height={420} compact>
      <div className="map-full">
        <div className="map-search">
          <i className="ti ti-search" style={{ fontSize: 10, color: '#767676' }} aria-hidden="true" />
          <span>Search {city}</span>
        </div>
        <div className="you-ring" />
        <div className="you-dot" />
        {pins.map((item, index) => (
          <div key={item._id || item.title} className="map-pin" style={{ top: 28 + (index * 18), left: 28 + ((index % 2) * 78) }}>
            <div className="pin-dot" />
            <div className="pin-line" />
            <div className="pin-label">{item.title}</div>
          </div>
        ))}
      </div>
      <div className="filter-row">
        {['All', 'Travel', 'Cafes', 'Saved', 'Trending'].map((chip, index) => (
          <div key={chip} className={`filter-chip ${index === 0 ? 'fc-on' : 'fc-off'}`}>{chip}</div>
        ))}
      </div>
      <div className="sec"><div className="sec-t">Near you</div><div className="sec-l" onClick={() => onNavigate('nearby')}>View all</div></div>
      {list.length ? list.map((item) => (
        <button key={item._id || item.title} className="place-list-card" type="button" onClick={() => item._id && onNavigate('place-detail', { saveId: item._id })}>
          <div className="plc-img plc-img-b">
            {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : <i className={`ti ${getSaveIcon(item)}`} style={{ fontSize: 16, color: getSaveAccent(item), opacity: 0.7 }} aria-hidden="true" />}
          </div>
          <div className="plc-info"><div className="plc-name">{item.title}</div><div className="plc-loc">{getSaveLocation(item) || getCategoryLabel(item)}</div></div>
          <div className="plc-right"><div className="plc-dist">{formatRelative(item.createdAt)}</div><div className="plc-type">{getCategoryLabel(item)}</div></div>
        </button>
      )) : <div style={{ padding: 16, fontSize: 11, color: '#777' }}>No saves to show on the map.</div>}
      <div style={{ height: 8 }} />
      <NavBar currentScreen="explore-map" onNavigate={onNavigate} />
    </PhoneFrame>
  );
}

function CollectionsScreen({ onNavigate }) {
  const [collections, setCollections] = useState([]);
  const [saves, setSaves] = useState([]);
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [meRes, colRes, savesRes] = await Promise.all([
        api.getMe().catch(() => null),
        api.getCollections().catch(() => null),
        api.getSaves().catch(() => null),
      ]);
      if (!alive) return;
      if (meRes?.status === 'success') setUser(meRes.data || {});
      setCollections(colRes?.status === 'success' ? colRes.data || [] : []);
      setSaves(savesRes?.status === 'success' ? (savesRes.data || []).filter((item) => !item.isTemplate) : []);
      setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, []);

  const totalPlanned = saves.filter((item) => item.intentStatus === 'planned').length;
  const totalSaves = saves.length;

  if (loading) {
    return <div className="mobile-shell"><div className="screen" style={{ minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#565656' }}>Loading…</div></div>;
  }

  return (
    <PhoneFrame height={420} compact>
      <div className="hdr-bar">
        <div className="logo">wanna<em>try</em></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="back-btn" type="button" onClick={() => onNavigate('home')}><i className="ti ti-plus" style={{ fontSize: 11, color: '#2EC4A0' }} aria-hidden="true" /></button>
          <div className="avatar">{getInitials(user.name || user.email || smileInitials)}</div>
        </div>
      </div>
      <div className="coll-hero">
        <div className="coll-stats">
          <div className="stat-box"><div className="stat-num">{totalSaves}</div><div className="stat-lbl">Total saves</div></div>
          <div className="stat-box"><div className="stat-num">{collections.length}</div><div className="stat-lbl">Collections</div></div>
          <div className="stat-box"><div className="stat-num">{totalPlanned}</div><div className="stat-lbl">Planned</div></div>
        </div>
      </div>
      <div className="sec"><div className="sec-t">My collections</div><div className="sec-l">Edit</div></div>
      {collections.length ? collections.map((collection) => {
        const cover = first(asArray(collection.saves));
        return (
          <button key={collection._id} className="coll-card" type="button" onClick={() => onNavigate('collection-detail', { collectionId: collection._id })}>
            <div className="coll-img coll-img-a">
              {cover?.thumbnail ? <img src={cover.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : <i className={`ti ${getSaveIcon(cover)}`} style={{ fontSize: 22, color: collection.color || '#2EC4A0', opacity: 0.5 }} aria-hidden="true" />}
              <div className="coll-count">{getCollectionCount(collection)} saves</div>
            </div>
            <div className="coll-body">
              <div className="coll-name">{collection.name}</div>
              <div className="coll-sub">{collection.description || 'Collection from your saved items'}</div>
              <div className="coll-row">
                <span className="coll-tag" style={{ borderRadius: 10, borderColor: collection.color || '#EFEFEF' }}>{collection.icon || '📌'}</span>
                <span style={{ fontSize: 7, color: '#6b6b6b' }}>{formatRelative(collection.updatedAt || collection.createdAt)}</span>
              </div>
            </div>
          </button>
        );
      }) : <div style={{ padding: 16, fontSize: 11, color: '#777' }}>No collections yet.</div>}
      <button className="add-coll" type="button">
        <i className="ti ti-plus" style={{ fontSize: 13, color: '#767676' }} aria-hidden="true" />
        <span>New collection</span>
      </button>
      <div style={{ height: 8 }} />
      <NavBar currentScreen="collections" onNavigate={onNavigate} />
    </PhoneFrame>
  );
}

function CollectionDetailScreen({ onNavigate, goBack, payload }) {
  const collectionId = payload?.collectionId || payload?.id;
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(Boolean(collectionId));

  useEffect(() => {
    let alive = true;
    if (!collectionId) {
      setLoading(false);
      return () => { alive = false; };
    }
    api.getCollectionById(collectionId).then((res) => {
      if (alive && res?.status === 'success') setCollection(res.data || null);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [collectionId]);

  if (loading) {
    return <div className="mobile-shell"><div className="screen" style={{ minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#565656' }}>Loading…</div></div>;
  }

  if (!collection) {
    return <PhoneFrame height={420} compact><div className="body" style={{ paddingTop: 40, textAlign: 'center', color: '#777', fontSize: 12 }}>Collection not found.</div></PhoneFrame>;
  }

  return (
    <PhoneFrame height={420} compact>
      <div className="hdr-bar">
        <button className="back-btn" type="button" onClick={goBack || (() => onNavigate('collections'))}>
          <i className="ti ti-arrow-left" style={{ fontSize: 11, color: '#333' }} aria-hidden="true" />
        </button>
        <div className="hdr-title-sm">{collection.name}</div>
        <div style={{ width: 26 }} />
      </div>
      <div className="coll-hero">
        <div className="coll-stats">
          <div className="stat-box"><div className="stat-num">{getCollectionCount(collection)}</div><div className="stat-lbl">Saves</div></div>
          <div className="stat-box"><div className="stat-num">{collection.isAuto ? 1 : 0}</div><div className="stat-lbl">Auto</div></div>
          <div className="stat-box"><div className="stat-num">{asArray(collection.collaborators).length}</div><div className="stat-lbl">Shared</div></div>
        </div>
      </div>
      <div className="sec"><div className="sec-t">In this collection</div><div className="sec-l">Edit</div></div>
      {asArray(collection.saves).length ? asArray(collection.saves).map((save) => (
        <button key={save._id} className="place-list-card" type="button" onClick={() => onNavigate('place-detail', { saveId: save._id })}>
          <div className="plc-img plc-img-a">
            {save.thumbnail ? <img src={save.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : <i className={`ti ${getSaveIcon(save)}`} style={{ fontSize: 16, color: getSaveAccent(save), opacity: 0.7 }} aria-hidden="true" />}
          </div>
          <div className="plc-info"><div className="plc-name">{save.title}</div><div className="plc-loc">{getSaveLocation(save) || getCategoryLabel(save)}</div></div>
          <div className="plc-right"><div className="plc-dist">{save.intentStatus || 'saved'}</div><div className="plc-type">{getCategoryLabel(save)}</div></div>
        </button>
      )) : <div style={{ padding: 16, fontSize: 11, color: '#777' }}>No saves in this collection.</div>}
      <div style={{ height: 8 }} />
      <NavBar currentScreen="collections" onNavigate={onNavigate} />
    </PhoneFrame>
  );
}

function NearbyScreen({ onNavigate }) {
  const [nearby, setNearby] = useState([]);
  const [user, setUser] = useState({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const meRes = await api.getMe().catch(() => null);
      if (alive && meRes?.status === 'success') setUser(meRes.data || {});
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const res = await api.getNearbySaves(pos.coords.latitude, pos.coords.longitude, 5000);
          if (alive) setNearby(asArray(res?.saves));
        } catch {
          if (alive) setNearby([]);
        }
      }, () => {}, { timeout: 5000, maximumAge: 300000 });
    };
    load();
    return () => { alive = false; };
  }, []);

  const city = user?.location?.city || user?.metadata?.location || 'Your area';

  return (
    <PhoneFrame height={420} compact>
      <div className="hdr-bar">
        <div className="hdr-title-sm">Near you</div>
        <div style={{ fontSize: 8, color: '#2EC4A0' }}>{city}</div>
      </div>
      <div className="nearby-map">
        <div className="you-ring" />
        <div className="you-dot" />
        {(nearby.length ? nearby : []).slice(0, 4).map((item, index) => (
          <div key={item._id || item.title} className="nb-pin" style={{ top: 20 + (index * 18), left: 22 + ((index % 2) * 90) }}>
            <div className="nb-pin-dot" style={{ background: index % 2 ? '#F0A050' : '#2EC4A0' }} />
            <div className="nb-pin-lbl">{item.title}</div>
          </div>
        ))}
      </div>
      <div className="sec"><div className="sec-t">Your saves nearby</div><div className="sec-l">{nearby.length} saves</div></div>
      {nearby.length ? nearby.map((item) => (
        <button key={item._id} className="nb-list-card" type="button" onClick={() => onNavigate('place-detail', { saveId: item._id })}>
          <div className="nb-lc-img" style={{ background: '#FEF3E8' }}>
            {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : <i className={`ti ${getSaveIcon(item)}`} style={{ fontSize: 16, color: getSaveAccent(item), opacity: 0.7 }} aria-hidden="true" />}
          </div>
          <div className="nb-lc-info"><div className="nb-lc-name">{item.title}</div><div className="nb-lc-sub">{getSaveLocation(item) || getCategoryLabel(item)}</div></div>
          <div className="nb-lc-right"><div className="nb-dist">{formatRelative(item.createdAt)}</div><div className="nb-saved">{item.intentStatus || 'saved'}</div></div>
        </button>
      )) : <div style={{ padding: 16, fontSize: 11, color: '#777' }}>No nearby saves found. Turn on location or add more saves.</div>}
      <div style={{ height: 8 }} />
      <NavBar currentScreen="nearby" onNavigate={onNavigate} />
    </PhoneFrame>
  );
}

function ProfileScreen({ onNavigate }) {
  const [user, setUser] = useState({});
  const [saves, setSaves] = useState([]);
  const [collections, setCollections] = useState([]);
  const [notifications, setNotifications] = useState(true);
  const [nearbyAlerts, setNearbyAlerts] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [meRes, savesRes, collectionsRes] = await Promise.all([
        api.getMe().catch(() => null),
        api.getSaves().catch(() => null),
        api.getCollections().catch(() => null),
      ]);
      if (!alive) return;
      if (meRes?.status === 'success') {
        setUser(meRes.data || {});
        setNotifications(meRes.data?.notificationsEnabled !== false);
        setNearbyAlerts(meRes.data?.locationEnabled !== false);
      }
      setSaves(savesRes?.status === 'success' ? (savesRes.data || []).filter((item) => !item.isTemplate) : []);
      setCollections(collectionsRes?.status === 'success' ? collectionsRes.data || [] : []);
    };
    load();
    return () => { alive = false; };
  }, []);

  const persistSettings = async (patch) => {
    setSaving(true);
    try {
      await api.updateSettings(patch);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifications = async () => {
    const next = !notifications;
    setNotifications(next);
    await persistSettings({ notificationsEnabled: next });
  };

  const toggleNearby = async () => {
    const next = !nearbyAlerts;
    setNearbyAlerts(next);
    await persistSettings({ locationEnabled: next });
  };

  return (
    <PhoneFrame height={420} compact>
      <div className="hdr-bar">
        <div className="hdr-title-sm">Profile</div>
        <button className="back-btn" type="button">
          <i className="ti ti-settings" style={{ fontSize: 11, color: '#6b6b6b' }} aria-hidden="true" />
        </button>
      </div>
      <div className="prof-top">
        <div className="prof-av">{getInitials(user.name || user.email || smileInitials)}</div>
        <div className="prof-name">{user.name || user.email || 'Profile'}</div>
        <div className="prof-handle">{user.email ? `@${user.email.split('@')[0]}` : 'Account overview'}{user.location?.city ? ` · ${user.location.city}` : ''}</div>
        <div className="prof-stats">
          <div className="ps"><div className="ps-num">{saves.length}</div><div className="ps-lbl">Saves</div></div>
          <div className="ps"><div className="ps-num">{collections.length}</div><div className="ps-lbl">Collections</div></div>
          <div className="ps"><div className="ps-num">{saves.filter((item) => item.intentStatus === 'planned').length}</div><div className="ps-lbl">Planned</div></div>
        </div>
      </div>
      <div className="pref-section" style={{ marginTop: 10 }}>
        <div className="pref-row">
          <div className="pref-left"><i className="ti ti-bell" style={{ fontSize: 13, color: '#2EC4A0' }} aria-hidden="true" /><div><div className="pref-label">Notifications</div><div className="pref-sub">Reminders and alerts</div></div></div>
          <button type="button" className={`toggle ${notifications ? '' : 'toggle-off'}`} onClick={toggleNotifications} disabled={saving}><div className="toggle-dot" /></button>
        </div>
        <div className="pref-row">
          <div className="pref-left"><i className="ti ti-map-pin" style={{ fontSize: 13, color: '#2EC4A0' }} aria-hidden="true" /><div><div className="pref-label">Nearby alerts</div><div className="pref-sub">When you're close to a save</div></div></div>
          <button type="button" className={`toggle ${nearbyAlerts ? '' : 'toggle-off'}`} onClick={toggleNearby} disabled={saving}><div className="toggle-dot" /></button>
        </div>
        <div className="pref-row">
          <div className="pref-left"><i className="ti ti-moon" style={{ fontSize: 13, color: '#6b6b6b' }} aria-hidden="true" /><div><div className="pref-label">Dark mode</div><div className="pref-sub">Coming soon</div></div></div>
          <button type="button" className="toggle toggle-off" disabled><div className="toggle-dot" /></button>
        </div>
      </div>
      <div className="pref-section" style={{ marginTop: 8 }}>
        <button className="pref-row-link" type="button">
          <div className="pref-left"><i className="ti ti-help" style={{ fontSize: 13, color: '#6b6b6b' }} aria-hidden="true" /><div className="pref-label">Help & support</div></div>
          <i className="ti ti-chevron-right" style={{ fontSize: 10, color: '#767676' }} aria-hidden="true" />
        </button>
        <button className="pref-row-link" type="button">
          <div className="pref-left"><i className="ti ti-shield" style={{ fontSize: 13, color: '#6b6b6b' }} aria-hidden="true" /><div className="pref-label">Privacy policy</div></div>
          <i className="ti ti-chevron-right" style={{ fontSize: 10, color: '#767676' }} aria-hidden="true" />
        </button>
        <button className="pref-row-link" type="button">
          <div className="pref-left"><i className="ti ti-star" style={{ fontSize: 13, color: '#6b6b6b' }} aria-hidden="true" /><div className="pref-label">Rate WannaTry</div></div>
          <i className="ti ti-chevron-right" style={{ fontSize: 10, color: '#767676' }} aria-hidden="true" />
        </button>
      </div>
      <button className="logout-btn" type="button" onClick={() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        onNavigate('login');
      }}>Log out</button>
      <div style={{ height: 8 }} />
      <NavBar currentScreen="profile" onNavigate={onNavigate} />
    </PhoneFrame>
  );
}


function AddSaveScreen({ onNavigate }) {
  const [mode, setMode] = useState('link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => () => {
    files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, [files]);

  const addFiles = (incoming) => {
    setError('');
    const next = [];
    for (const file of incoming) {
      if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
        setError(`${file.name}: unsupported type`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name}: too large (max 10MB)`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setFiles((prev) => [...prev, ...next].slice(0, 12));
  };

  const removeFile = (index) => {
    setFiles((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (prev[index]?.previewUrl) URL.revokeObjectURL(prev[index].previewUrl);
      return next;
    });
  };

  const finish = () => {
    setDone(true);
    setSaving(false);
    setTimeout(() => onNavigate('home'), 900);
  };

  const submitLink = async () => {
    if (!url.trim()) {
      setError('Paste a link to save.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.submitLink(url.trim());
      finish();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Save failed');
    }
  };

  const submitPhotos = async () => {
    if (!files.length) {
      setError('Pick at least one image.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.submitScreenshotBundle(files.map((item) => item.file));
      files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setFiles([]);
      finish();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Upload failed');
    }
  };

  return (
    <PhoneFrame height={520}>
      <div className="hdr" style={{ paddingBottom: 12 }}>
        <div className="hdr-top">
          <div className="logo">wanna<em>try</em></div>
          <button className="icon-btn" type="button" onClick={() => onNavigate('home')}>
            <i className="ti ti-x" style={{ fontSize: 13, color: '#6b6b6b' }} aria-hidden="true" />
          </button>
        </div>
        <div className="greeting">Save a link or upload photos</div>
        <div className="hdr-title">Add a save</div>
      </div>

      {done ? (
        <div style={{ padding: '18px 14px 20px' }}>
          <div style={{ background: '#fff', border: '1px solid #efefef', borderRadius: 14, padding: 18, textAlign: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#F0FBF8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <i className="ti ti-check" style={{ fontSize: 20, color: '#2EC4A0' }} aria-hidden="true" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>Saved</div>
            <div style={{ fontSize: 8, color: '#6b6b6b', marginTop: 4 }}>Processing in the background</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 14px 14px' }}>
          <div className="chips" style={{ padding: '8px 0 0', background: 'transparent' }}>
            <button type="button" className={`chip ${mode === 'link' ? 'on' : 'off'}`} onClick={() => setMode('link')}>Link</button>
            <button type="button" className={`chip ${mode === 'photos' ? 'on' : 'off'}`} onClick={() => setMode('photos')}>Photos</button>
          </div>

          {mode === 'link' ? (
            <div style={{ marginTop: 12 }}>
              <div className="input-group">
                <div className="input-label">Link</div>
                <input className="input-field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a URL" />
              </div>
              <div className="input-group">
                <div className="input-label">Title</div>
                <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
              </div>
              <div className="input-group">
                <div className="input-label">Notes</div>
                <textarea className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why are you saving this?" style={{ minHeight: 82, resize: 'vertical' }} />
              </div>
              {error ? <div style={{ color: '#d33', fontSize: 8, marginBottom: 8 }}>{error}</div> : null}
              <button className="btn-primary" type="button" onClick={submitLink} disabled={saving}>{saving ? 'Saving…' : 'Save link'}</button>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div
                onClick={() => inputRef.current?.click()}
                style={{ border: '1px dashed #dcdcdc', borderRadius: 12, padding: '22px 14px', textAlign: 'center', background: '#fff', cursor: 'pointer' }}
              >
                <i className="ti ti-upload" style={{ fontSize: 24, color: '#2EC4A0' }} aria-hidden="true" />
                <div style={{ fontSize: 10, fontWeight: 500, color: '#111', marginTop: 8 }}>{files.length ? `${files.length} photo${files.length === 1 ? '' : 's'} selected` : 'Tap to add photos'}</div>
                <div style={{ fontSize: 8, color: '#6b6b6b', marginTop: 4 }}>PNG, JPG or WebP</div>
                <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: 'none' }} onChange={(e) => addFiles(Array.from(e.target.files || []))} disabled={saving} />
              </div>

              {files.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
                  {files.map((item, index) => (
                    <div key={item.previewUrl} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden' }}>
                      <img src={item.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removeFile(index)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 0, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 13 }}>×</button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="input-group" style={{ marginTop: 12 }}>
                <div className="input-label">Title</div>
                <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
              </div>
              <div className="input-group">
                <div className="input-label">Notes</div>
                <textarea className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why are you saving these?" style={{ minHeight: 82, resize: 'vertical' }} />
              </div>
              {error ? <div style={{ color: '#d33', fontSize: 8, marginBottom: 8 }}>{error}</div> : null}
              <button className="btn-primary" type="button" onClick={submitPhotos} disabled={saving || !files.length}>{saving ? 'Uploading…' : 'Upload photos'}</button>
            </div>
          )}
        </div>
      )}
      <div style={{ height: 6 }} />
      <NavBar currentScreen="add-save" onNavigate={onNavigate} />
    </PhoneFrame>
  );
}

function HomeEmptyScreen({ onNavigate }) {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    let alive = true;
    api.getTemplateSaves().then((res) => {
      if (alive && res?.status === 'success') setTemplates(asArray(res.data));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <PhoneFrame height={420} compact>
      <div className="empty-top">
        <div className="hdr-top">
          <div className="logo">wanna<em>try</em></div>
          <div className="avatar">{smileInitials}</div>
        </div>
      </div>
      <div className="empty-hero">
        <div className="empty-icon"><i className="ti ti-bookmark" style={{ fontSize: 22, color: '#2EC4A0' }} aria-hidden="true" /></div>
        <div className="empty-title">Your feed is empty.<br />Start saving real links.</div>
        <div className="empty-sub">Use the app on your own saves and the backend will populate this screen with your actual items.</div>
      </div>
      <button className="empty-cta" type="button" onClick={() => onNavigate('add-save')}>+ Save something</button>
      <div className="sec"><div className="sec-t">Template saves</div><div className="sec-l">{templates.length}</div></div>
      {templates.length ? templates.slice(0, 2).map((item) => (
        <button key={item._id} className="disc-card" type="button" onClick={() => onNavigate('place-detail', { saveId: item._id })}>
          <div className="disc-img coll-img-a">
            {item.thumbnail ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : <i className={`ti ${getSaveIcon(item)}`} style={{ fontSize: 22, color: getSaveAccent(item), opacity: 0.5 }} aria-hidden="true" />}
            <div className="disc-saves">{formatRelative(item.createdAt)}</div>
          </div>
          <div className="disc-body"><div className="disc-name">{item.title}</div><div className="disc-loc">{getSaveLocation(item) || getCategoryLabel(item)}</div><div className="disc-vibe">{getSaveTags(item).join(' · ') || 'Template save'}</div></div>
        </button>
      )) : <div style={{ padding: 16, fontSize: 11, color: '#777' }}>No template saves available.</div>}
      <div style={{ height: 8 }} />
      <NavBar currentScreen="home-empty" onNavigate={onNavigate} />
    </PhoneFrame>
  );
}

export default function WannaTryApp() {
  const { currentScreen, currentPayload, navigate, goBack } = useAppShell();

  const commonProps = { onNavigate: navigate, goBack, payload: currentPayload };

  const screen = (() => {
    switch (currentScreen) {
      case 'signup': return <SignupScreen {...commonProps} onComplete={navigate} />;
      case 'onboarding': return <OnboardingScreen {...commonProps} onComplete={navigate} />;
      case 'home': return <HomeFeedScreen {...commonProps} />;
      case 'save-detail': return <SaveDetailScreen {...commonProps} />;
      case 'place-detail': return <PlaceDetailScreen {...commonProps} />;
      case 'explore-map': return <ExploreMapScreen {...commonProps} />;
      case 'collections': return <CollectionsScreen {...commonProps} />;
      case 'collection-detail': return <CollectionDetailScreen {...commonProps} />;
      case 'nearby': return <NearbyScreen {...commonProps} />;
      case 'profile': return <ProfileScreen {...commonProps} />;
      case 'add-save': return <AddSaveScreen {...commonProps} />;
      case 'home-empty': return <HomeEmptyScreen {...commonProps} />;
      case 'login':
      default:
        return <LoginScreen {...commonProps} onComplete={navigate} />;
    }
  })();

  return (
    <div className="wt-app">
      {screen}
    </div>
  );
}
