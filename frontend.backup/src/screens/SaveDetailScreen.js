import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Linking, Image } from 'react-native';
import Chip from '../components/Chip';
import SmartImage from '../components/SmartImage';
import * as api from '../services/api';
import { adaptSave } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const ACTIONS = ['Add to Collection', 'Set Reminder', 'Find Similar', 'Open Source'];

export default function SaveDetailScreen({ route, navigation }) {
  const { item } = route.params;
  const [save, setSave] = useState(item);
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState([]);

  useEffect(() => {
    const refresh = async () => {
      if (!save?._id) return;
      setLoading(true);
      try {
        const res = await api.getSaveDetail(save._id);
        if (res.status === 'success') setSave(adaptSave(res.data));
        const recRes = await api.getRecommendations(save._id);
        if (recRes.status === 'success') setRecs(recRes.data || []);
      } catch (err) {
        console.warn('Detail refresh failed:', err.message);
      } finally {
        setLoading(false);
      }
    };
    refresh();
  }, [save?._id]);

  const handleAction = async (action) => {
    if (action === 'Open Source' && save?.url) {
      Linking.openURL(save.url);
    } else if (action === 'Find Similar') {
      Alert.alert('Similar', `${recs.length} similar saves found.`);
    } else {
      Alert.alert(action, 'Coming soon.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete save', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSave(save._id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Failed', err.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <SmartImage
        saveId={save?._id}
        source={{ uri: save?.image }}
        style={styles.hero}
      />
      <View style={styles.content}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{save?.title}</Text>
        {save?.location ? <Text style={styles.meta}>📍 {save.location}</Text> : null}
        {save?.price ? <Text style={styles.meta}>💰 {save.price}</Text> : null}
        <Text style={styles.source}>Saved from {save?.source}</Text>

        {(save?.tags?.length || 0) > 0 && (
          <>
            <Text style={styles.section}>Tags</Text>
            <View style={styles.chips}>
              {save.tags.map((tag) => <Chip key={tag} label={tag} />)}
            </View>
          </>
        )}

        {save?.notes ? (
          <>
            <Text style={styles.section}>Notes</Text>
            <View style={styles.note}><Text style={styles.noteText}>{save.notes}</Text></View>
          </>
        ) : null}

        {save?.raw?.screenshots?.length > 0 && (
          <>
            <Text style={styles.section}>📷 Screenshots ({save.raw.screenshots.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              {[...save.raw.screenshots].sort((a, b) => (a.order || 0) - (b.order || 0)).map((sc, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    if (sc.url) Linking.openURL(sc.url);
                    else Alert.alert('Purged', 'Original purged after 2 working days. Thumbnail + OCR preserved.');
                  }}
                  style={{ marginRight: 6 }}
                >
                  <Image source={{ uri: sc.thumbnailUrl }} style={{ width: 88, height: 88, borderRadius: 8, opacity: sc.url ? 1 : 0.65 }} />
                  {!sc.url && <Text style={styles.purgedBadge}>purged</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {save?.raw?.aiAnalysis?.structuredData?.recipe?.isRecipe && (
          <>
            <Text style={styles.section}>🍳 {save.raw.aiAnalysis.structuredData.recipe.title || 'Recipe'}</Text>
            {save.raw.aiAnalysis.structuredData.recipe.cookingTime ? (
              <Text style={styles.meta}>⏱ {save.raw.aiAnalysis.structuredData.recipe.cookingTime}{save.raw.aiAnalysis.structuredData.recipe.servings ? `  ·  🍽 ${save.raw.aiAnalysis.structuredData.recipe.servings}` : ''}</Text>
            ) : null}
            {save.raw.aiAnalysis.structuredData.recipe.ingredients?.length > 0 && (
              <View style={styles.note}>
                <Text style={styles.noteHeader}>Ingredients</Text>
                {save.raw.aiAnalysis.structuredData.recipe.ingredients.map((i, idx) => (
                  <Text key={idx} style={styles.noteText}>• {i}</Text>
                ))}
              </View>
            )}
            {save.raw.aiAnalysis.structuredData.recipe.steps?.length > 0 && (
              <View style={styles.note}>
                <Text style={styles.noteHeader}>Steps</Text>
                {save.raw.aiAnalysis.structuredData.recipe.steps.map((s, idx) => (
                  <Text key={idx} style={styles.noteText}>{idx + 1}. {s}</Text>
                ))}
              </View>
            )}
          </>
        )}

        {save?.raw?.tags?.length > 0 && (
          <>
            <Text style={styles.section}>Tags</Text>
            <View style={styles.chips}>
              {save.raw.tags.map((t) => <Chip key={t} label={t} />)}
            </View>
          </>
        )}

        {save?.raw?.aiAnalysis?.transcription?.translation && (
          <>
            <Text style={styles.section}>📝 Transcript (English)</Text>
            <View style={styles.note}>
              <Text style={styles.noteText}>{save.raw.aiAnalysis.transcription.translation}</Text>
            </View>
          </>
        )}
        {save?.raw?.aiAnalysis?.transcription?.text && save?.raw?.aiAnalysis?.transcription?.detectedLanguage && save.raw.aiAnalysis.transcription.detectedLanguage !== 'en' && (
          <>
            <Text style={styles.section}>📝 Transcript ({save.raw.aiAnalysis.transcription.detectedLanguage})</Text>
            <View style={styles.note}>
              <Text style={styles.noteText}>{save.raw.aiAnalysis.transcription.text}</Text>
            </View>
          </>
        )}

        {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />}

        {ACTIONS.map((action) => (
          <Pressable key={action} style={styles.button} onPress={() => handleAction(action)}>
            <Text style={styles.buttonText}>{action}</Text>
          </Pressable>
        ))}

        <Pressable style={[styles.button, styles.delete]} onPress={handleDelete}>
          <Text style={styles.buttonText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', height: 330 },
  heroPlaceholder: { backgroundColor: colors.card },
  content: { padding: spacing.md },
  back: { fontSize: 16, fontWeight: '700', marginBottom: spacing.md, color: colors.accent },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  meta: { fontSize: 16, color: colors.text, marginTop: 8 },
  source: { color: colors.muted, marginTop: 8 },
  section: { fontSize: 18, fontWeight: '900', marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  note: { backgroundColor: colors.card, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  noteHeader: { fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  noteText: { color: colors.text, lineHeight: 22 },
  button: { backgroundColor: colors.text, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: spacing.sm },
  delete: { backgroundColor: colors.coral || '#e74c3c', marginTop: spacing.lg },
  buttonText: { color: '#fff', fontWeight: '800' },
  purgedBadge: { position: 'absolute', bottom: 4, left: 4, color: '#fff', fontSize: 9, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, borderRadius: 3 },
});
