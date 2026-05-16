import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import SearchBar from '../components/SearchBar';
import Chip from '../components/Chip';
import SaveCard from '../components/SaveCard';
import { saves } from '../data/mockData';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>TryThis</Text>
        <Text style={styles.bell}>🔔</Text>
      </View>
      <SearchBar />
      <View style={styles.chips}>
        {['All', 'Visit', 'Buy', 'Experience'].map((label, index) => (
          <Chip key={label} label={label} active={index === 0} />
        ))}
      </View>
      <Text style={styles.section}>Recommended for you</Text>
      <SaveCard large item={saves[0]} onPress={() => navigation.navigate('SaveDetail', { item: saves[0] })} />
      <Text style={styles.section}>Recent saves</Text>
      {saves.slice(1).map((item) => (
        <SaveCard key={item.id} item={item} onPress={() => navigation.navigate('SaveDetail', { item })} />
      ))}
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
  section: { fontSize: 20, fontWeight: '900', marginVertical: spacing.md, color: colors.text }
});
