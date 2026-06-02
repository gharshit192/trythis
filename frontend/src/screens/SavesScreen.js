import React, { useCallback, useState } from 'react';
import { FlatList, Text, StyleSheet, ActivityIndicator, RefreshControl, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Chip from '../components/Chip';
import SaveCard from '../components/SaveCard';
import * as api from '../services/api';
import { adaptSaves } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const SORT_OPTIONS = [
  { label: 'Recent',    value: 'recent' },
  { label: '✓ Tried',  value: 'tried' },
  { label: '⏳ Saved',  value: 'saved' },
  { label: '📋 Planned', value: 'planned' },
];

export default function SavesScreen({ navigation }) {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeSort, setActiveSort] = useState('recent');

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

  const filtered = activeSort === 'recent'
    ? saves
    : saves.filter((s) => s.intentStatus === activeSort);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>All Saves</Text>
          <View style={styles.chips}>
            {SORT_OPTIONS.map((s) => (
              <Chip key={s.value} label={s.label} active={activeSort === s.value} onPress={() => setActiveSort(s.value)} />
            ))}
          </View>
          {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />}
          {error && <Text style={styles.error}>{error}</Text>}
          {!loading && filtered.length === 0 && (
            <Text style={styles.empty}>
              {activeSort === 'recent' ? 'No saves yet.' : `No ${activeSort} saves.`}
            </Text>
          )}
          {!loading && filtered.length > 0 && (
            <Text style={styles.count}>{filtered.length} saves</Text>
          )}
        </>
      }
      renderItem={({ item }) => (
        <SaveCard item={item} onPress={() => navigation.navigate('SaveDetail', { item })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56, paddingBottom: 100 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.sm, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  count: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  error: { color: colors.coral, marginTop: spacing.lg, textAlign: 'center' },
  empty: { color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
});
