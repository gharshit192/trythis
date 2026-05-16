import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Pressable } from 'react-native';
import Chip from '../components/Chip';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function SaveDetailScreen({ route, navigation }) {
  const { item } = route.params;
  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: item.image }} style={styles.hero} />
      <View style={styles.content}>
        <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>📍 {item.location}</Text>
        <Text style={styles.meta}>💰 {item.price}</Text>
        <Text style={styles.source}>Saved from {item.source}</Text>
        <Text style={styles.section}>AI Tags</Text>
        <View style={styles.chips}>{item.tags.map((tag) => <Chip key={tag} label={tag} />)}</View>
        <Text style={styles.section}>Notes</Text>
        <View style={styles.note}><Text style={styles.noteText}>{item.notes}</Text></View>
        {['Add to Collection', 'Set Reminder', 'Find Similar', 'Open Source'].map((action) => (
          <Pressable key={action} style={styles.button}><Text style={styles.buttonText}>{action}</Text></Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', height: 330 },
  content: { padding: spacing.md },
  back: { fontSize: 16, fontWeight: '700', marginBottom: spacing.md, color: colors.accent },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  meta: { fontSize: 16, color: colors.text, marginTop: 8 },
  source: { color: colors.muted, marginTop: 8 },
  section: { fontSize: 18, fontWeight: '900', marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  note: { backgroundColor: colors.card, padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  noteText: { color: colors.text, lineHeight: 22 },
  button: { backgroundColor: colors.text, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#fff', fontWeight: '800' }
});
