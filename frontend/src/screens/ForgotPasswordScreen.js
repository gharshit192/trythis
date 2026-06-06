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
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!email.includes('@')) { Alert.alert('Error', 'Enter a valid email.'); return false; }
    if (newPassword.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters.'); return false; }
    if (!/[A-Z]/.test(newPassword)) { Alert.alert('Error', 'Password must contain an uppercase letter.'); return false; }
    if (!/[0-9]/.test(newPassword)) { Alert.alert('Error', 'Password must contain a number.'); return false; }
    if (newPassword !== confirm) { Alert.alert('Error', 'Passwords do not match.'); return false; }
    return true;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Step 1: generate OTP — returned directly since no email service
      const res = await api.forgotPassword(email.toLowerCase().trim());
      const otp = res?.otp;
      if (!otp) {
        Alert.alert('Not found', 'No account found for that email.');
        return;
      }
      // Step 2: immediately use the OTP to set the new password
      await api.resetPassword(email.toLowerCase().trim(), otp, newPassword);
      Alert.alert('Done', 'Your password has been reset. Please log in.', [
        { text: 'Log in', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Failed', err.message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>Enter your email and choose a new password.</Text>

      <Text style={styles.label}>Email</Text>
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

      <Text style={styles.label}>New password</Text>
      <TextInput
        style={styles.input}
        placeholder="Min 8 chars, 1 uppercase, 1 number"
        placeholderTextColor={colors.muted}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        editable={!loading}
      />

      <Text style={styles.label}>Confirm password</Text>
      <TextInput
        style={styles.input}
        placeholder="Repeat new password"
        placeholderTextColor={colors.muted}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        editable={!loading}
      />

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleReset} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Set new password</Text>}
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
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
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
});
