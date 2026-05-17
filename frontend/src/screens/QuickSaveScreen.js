import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as api from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const detectSourceType = (url) => {
  if (!url) return 'screenshot';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'url';
};

export default function QuickSaveScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!url.trim() && !title.trim()) {
      Alert.alert('Add a link or a title', 'You need at least one to save.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || undefined,
        url: url.trim() || undefined,
        notes: notes.trim() || undefined,
        sourceType: detectSourceType(url.trim()),
      };
      const res = await api.createSave(payload);
      if (res.status === 'success') {
        Alert.alert('Saved!', res.data.title || 'Added to your saves.');
        setUrl(''); setTitle(''); setNotes('');
        navigation?.navigate?.('Saves');
      }
    } catch (err) {
      Alert.alert('Save failed', err.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quick Save</Text>
      <TextInput
        style={styles.input}
        placeholder="Paste Instagram, TikTok, YouTube or web link"
        placeholderTextColor={colors.muted}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        editable={!saving}
      />
      <TextInput
        style={styles.input}
        placeholder="Title (optional if link supplied)"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
        editable={!saving}
      />
      <TextInput
        style={[styles.input, styles.notes]}
        placeholder="Add optional note"
        placeholderTextColor={colors.muted}
        value={notes}
        onChangeText={setNotes}
        editable={!saving}
        multiline
      />
      <Pressable style={[styles.button, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save & Extract</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 80 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.lg, color: colors.text },
  input: { backgroundColor: colors.card, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, fontSize: 15, color: colors.text },
  notes: { minHeight: 120, textAlignVertical: 'top' },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '900' },
});
