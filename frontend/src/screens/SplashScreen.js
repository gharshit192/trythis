import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import * as storage from '../services/storage';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await storage.getAuthToken();

        setTimeout(() => {
          if (token) {
            navigation.replace('Tabs');
          } else {
            navigation.replace('SignupLogin');
          }
        }, 1200);
      } catch (error) {
        navigation.replace('SignupLogin');
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>TryThis</Text>
      <Text style={styles.tagline}>Save Now. Try Later.</Text>
      <ActivityIndicator
        size="large"
        color={colors.accent}
        style={{ marginTop: spacing.xl }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.accent,
  },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    marginTop: spacing.md,
  },
});
