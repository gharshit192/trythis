import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SearchBar from '../components/SearchBar';
import Chip from '../components/Chip';
import SaveCard from '../components/SaveCard';
import * as api from '../services/api';
import { adaptSaves } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const CHIPS = [
  { label: 'All',        value: null },
  { label: '🍴 Food',    value: 'food' },
  { label: '✈️ Travel',  value: 'travel' },
  { label: '🛍 Shop',    value: 'shopping' },
  { label: '🎫 Exp',     value: 'experience' },
  { label: '💻 Tech',    value: 'tech' },
];

export default function HomeScreen({ navigation }) {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

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

  const filtered = activeCategory
    ? saves.filter((s) => s.category === activeCategory)
    : saves;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Text style={styles.logo}>TryThis</Text>
            <Pressable onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.bell}>🔔</Text>
            </Pressable>
          </View>
          <SearchBar onPress={() => navigation.navigate('Search')} />
          <View style={styles.chips}>
            {CHIPS.map((c) => (
              <Chip
                key={c.label}
                label={c.label}
                active={activeCategory === c.value}
                onPress={() => setActiveCategory(c.value)}
              />
            ))}
          </View>
          {loading && <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />}
          {error && <Text style={styles.error}>{error}</Text>}
          {!loading && filtered.length === 0 && (
            <Text style={styles.empty}>
              {activeCategory ? `No ${activeCategory} saves yet.` : 'No saves yet. Tap ＋ to add your first one.'}
            </Text>
          )}
          {!loading && filtered.length > 0 && (
            <Text style={styles.section}>
              {activeCategory ? `${filtered.length} saves` : 'Recent saves'}
            </Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  logo: { fontSize: 30, fontWeight: '900', color: colors.text },
  bell: { fontSize: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md, marginBottom: spacing.sm },
  section: { fontSize: 18, fontWeight: '900', marginVertical: spacing.sm, color: colors.text },
  loader: { marginTop: spacing.xl },
  error: { color: colors.coral, marginTop: spacing.lg, textAlign: 'center' },
  empty: { color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
});
