import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';

// Screens
import SplashScreen from '../screens/SplashScreen';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import QuickSaveScreen from '../screens/QuickSaveScreen';
import SavesScreen from '../screens/SavesScreen';
import CollectionsScreen from '../screens/CollectionsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SaveDetailScreen from '../screens/SaveDetailScreen';

import { colors } from '../theme/colors';
import * as storage from '../services/storage';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: false,
      }}
    >
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { height: 68, paddingBottom: 10, paddingTop: 8, backgroundColor: colors.card }
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: () => '🏠' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: () => '🔍' }} />
      <Tab.Screen name="Save" component={QuickSaveScreen} options={{ tabBarIcon: () => '＋' }} />
      <Tab.Screen name="Saves" component={SavesScreen} options={{ tabBarIcon: () => '📌' }} />
      <Tab.Screen name="Me" component={ProfileScreen} options={{ tabBarIcon: () => '👤' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await storage.getAuthToken();
        setIsSignedIn(!!token);
      } catch (error) {
        console.error('❌ Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: false,
      }}
    >
      {!isSignedIn ? (
        <Stack.Screen
          name="SignupLogin"
          component={AuthStack}
          options={{ animationEnabled: false }}
        />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="SaveDetail" component={SaveDetailScreen} />
          <Stack.Screen name="Collections" component={CollectionsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
