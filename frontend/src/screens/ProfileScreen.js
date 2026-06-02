import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import * as api from '../services/api';
import { useAuth } from '../services/AuthContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const MenuItem = ({ label, sub, onPress, danger }) => (
  <Pressable style={styles.card} onPress={onPress}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.cardText, danger && { color: colors.coral }]}>{label}</Text>
      {sub && <Text style={styles.cardSub}>{sub}</Text>}
    </View>
    {onPress && <Text style={styles.chevron}>›</Text>}
  </Pressable>
);

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [saveCount, setSaveCount] = useState(null);
  const [collectionCount, setCollectionCount] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [savesRes, colsRes] = await Promise.all([api.getSaves(), api.getCollections()]);
        setSaveCount(Array.isArray(savesRes.data) ? savesRes.data.length : 0);
        setCollectionCount(Array.isArray(colsRes.data) ? colsRes.data.length : 0);
      } catch {}
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleChangePassword = () => {
    Alert.alert('Change Password', 'Enter your new password in the next screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue', onPress: async () => {
          Alert.prompt?.('New Password', '', async (pwd) => {
            if (!pwd?.trim()) return;
            try {
              await api.changePassword(undefined, pwd.trim());
              Alert.alert('Done', 'Password changed.');
            } catch (err) {
              Alert.alert('Failed', err.message);
            }
          }, 'secure-text');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.avatar}>👋</Text>
      <Text style={styles.name}>{user?.name || 'Your TryThis'}</Text>
      <Text style={styles.email}>{user?.email || ''}</Text>

      {(saveCount !== null) && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{saveCount}</Text>
            <Text style={styles.statLabel}>saves</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{collectionCount}</Text>
            <Text style={styles.statLabel}>collections</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>Account</Text>
      <MenuItem label="Change password" sub="Update your password" onPress={handleChangePassword} />
      <MenuItem
        label="Notifications"
        sub="View all notifications"
        onPress={() => navigation.navigate('Notifications')}
      />
      <MenuItem
        label="All Saves"
        sub="Browse your full library"
        onPress={() => navigation.navigate('Saves')}
      />

      <Text style={styles.sectionLabel}>More</Text>
      <MenuItem label="Log out" danger onPress={handleLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 80, paddingBottom: 100 },
  avatar: { fontSize: 52 },
  name: { fontSize: 30, fontWeight: '900', marginTop: spacing.sm, color: colors.text },
  email: { color: colors.muted, marginTop: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg, backgroundColor: colors.card, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: colors.muted, marginTop: spacing.md, marginBottom: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.md, borderRadius: 18, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  cardText: { fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.muted },
});
