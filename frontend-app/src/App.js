import { useState, useEffect } from 'react';
import './theme.css';
import api from './api';

import Login from './screens/Login';
import Signup from './screens/Signup';
import HomeEmpty from './screens/HomeEmpty';
import HomeFeed from './screens/HomeFeed';
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

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setCurrentScreen('home');
      // Record app session for D7 retention analytics
      api.post('/auth/ping').catch(() => {});
    }
  }, []);

  // navigate(screen) or navigate(screen, payload)
  const navigate = (screen, nextPayload = null) => {
    setPayload(nextPayload);
    setCurrentScreen(screen);
  };

  const props = { onNavigate: navigate, payload };

  const screenMap = {
    'login': <Login {...props} />,
    'signup': <Signup {...props} />,
    'onboarding-1': <Onboarding step={1} {...props} />,
    'onboarding-2': <Onboarding step={2} {...props} />,
    'onboarding-3': <Onboarding step={3} {...props} />,
    'notification-permission': <NotificationPermission {...props} />,
    'home-empty': <HomeEmpty {...props} />,
    'home': <HomeFeed {...props} />,
    'add-save': <AddSave {...props} />,
    'save-detail': <SaveDetail {...props} />,
    'screenshot-summary': <ScreenshotSummary {...props} />,
    'collections': <Collections {...props} />,
    'collection-detail': <CollectionDetail {...props} />,
    'trip-collection': <TripCollection {...props} />,
    'shopping-wishlist': <ShoppingWishlist {...props} />,
    'food-nearby': <FoodNearby {...props} />,
    'search': <Search {...props} />,
    'notifications': <Notifications {...props} />,
    'profile': <Profile {...props} />,
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', background: 'var(--paper)' }}>
      {screenMap[currentScreen] || screenMap['login']}
    </div>
  );
}

export default App;
