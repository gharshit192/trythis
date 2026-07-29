import { useState, useEffect } from 'react';
import './theme.css';
import api from './api';

import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import Login from './screens/Login';
import Signup from './screens/Signup';
import HomeEmpty from './screens/HomeEmpty';
import HomeFeed from './screens/HomeFeed';
import SavedList from './screens/SavedList';
import AddSave from './screens/AddSave';
import Collections from './screens/Collections';
import SaveDetail from './screens/SaveDetail';
import Search from './screens/Search';
import Profile from './screens/Profile';
import Onboarding from './screens/Onboarding';
import NotificationPermission from './screens/NotificationPermission';
import Notifications from './screens/Notifications';
import ScreenshotSummary from './screens/ScreenshotSummary';
import TripCollection from './screens/TripCollection';
import ShoppingWishlist from './screens/ShoppingWishlist';
import Nearby from './screens/Nearby';
import CollectionDetail from './screens/CollectionDetail';
import DemoSaves from './screens/DemoSaves';
import FirstSaveSuccess from './screens/FirstSaveSuccess';
import ShareIntake from './screens/ShareIntake';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('login');
  const [payload, setPayload] = useState(null);
  const [saves, setSaves] = useState([]);
  const [nearbySaves, setNearbySaves] = useState([]);
  const [showNearbyBanner, setShowNearbyBanner] = useState(false);

  const requestAndStoreLocation = async () => {
    if (!navigator.geolocation) return;

    const stored = localStorage.getItem('location_requested');
    if (stored) return; // only ask once per session

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        localStorage.setItem('location_requested', 'true');
        try {
          await api.updateLocation(lat, lng, null);
          // Check for nearby saves and show banner if any found
          const result = await api.getNearbySaves(lat, lng);
          if (result.status === 'success' && result.saves?.length > 0) {
            setNearbySaves(result.saves);
            setShowNearbyBanner(true);
          }
        } catch {}
      },
      (err) => {
        localStorage.setItem('location_requested', 'denied');
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  };

  // Web Share Target intake (installed PWA): Android's share sheet opens the
  // app at /share-target?url=…&text=…&title=… (manifest.json share_target).
  // Consume the params, clean the URL so refresh can't double-save, and return
  // the share — or a share stashed from before login.
  const consumeSharedContent = () => {
    let shared = null;
    if (window.location.pathname === '/share-target') {
      const q = new URLSearchParams(window.location.search);
      const rawUrl = (q.get('url') || '').trim();
      const text = (q.get('text') || '').trim();
      const title = (q.get('title') || '').trim();
      // Instagram/YouTube usually put the link inside `text`, not `url`.
      const link = rawUrl || (text.match(/https?:\/\/\S+/) || [])[0] || (title.match(/https?:\/\/\S+/) || [])[0] || '';
      shared = { url: link, text, title };
      window.history.replaceState({}, '', '/');
    } else {
      try { shared = JSON.parse(localStorage.getItem('pending_share') || 'null'); } catch { shared = null; }
    }
    localStorage.removeItem('pending_share');
    return shared && (shared.url || shared.text || shared.title) ? shared : null;
  };

  useEffect(() => {
    // Synchronous auth check before rendering (prevents login flash)
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    const lastScreen = localStorage.getItem('last_screen');

    const shared = consumeSharedContent();
    if (shared) {
      if (storedToken && storedUser) {
        api.ping().catch(() => {});
        setPayload(shared);
        setCurrentScreen('share-intake');
      } else {
        // Save it right after login instead of losing the share.
        localStorage.setItem('pending_share', JSON.stringify(shared));
        setCurrentScreen('login');
      }
      setAuthChecked(true);
      return;
    }

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Record app session for D7 retention analytics
        api.ping().catch(() => {});

        // Onboarding flow disabled — authenticated users go straight to the app.
        // (parsedUser kept referenced to avoid unused-var lint)
        void parsedUser;
        api.getSaves().then(result => {
          if (result.status === 'success') {
            setSaves(result.data);
            // Go to last screen or home if user has saves
            if (lastScreen && ['home', 'collections', 'profile', 'search', 'notifications'].includes(lastScreen)) {
              setCurrentScreen(lastScreen);
            } else {
              setCurrentScreen(result.data.length > 0 ? 'home' : 'home-empty');
            }
            // Request location permission after saves are loaded
            requestAndStoreLocation();
          }
        }).catch(() => {});
      } catch {
        // Corrupted storage — clear and restart
        localStorage.clear();
        setCurrentScreen('login');
      }
    } else {
      setCurrentScreen('login');
    }
    setAuthChecked(true);
  }, []);

  // navigate(screen) or navigate(screen, payload)
  const navigate = (screen, nextPayload = null) => {
    // Onboarding flow disabled — no forced redirect after login/signup.

    // Check if trying to access protected screen without auth
    const protectedScreens = ['home', 'save-detail', 'savedList', 'search', 'collections', 'profile', 'notifications', 'nearby'];
    if (protectedScreens.includes(screen) && !localStorage.getItem('auth_token')) {
      setCurrentScreen('login');
      return;
    }

    // A share stashed before login gets saved as soon as the user lands home.
    if ((screen === 'home' || screen === 'home-empty') && localStorage.getItem('auth_token')) {
      try {
        const pending = JSON.parse(localStorage.getItem('pending_share') || 'null');
        if (pending && (pending.url || pending.text || pending.title)) {
          localStorage.removeItem('pending_share');
          setPayload(pending);
          setCurrentScreen('share-intake');
          return;
        }
      } catch {
        localStorage.removeItem('pending_share');
      }
    }

    setPayload(nextPayload);
    setCurrentScreen(screen);
    // Persist navigable screens to localStorage for recovery on hard refresh
    const persistable = ['home', 'collections', 'profile', 'search', 'notifications'];
    if (persistable.includes(screen)) {
      localStorage.setItem('last_screen', screen);
    }
  };

  // Show splash screen while auth is being checked
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--paper)'
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 6,
          background: 'var(--rust)',
          transform: 'rotate(-4deg)',
          border: '2px dashed rgba(255,255,255,.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: 26 }}>🔖</span>
        </div>
      </div>
    );
  }

  const props = { onNavigate: navigate, payload };

  const screenMap = {
    'login': <Login {...props} />,
    'signup': <Signup {...props} />,
    'onboarding': <Onboarding {...props} />,
    'demoSaves': <DemoSaves {...props} />,
    'firstSaveSuccess': <FirstSaveSuccess {...props} />,
    'notification-permission': <NotificationPermission {...props} />,
    'home-empty': <HomeEmpty {...props} />,
    'home': <HomeFeed {...props} nearbySaves={nearbySaves} showNearbyBanner={showNearbyBanner} onDismissNearby={() => setShowNearbyBanner(false)} />,
    'savedList': <SavedList {...props} saves={saves} filter={payload?.filter} title={payload?.title} />,
    'add-save': <AddSave {...props} />,
    'share-intake': <ShareIntake {...props} />,
    'save-detail': <SaveDetail {...props} />,
    'screenshot-summary': <ScreenshotSummary {...props} sessionId={payload?.sessionId} summary={payload?.summary} thumbnails={payload?.thumbnails || []} saveId={payload?.saveId} autoSaved={payload?.autoSaved} />,
    'collections': <Collections {...props} />,
    'collection-detail': <CollectionDetail {...props} />,
    'trip-collection': <TripCollection {...props} />,
    'shopping-wishlist': <ShoppingWishlist {...props} />,
    'nearby': <Nearby {...props} nearbySaves={nearbySaves} />,
    'search': <Search {...props} />,
    'notifications': <Notifications {...props} />,
    'profile': <Profile {...props} />,
  };

  // Screens that should show the bottom nav
  const hasBottomNav = ['home', 'home-empty', 'nearby', 'search', 'collections', 'profile', 'savedList', 'notifications'].includes(currentScreen);

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', background: 'transparent' }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden'
      }}>
        {/* Screen Content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorX: 'none', display: 'flex', flexDirection: 'column' }}>
          {screenMap[currentScreen] || screenMap['login']}
        </div>

        {/* Bottom Navigation - shown on main screens */}
        {hasBottomNav && <BottomNav currentScreen={currentScreen} onNavigate={navigate} />}
      </div>

      {/* PWA install / Add-to-Home-Screen nudge (Android button · iOS instructions) */}
      {hasBottomNav && <InstallPrompt />}
    </div>
  );
}

export default App;
