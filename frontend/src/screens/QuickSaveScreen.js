import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const detectSourceType = (url) => {
  if (!url) return 'screenshot';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'url';
};

export default function QuickSaveScreen({ navigation }) {
  const [mode, setMode] = useState(null); // null | 'link' | 'photos'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quick Save</Text>
      {mode === null && <ModePicker onPick={setMode} />}
      {mode === 'link' && <LinkFlow onBack={() => setMode(null)} onDone={() => { setMode(null); navigation?.navigate?.('Saves'); }} />}
      {mode === 'photos' && <PhotosFlow onBack={() => setMode(null)} onDone={() => { setMode(null); navigation?.navigate?.('Saves'); }} />}
    </ScrollView>
  );
}

function ModePicker({ onPick }) {
  return (
    <>
      <Text style={styles.subtitle}>What are you saving?</Text>
      <Pressable style={styles.tile} onPress={() => onPick('link')}>
        <View style={[styles.tileIcon, { backgroundColor: colors.accent }]}><Text style={styles.tileIconText}>🔗</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>Paste a link</Text>
          <Text style={styles.tileSub}>Instagram, YouTube, TikTok, web</Text>
        </View>
      </Pressable>
      <Pressable style={styles.tile} onPress={() => onPick('photos')}>
        <View style={[styles.tileIcon, { backgroundColor: colors.green || '#2ECC71' }]}><Text style={styles.tileIconText}>📷</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>Upload photos</Text>
          <Text style={styles.tileSub}>Screenshots, menus, signs — OCR + AI</Text>
        </View>
      </Pressable>
    </>
  );
}

function LinkFlow({ onBack, onDone }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!url.trim() && !title.trim()) return Alert.alert('Add a link or title', 'You need at least one to save.');
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
        onDone();
      }
    } catch (err) {
      Alert.alert('Save failed', err.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FlowHeader title="Paste a link" onBack={onBack} />
      <TextInput style={styles.input} placeholder="Paste IG, TikTok, YouTube or web link" placeholderTextColor={colors.muted} value={url} onChangeText={setUrl} autoCapitalize="none" editable={!saving} />
      <TextInput style={styles.input} placeholder="Title (optional if link supplied)" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} editable={!saving} />
      <TextInput style={[styles.input, styles.notes]} placeholder="Add optional note" placeholderTextColor={colors.muted} value={notes} onChangeText={setNotes} editable={!saving} multiline />
      <Pressable style={[styles.button, saving && styles.disabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save & Extract</Text>}
      </Pressable>
    </>
  );
}

function PhotosFlow({ onBack, onDone }) {
  const [assets, setAssets] = useState([]); // ImagePicker.ImagePickerAsset[]
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission denied', 'Allow photo access in Settings.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10 - assets.length,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    setAssets((prev) => [...prev, ...result.assets].slice(0, 10));
  };

  const removeAt = (i) => setAssets((prev) => prev.filter((_, idx) => idx !== i));

  const handleUpload = async () => {
    if (!assets.length) return Alert.alert('Pick at least one image');
    setUploading(true);
    try {
      const res = await api.uploadScreenshots({
        pickerResults: assets,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (res.status === 'success') {
        Alert.alert('Uploaded!', `${res.data.screenshots.length} image${res.data.screenshots.length === 1 ? '' : 's'} processed.`);
        onDone();
      }
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <FlowHeader title="Upload photos" onBack={onBack} />
      <Pressable style={styles.dropZone} onPress={pickImages} disabled={uploading}>
        <Text style={{ fontSize: 28 }}>📁</Text>
        <Text style={{ marginTop: 6, color: colors.text }}>
          {assets.length === 0 ? 'Tap to pick images' : `${assets.length} image${assets.length === 1 ? '' : 's'} selected — tap to add more`}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 12, color: colors.muted }}>up to 10 files · 10 MB each</Text>
      </Pressable>

      {assets.length > 0 && (
        <View style={styles.thumbGrid}>
          {assets.map((a, i) => (
            <View key={a.uri} style={styles.thumbCell}>
              <Image source={{ uri: a.uri }} style={styles.thumb} />
              <Pressable style={styles.thumbX} onPress={() => removeAt(i)} disabled={uploading}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <TextInput style={styles.input} placeholder="Title (optional)" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} editable={!uploading} />
      <TextInput style={[styles.input, styles.notes]} placeholder="Notes (optional)" placeholderTextColor={colors.muted} value={notes} onChangeText={setNotes} editable={!uploading} multiline />

      <Text style={styles.purgeNote}>📅 Originals auto-purge after 2 working days. Thumbnails kept forever.</Text>

      <Pressable style={[styles.button, (uploading || !assets.length) && styles.disabled]} onPress={handleUpload} disabled={uploading || !assets.length}>
        {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{`Extract & save${assets.length ? ` (${assets.length})` : ''}`}</Text>}
      </Pressable>
    </>
  );
}

function FlowHeader({ title, onBack }) {
  return (
    <View style={styles.flowHeader}>
      <Pressable onPress={onBack} hitSlop={10}>
        <Text style={{ fontSize: 18, color: colors.accent }}>← Back</Text>
      </Pressable>
      <Text style={styles.flowHeaderTitle}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 80 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.lg, color: colors.text },
  subtitle: { color: colors.muted, marginBottom: spacing.md },
  tile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  tileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileIconText: { fontSize: 22 },
  tileTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  flowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  flowHeaderTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  input: { backgroundColor: colors.card, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, fontSize: 15, color: colors.text },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '900' },
  dropZone: { padding: spacing.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 16, alignItems: 'center', marginBottom: spacing.md, backgroundColor: colors.card },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  thumbCell: { width: 72, height: 72, position: 'relative' },
  thumb: { width: '100%', height: '100%', borderRadius: 8 },
  thumbX: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  purgeNote: { fontSize: 11, color: colors.muted, marginBottom: spacing.sm },
});
