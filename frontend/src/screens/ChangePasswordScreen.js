import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import * as api from '../services/api';

export default function ChangePasswordScreen({ navigation }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!current) { Alert.alert('Error', 'Enter your current password.'); return false; }
    if (next.length < 8) { Alert.alert('Error', 'New password must be at least 8 characters.'); return false; }
    if (!/[A-Z]/.test(next)) { Alert.alert('Error', 'New password must contain an uppercase letter.'); return false; }
    if (!/[0-9]/.test(next)) { Alert.alert('Error', 'New password must contain a number.'); return false; }
    if (next !== confirm) { Alert.alert('Error', 'New passwords do not match.'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.changePassword(current, next);
      Alert.alert('Done', 'Password changed successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Failed', err.message || 'Could not change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Change password</Text>

      <Text style={styles.label}>Current password</Text>
      <TextInput
        style={styles.input}
        placeholder="Current password"
        placeholderTextColor={colors.muted}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        editable={!loading}
        autoFocus
      />

      <Text style={styles.label}>New password</Text>
      <TextInput
        style={styles.input}
        placeholder="Min 8 chars, 1 uppercase, 1 number"
        placeholderTextColor={colors.muted}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        editable={!loading}
      />

      <Text style={styles.label}>Confirm new password</Text>
      <TextInput
        style={styles.input}
        placeholder="Repeat new password"
        placeholderTextColor={colors.muted}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        editable={!loading}
      />

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save new password</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60 },
  back: { marginBottom: spacing.lg },
  backText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: spacing.xl },
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
