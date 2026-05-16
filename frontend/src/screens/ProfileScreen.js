import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.avatar}>👋</Text>
      <Text style={styles.title}>Your TryThis</Text>
      <Text style={styles.meta}>120 saves · 8 collections</Text>
      <View style={styles.card}><Text style={styles.cardText}>Settings</Text></View>
      <View style={styles.card}><Text style={styles.cardText}>Connected sources</Text></View>
      <View style={styles.card}><Text style={styles.cardText}>Notifications</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, paddingTop: 80 },
  avatar: { fontSize: 52 },
  title: { fontSize: 30, fontWeight: '900', marginTop: spacing.md, color: colors.text },
  meta: { color: colors.muted, marginBottom: spacing.lg },
  card: { backgroundColor: colors.card, padding: spacing.md, borderRadius: 18, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardText: { fontWeight: '800', color: colors.text }
});
