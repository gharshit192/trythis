import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SearchBar from '../components/SearchBar';
import Chip from '../components/Chip';
import SaveCard from '../components/SaveCard';
import * as api from '../services/api';
import { adaptSaves } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const CHIPS = ['All', 'Visit', 'Buy', 'Experience'];

export default function HomeScreen({ navigation }) {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeChip, setActiveChip] = useState('All');

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

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = activeChip === 'All' ? saves : saves.filter((s) => s.intent === activeChip);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>TryThis</Text>
        <Text style={styles.bell}>🔔</Text>
      </View>
      <SearchBar />
      <View style={styles.chips}>
        {CHIPS.map((label) => (
          <Chip key={label} label={label} active={label === activeChip} onPress={() => setActiveChip(label)} />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>No saves yet. Tap ＋ to add your first one.</Text>
      ) : (
        <>
          <Text style={styles.section}>Recommended for you</Text>
          <SaveCard large item={filtered[0]} onPress={() => navigation.navigate('SaveDetail', { item: filtered[0] })} />
          {filtered.length > 1 && (
            <>
              <Text style={styles.section}>Recent saves</Text>
              {filtered.slice(1).map((item) => (
                <SaveCard key={item.id} item={item} onPress={() => navigation.navigate('SaveDetail', { item })} />
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  logo: { fontSize: 30, fontWeight: '900', color: colors.text },
  bell: { fontSize: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  section: { fontSize: 20, fontWeight: '900', marginVertical: spacing.md, color: colors.text },
  loader: { marginTop: spacing.xl },
  error: { color: colors.coral, marginTop: spacing.lg, textAlign: 'center' },
  empty: { color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
});
