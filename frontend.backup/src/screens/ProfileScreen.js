import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import * as api from '../services/api';
import { useAuth } from '../services/AuthContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [saveCount, setSaveCount] = useState(0);
  const [collectionCount, setCollectionCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [savesRes, colsRes] = await Promise.all([api.getSaves(), api.getCollections()]);
        setSaveCount(savesRes.data?.length || 0);
        setCollectionCount(colsRes.data?.length || 0);
      } catch (err) {
        console.warn('Profile counts failed:', err.message);
      }
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingTop: 80 }}>
      <Text style={styles.avatar}>👋</Text>
      <Text style={styles.title}>{user?.name || 'Your TryThis'}</Text>
      <Text style={styles.meta}>{user?.email || ''}</Text>
      <Text style={styles.meta}>{saveCount} saves · {collectionCount} collections</Text>
      <View style={styles.card}><Text style={styles.cardText}>Settings</Text></View>
      <View style={styles.card}><Text style={styles.cardText}>Connected sources</Text></View>
      <View style={styles.card}><Text style={styles.cardText}>Notifications</Text></View>
      <Pressable style={[styles.card, styles.logoutCard]} onPress={handleLogout}>
        <Text style={[styles.cardText, { color: colors.coral }]}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  avatar: { fontSize: 52 },
  title: { fontSize: 30, fontWeight: '900', marginTop: spacing.md, color: colors.text },
  meta: { color: colors.muted },
  card: { backgroundColor: colors.card, padding: spacing.md, borderRadius: 18, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  logoutCard: { marginTop: spacing.lg },
  cardText: { fontWeight: '800', color: colors.text },
});
