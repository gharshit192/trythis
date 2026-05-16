import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import CollectionCard from '../components/CollectionCard';
import { collections } from '../data/mockData';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function CollectionsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Collections</Text>
        <Text style={styles.plus}>＋</Text>
      </View>
      {collections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  plus: { fontSize: 30, color: colors.accent }
});
