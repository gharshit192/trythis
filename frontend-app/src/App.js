import { useState, useEffect } from 'react';
import './theme.css';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
      setCurrentScreen('home');
    }
  }, []);

  const navigate = (screen) => {
    setCurrentScreen(screen);
  };

  const screenMap = {
    'login': <Login onNavigate={navigate} />,
    'signup': <Signup onNavigate={navigate} />,
    'onboarding-1': <Onboarding step={1} onNavigate={navigate} />,
    'onboarding-2': <Onboarding step={2} onNavigate={navigate} />,
    'onboarding-3': <Onboarding step={3} onNavigate={navigate} />,
    'notification-permission': <NotificationPermission onNavigate={navigate} />,
    'home-empty': <HomeEmpty onNavigate={navigate} />,
    'home': <HomeFeed onNavigate={navigate} />,
    'add-save': <AddSave onNavigate={navigate} />,
    'save-detail': <SaveDetail onNavigate={navigate} />,
    'screenshot-summary': <ScreenshotSummary onNavigate={navigate} />,
    'collections': <Collections onNavigate={navigate} />,
    'collection-detail': <CollectionDetail onNavigate={navigate} />,
    'trip-collection': <TripCollection onNavigate={navigate} />,
    'shopping-wishlist': <ShoppingWishlist onNavigate={navigate} />,
    'food-nearby': <FoodNearby onNavigate={navigate} />,
    'search': <Search onNavigate={navigate} />,
    'notifications': <Notifications onNavigate={navigate} />,
    'profile': <Profile onNavigate={navigate} />,
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', background: 'var(--paper)' }}>
      {screenMap[currentScreen] || screenMap['login']}
    </div>
  );
}

export default App;
