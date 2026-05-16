import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  PREFERENCES: 'preferences',
};

export const setAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem(KEYS.AUTH_TOKEN, token);
  } catch (error) {
    console.error('❌ Error saving token:', error);
  }
};

export const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem(KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('❌ Error getting token:', error);
    return null;
  }
};

export const clearAuthToken = async () => {
  try {
    await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('❌ Error clearing token:', error);
  }
};

export const setUser = async (user) => {
  try {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('❌ Error saving user:', error);
  }
};

export const getUser = async () => {
  try {
    const user = await AsyncStorage.getItem(KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('❌ Error getting user:', error);
    return null;
  }
};

export const clearUser = async () => {
  try {
    await AsyncStorage.removeItem(KEYS.USER);
  } catch (error) {
    console.error('❌ Error clearing user:', error);
  }
};

export const logout = async () => {
  try {
    await Promise.all([clearAuthToken(), clearUser()]);
  } catch (error) {
    console.error('❌ Error logging out:', error);
  }
};
