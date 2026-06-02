import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function CollectionCard({ collection, onPress }) {
  const firstImage = collection.images[0];
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: firstImage }} style={styles.image} />
      <View style={styles.body}>
        <Text style={styles.title}>{collection.name}</Text>
        <Text style={styles.meta}>{collection.count} saves</Text>
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
  image: { width: '100%', height: 150 },
  body: { padding: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { marginTop: 6, color: colors.muted },
});
