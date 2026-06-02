import React, { useState } from 'react';
import { FlatList, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import SearchBar from '../components/SearchBar';
import Chip from '../components/Chip';
import SaveCard from '../components/SaveCard';
import * as api from '../services/api';
import { adaptSaves } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const QUICK_CHIPS = ['cafe', 'beach', 'recipe', 'museum', 'trip', 'sneakers'];

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (term = query) => {
    const q = term.trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      // api.search(q) calls GET /search?q=... correctly
      const res = await api.search(q);
      setResults(adaptSaves(res.data?.saves || res.data || []));
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={results}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Search</Text>
          <SearchBar
            placeholder="Places, recipes, products…"
            value={query}
            onChangeText={setQuery}
            onSubmit={() => runSearch()}
          />
          <View style={styles.chips}>
            {QUICK_CHIPS.map((label) => (
              <Chip key={label} label={label} onPress={() => runSearch(label)} />
            ))}
          </View>
          {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />}
          {error && <Text style={styles.error}>{error}</Text>}
          {searched && !loading && (
            <Text style={styles.section}>
              {results.length === 0 ? 'No results' : `${results.length} results`}
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
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.md, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  section: { fontSize: 18, fontWeight: '900', marginVertical: spacing.sm, color: colors.text },
  error: { color: colors.coral, marginTop: spacing.lg, textAlign: 'center' },
});
