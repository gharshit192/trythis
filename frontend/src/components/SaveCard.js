import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import SmartImage from './SmartImage';
import { colors, CATEGORY_META } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function SaveCard({ item, onPress, large = false }) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.general;
  const isProcessing = item.processingStatus === 'processing';
  const subtitle = item.location && item.location !== '—'
    ? item.location
    : item.raw?.aiAnalysis?.summary?.slice(0, 80) || item.description?.slice(0, 80) || '';

  return (
    <Pressable style={[styles.card, large && styles.largeCard]} onPress={onPress}>
      <View style={[styles.imageWrap, large && styles.largeImageWrap]}>
        <SmartImage
          saveId={item._id || item.id}
          source={{ uri: item.image }}
          style={styles.image}
        />
        {isProcessing && (
          <View style={styles.processingBadge}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
        <View style={[styles.catBadge, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
          <Text style={styles.catEmoji}>{meta.emoji}</Text>
          <Text style={[styles.catLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.source}>{item.source}</Text>
          {item.intentStatus === 'tried' && <Text style={styles.tried}>✓ Tried</Text>}
        </View>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {subtitle ? <Text style={styles.meta} numberOfLines={2}>{subtitle}</Text> : null}
        {item.price ? <Text style={styles.price}>{item.price}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  largeCard: {},
  imageWrap: { position: 'relative', height: 140 },
  largeImageWrap: { height: 220 },
  image: { width: '100%', height: '100%' },
  processingBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 6,
  },
  catBadge: {
    position: 'absolute', bottom: 8, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  catEmoji: { fontSize: 11 },
  catLabel: { fontSize: 10, fontWeight: '700' },
  body: { padding: spacing.md, paddingTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  source: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  tried: { fontSize: 11, color: colors.green, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 22 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  price: { color: colors.accent, fontWeight: '700', marginTop: 4, fontSize: 13 },
});
