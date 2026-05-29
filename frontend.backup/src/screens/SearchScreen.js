import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet, TextInput, ActivityIndicator, Pressable } from 'react-native';
import Chip from '../components/Chip';
import SaveCard from '../components/SaveCard';
import * as api from '../services/api';
import { adaptSaves } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const QUICK_CHIPS = ['Goa', 'Cafe', 'Cheap', 'Trip', 'Sneakers', 'Workshop'];

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (q) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await api.search({ q: term });
      setResults(adaptSaves(res.data.saves));
    } catch (err) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Search</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search 'beach cafe in Goa'"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch()}
          returnKeyType="search"
        />
        <Pressable style={styles.button} onPress={() => runSearch()}>
          <Text style={styles.buttonText}>Go</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {QUICK_CHIPS.map((label) => (
          <Chip key={label} label={label} onPress={() => { setQuery(label); runSearch(label); }} />
        ))}
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          {searched && (
            <Text style={styles.section}>
              {results.length === 0 ? 'No results' : `Results (${results.length})`}
            </Text>
          )}
          {results.map((item) => (
            <SaveCard key={item.id} item={item} onPress={() => navigation.navigate('SaveDetail', { item })} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.md, color: colors.text },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.border, color: colors.text },
  button: { backgroundColor: colors.accent, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: 18 },
  buttonText: { color: '#fff', fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  section: { fontSize: 20, fontWeight: '900', marginVertical: spacing.md, color: colors.text },
  error: { color: colors.coral, marginTop: spacing.lg, textAlign: 'center' },
});
