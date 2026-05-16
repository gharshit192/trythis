import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function QuickSaveScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Save</Text>
      <TextInput style={styles.input} placeholder="Paste Instagram, TikTok, YouTube or web link" placeholderTextColor={colors.muted} />
      <TextInput style={[styles.input, styles.notes]} placeholder="Add optional note" placeholderTextColor={colors.muted} multiline />
      <Pressable style={styles.button}><Text style={styles.buttonText}>Save & Extract</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, paddingTop: 80 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.lg, color: colors.text },
  input: { backgroundColor: colors.card, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, fontSize: 15 },
  notes: { minHeight: 120, textAlignVertical: 'top' },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '900' }
});
