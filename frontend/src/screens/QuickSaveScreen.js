import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useUploadJobs } from '../hooks/useUploadJobs';
import UploadJobsPanel from '../components/UploadJobsPanel';

const detectSourceType = (url) => {
  if (!url) return 'screenshot';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'url';
};

export default function QuickSaveScreen({ navigation }) {
  const [mode, setMode] = useState(null); // null | 'link' | 'photos'
  const { jobs, submitLink, submitScreenshot, dismissJob } = useUploadJobs();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quick Save</Text>
      {mode === null && <ModePicker onPick={setMode} />}
      {mode === 'link' && (
        <LinkFlow
          onBack={() => setMode(null)}
          submitLink={submitLink}
        />
      )}
      {mode === 'photos' && (
        <PhotosFlow
          onBack={() => setMode(null)}
          submitScreenshot={submitScreenshot}
        />
      )}

      {/* Upload jobs panel */}
      {jobs.length > 0 && (
        <UploadJobsPanel jobs={jobs} onDismiss={dismissJob} />
      )}
    </ScrollView>
  );
}

function ModePicker({ onPick }) {
  return (
    <>
      <Text style={styles.subtitle}>What are you saving?</Text>
      <Pressable style={styles.tile} onPress={() => onPick('link')}>
        <View style={[styles.tileIcon, { backgroundColor: colors.accent }]}>
          <Text style={styles.tileIconText}>🔗</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>Paste a link</Text>
          <Text style={styles.tileSub}>Instagram, YouTube, TikTok, web</Text>
        </View>
      </Pressable>
      <Pressable style={styles.tile} onPress={() => onPick('photos')}>
        <View style={[styles.tileIcon, { backgroundColor: colors.green || '#2ECC71' }]}>
          <Text style={styles.tileIconText}>📷</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tileTitle}>Upload photos</Text>
          <Text style={styles.tileSub}>Screenshots, menus, signs — OCR + AI</Text>
        </View>
      </Pressable>
    </>
  );
}

function LinkFlow({ onBack, submitLink }) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!url.trim()) {
      return Alert.alert('Paste a link', 'Enter a URL to save.');
    }

    setSubmitting(true);
    try {
      await submitLink(url.trim());
      setUrl(''); // Clear input
      Alert.alert('Submitted', 'Your link is being processed. You can continue uploading while you wait.');
    } catch (err) {
      Alert.alert('Submit failed', err.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <FlowHeader title="Paste a link" onBack={onBack} />
      <TextInput
        style={styles.input}
        placeholder="Paste IG, TikTok, YouTube or web link"
        placeholderTextColor={colors.muted}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        editable={!submitting}
      />

      <Text style={styles.helpText}>
        ℹ️ Your link will be processed in the background. You can paste more links while waiting.
      </Text>

      <Pressable
        style={[styles.button, submitting && styles.disabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Link</Text>
        )}
      </Pressable>
    </>
  );
}

function PhotosFlow({ onBack, submitScreenshot }) {
  const [assets, setAssets] = useState([]);
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
      // Submit each image as a separate job
      for (const asset of assets) {
        const file = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `photo-${Date.now()}.jpg`,
        };
        await submitScreenshot(file);
      }
      setAssets([]); // Clear selection
      Alert.alert('Submitted', `${assets.length} screenshot${assets.length === 1 ? '' : 's'} queued for processing.`);
    } catch (err) {
      Alert.alert('Submit failed', err.message || 'Try again.');
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
          {assets.length === 0
            ? 'Tap to pick images'
            : `${assets.length} image${assets.length === 1 ? '' : 's'} selected — tap to add more`}
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

      <Text style={styles.helpText}>
        ℹ️ Screenshots are processed in the background. You can upload more while waiting.
      </Text>

      <Pressable
        style={[styles.button, (uploading || !assets.length) && styles.disabled]}
        onPress={handleUpload}
        disabled={uploading || !assets.length}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{`Submit (${assets.length})`}</Text>
        )}
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
  content: { padding: spacing.md, paddingTop: 80, paddingBottom: 100 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.lg, color: colors.text },
  subtitle: { color: colors.muted, marginBottom: spacing.md },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileIconText: { fontSize: 22 },
  tileTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  flowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  flowHeaderTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
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
  helpText: { fontSize: 12, color: colors.muted, marginBottom: spacing.md, lineHeight: 18 },
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  thumbCell: { position: 'relative', width: '23%', aspectRatio: 1 },
  thumb: { width: '100%', height: '100%', borderRadius: 8 },
  thumbX: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { backgroundColor: colors.accent, padding: 16, borderRadius: 16, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
