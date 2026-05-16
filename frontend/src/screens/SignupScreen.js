import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import * as api from '../services/api';
import * as storage from '../services/storage';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.includes('@')) {
      newErrors.email = 'Valid email required';
    }

    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await api.signup({
        email: email.toLowerCase(),
        password,
        name,
      });

      if (response.status === 'success') {
        await storage.setAuthToken(response.data.token);
        await storage.setUser(response.data.user);

        console.log('✅ Signup successful:', email);
        navigation.replace('Tabs');
      }
    } catch (error) {
      console.error('❌ Signup error:', error);
      Alert.alert(
        'Signup Failed',
        error.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>TryThis</Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Sign up to start saving things you want to try
        </Text>
      </View>

      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        placeholder="Full Name"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        editable={!loading}
      />
      {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      <TextInput
        style={[styles.input, errors.password && styles.inputError]}
        placeholder="Password (min 8 characters)"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        secureTextEntry
      />
      {errors.password && (
        <Text style={styles.errorText}>{errors.password}</Text>
      )}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} disabled={loading}>
          <Text style={styles.link}>Login</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 80,
  },
  header: {
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.coral,
  },
  errorText: {
    color: colors.coral,
    fontSize: 12,
    marginTop: -8,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.muted,
  },
  link: {
    color: colors.accent,
    fontWeight: '700',
  },
});
