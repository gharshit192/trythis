import React, { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SaveCard from '../components/SaveCard';
import * as api from '../services/api';
import { adaptSaves } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function SavesScreen({ navigation }) {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getSaves();
      setSaves(adaptSaves(res.data));
    } catch (err) {
      setError(err.message || 'Failed to load saves');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.title}>All Saves</Text>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : saves.length === 0 ? (
        <Text style={styles.empty}>No saves yet.</Text>
      ) : (
        saves.map((item) => (
          <SaveCard key={item.id} item={item} onPress={() => navigation.navigate('SaveDetail', { item })} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.md, color: colors.text },
  error: { color: colors.coral, marginTop: spacing.lg, textAlign: 'center' },
  empty: { color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
});
