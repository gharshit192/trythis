import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import SearchBar from '../components/SearchBar';
import Chip from '../components/Chip';
import SaveCard from '../components/SaveCard';
import { saves } from '../data/mockData';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function SearchScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Search</Text>
      <SearchBar placeholder="Search ‘beach cafe in Goa’" />
      <View style={styles.chips}>
        {['Goa', 'Cafe', 'Cheap', 'Trip', 'Sneakers', 'Workshop'].map((label) => <Chip key={label} label={label} />)}
      </View>
      <Text style={styles.section}>Results</Text>
      {saves.map((item) => <SaveCard key={item.id} item={item} onPress={() => navigation.navigate('SaveDetail', { item })} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.md, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  section: { fontSize: 20, fontWeight: '900', marginVertical: spacing.md, color: colors.text }
});
