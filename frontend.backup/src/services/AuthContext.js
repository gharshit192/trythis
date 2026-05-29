import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as storage from './storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(null);
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([storage.getAuthToken(), storage.getUser()]);
        setTokenState(t);
        setUserState(u);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (t, u) => {
    await storage.setAuthToken(t);
    if (u) await storage.setUser(u);
    setTokenState(t);
    setUserState(u || null);
  }, []);

  const signOut = useCallback(async () => {
    await storage.logout();
    setTokenState(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signOut, isSignedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
