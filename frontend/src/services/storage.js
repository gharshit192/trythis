import * as SecureStore from 'expo-secure-store';

const KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  PREFERENCES: 'preferences',
};

export const setAuthToken = async (token) => {
  try {
    await SecureStore.setItemAsync(KEYS.AUTH_TOKEN, token);
  } catch (error) {
    console.error('❌ Error saving token:', error);
  }
};

export const getAuthToken = async () => {
  try {
    return await SecureStore.getItemAsync(KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('❌ Error getting token:', error);
    return null;
  }
};

export const clearAuthToken = async () => {
  try {
    await SecureStore.deleteItemAsync(KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('❌ Error clearing token:', error);
  }
};

export const setUser = async (user) => {
  try {
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('❌ Error saving user:', error);
  }
};

export const getUser = async () => {
  try {
    const user = await SecureStore.getItemAsync(KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('❌ Error getting user:', error);
    return null;
  }
};

export const clearUser = async () => {
  try {
    await SecureStore.deleteItemAsync(KEYS.USER);
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
