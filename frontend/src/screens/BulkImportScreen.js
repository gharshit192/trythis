import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as api from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const parseUrls = (text) =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('http://') || s.startsWith('https://'));

export default function BulkImportScreen({ navigation }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null); // { success, failed }

  const urls = parseUrls(text);

  const handleImport = async () => {
    if (urls.length === 0) {
      Alert.alert('No URLs found', 'Paste at least one URL (one per line).');
      return;
    }
    setLoading(true);
    setResults(null);
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const url of urls) {
      try {
        await api.createSave({ url, source: 'url' });
        success++;
      } catch (err) {
        failed++;
        errors.push({ url, error: err.message });
      }
    }

    setResults({ success, failed, errors });
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.title}>Bulk Import</Text>
      <Text style={styles.subtitle}>Paste URLs below — one per line. Each will be saved and processed individually.</Text>

      <TextInput
        style={styles.textarea}
        placeholder={'https://instagram.com/reel/...\nhttps://zomato.com/...\nhttps://amazon.in/...'}
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={10}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      {urls.length > 0 && (
        <Text style={styles.count}>{urls.length} URL{urls.length > 1 ? 's' : ''} detected</Text>
      )}

      <Pressable
        style={[styles.button, (loading || urls.length === 0) && styles.buttonDisabled]}
        onPress={handleImport}
        disabled={loading || urls.length === 0}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Import {urls.length > 0 ? `${urls.length} saves` : 'saves'}</Text>
        }
      </Pressable>

      {results && (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>Import complete</Text>
          <View style={styles.resultsRow}>
            <View style={[styles.resultBox, { backgroundColor: '#d4edda' }]}>
              <Text style={styles.resultNum}>{results.success}</Text>
              <Text style={styles.resultLabel}>Saved</Text>
            </View>
            <View style={[styles.resultBox, { backgroundColor: results.failed > 0 ? '#f8d7da' : '#d4edda' }]}>
              <Text style={styles.resultNum}>{results.failed}</Text>
              <Text style={styles.resultLabel}>Failed</Text>
            </View>
          </View>
          {results.errors.length > 0 && (
            <View style={styles.errorList}>
              <Text style={styles.errorListTitle}>Failed URLs:</Text>
              {results.errors.map(({ url, error }) => (
                <Text key={url} style={styles.errorItem} numberOfLines={2}>
                  • {url.slice(0, 50)}… — {error}
                </Text>
              ))}
            </View>
          )}
          <Pressable
            style={styles.doneBtn}
            onPress={() => { navigation.navigate('Saves'); }}
          >
            <Text style={styles.doneBtnText}>View saved items →</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 60, paddingBottom: 100 },
  back: { marginBottom: spacing.lg },
  backText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.muted, marginBottom: spacing.lg, lineHeight: 20 },
  textarea: {
    backgroundColor: colors.card, borderRadius: 16, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, color: colors.text,
    fontSize: 14, minHeight: 180, textAlignVertical: 'top',
  },
  count: { color: colors.accent, fontWeight: '700', marginTop: spacing.sm, fontSize: 13 },
  button: {
    backgroundColor: colors.accent, padding: 16, borderRadius: 16,
    alignItems: 'center', marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  results: {
    marginTop: spacing.lg, backgroundColor: colors.card,
    borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  resultsTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  resultsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  resultBox: {
    flex: 1, borderRadius: 12, padding: spacing.md, alignItems: 'center',
  },
  resultNum: { fontSize: 28, fontWeight: '900', color: colors.text },
  resultLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  errorList: { marginTop: spacing.sm },
  errorListTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: spacing.xs },
  errorItem: { fontSize: 12, color: colors.coral, marginBottom: 4 },
  doneBtn: {
    backgroundColor: colors.accent, padding: 12, borderRadius: 12,
    alignItems: 'center', marginTop: spacing.md,
  },
  doneBtnText: { color: '#fff', fontWeight: '700' },
});
