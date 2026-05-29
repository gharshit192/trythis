import { useState, useEffect } from 'react';
import './theme.css';
import api from './api';

import BottomNav from './components/BottomNav';
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
import FoodNearby from './screens/FoodNearby';
import CollectionDetail from './screens/CollectionDetail';
import DemoSaves from './screens/DemoSaves';
import FirstSaveSuccess from './screens/FirstSaveSuccess';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('onboarding');
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

  useEffect(() => {
    // Synchronous auth check before rendering (prevents login flash)
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    const lastScreen = localStorage.getItem('last_screen');

    if (storedToken && storedUser) {
      try {
        JSON.parse(storedUser); // Validate JSON before proceeding
        // Record app session for D7 retention analytics
        api.ping().catch(() => {});
        // Load saves for SavedList
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
        setCurrentScreen('onboarding');
      }
    } else {
      setCurrentScreen('onboarding');
    }
    setAuthChecked(true);
  }, []);

  // navigate(screen) or navigate(screen, payload)
  const navigate = (screen, nextPayload = null) => {
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
        background: '#FFFFFF'
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: '#1B3A2F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: 24, color: 'white', fontWeight: 600 }}>T</span>
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
    'save-detail': <SaveDetail {...props} />,
    'screenshot-summary': <ScreenshotSummary {...props} sessionId={payload?.sessionId} summary={payload?.summary} saveId={payload?.saveId} />,
    'collections': <Collections {...props} />,
    'collection-detail': <CollectionDetail {...props} />,
    'trip-collection': <TripCollection {...props} />,
    'shopping-wishlist': <ShoppingWishlist {...props} />,
    'food-nearby': <FoodNearby {...props} />,
    'search': <Search {...props} />,
    'notifications': <Notifications {...props} />,
    'profile': <Profile {...props} />,
  };

  // Screens that should show the bottom nav
  const hasBottomNav = ['home', 'home-empty', 'search', 'collections', 'profile', 'saved-list', 'save-detail', 'notifications'].includes(currentScreen);

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', background: 'var(--paper)' }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden'
      }}>
        {/* Screen Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {screenMap[currentScreen] || screenMap['login']}
        </div>

        {/* Bottom Navigation - shown on main screens */}
        {hasBottomNav && <BottomNav currentScreen={currentScreen} onNavigate={navigate} />}
      </div>
    </div>
  );
}

export default App;
