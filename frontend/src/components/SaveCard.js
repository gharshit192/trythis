import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function SaveCard({ item, onPress, large = false }) {
  return (
    <Pressable style={[styles.card, large && styles.largeCard]} onPress={onPress}>
      <Image source={{ uri: item.image }} style={[styles.image, large && styles.largeImage]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.intent}>{item.intent}</Text>
          <Text style={styles.source}>{item.source}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.location} · {item.price}</Text>
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
    flex: 1
  },
  largeCard: { flex: 0 },
  image: { width: '100%', height: 140 },
  largeImage: { height: 220 },
  body: { padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  intent: { color: colors.accent, fontWeight: '800' },
  source: { color: colors.muted, fontSize: 12 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted, marginTop: 6 }
});
