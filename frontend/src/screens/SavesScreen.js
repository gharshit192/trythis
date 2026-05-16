import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import SaveCard from '../components/SaveCard';
import { saves } from '../data/mockData';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function SavesScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>All Saves</Text>
      {saves.map((item) => <SaveCard key={item.id} item={item} onPress={() => navigation.navigate('SaveDetail', { item })} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: spacing.md, color: colors.text }
});
