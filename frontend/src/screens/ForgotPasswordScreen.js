import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import * as api from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email.toLowerCase().trim());
      setSent(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          If <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text> is registered, we sent a 6-digit reset code. It expires in 15 minutes.
        </Text>
        <Pressable style={styles.button} onPress={() => navigation.navigate('ResetPassword', { email })}>
          <Text style={styles.buttonText}>Enter reset code</Text>
        </Pressable>
        <Pressable onPress={handleSend} disabled={loading} style={styles.resend}>
          <Text style={styles.resendText}>{loading ? 'Sending…' : 'Resend code'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Forgot password?</Text>
      <Text style={styles.subtitle}>Enter your email and we'll send a reset code.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus
        editable={!loading}
      />

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSend} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset code</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60 },
  back: { marginBottom: spacing.lg },
  backText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: spacing.sm },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: spacing.xl, lineHeight: 22 },
  input: {
    backgroundColor: colors.card, borderRadius: 18, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
    fontSize: 15, color: colors.text,
  },
  button: {
    backgroundColor: colors.accent, padding: 16, borderRadius: 16,
    alignItems: 'center', marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  resend: { alignItems: 'center', marginTop: spacing.lg },
  resendText: { color: colors.accent, fontWeight: '700' },
});
