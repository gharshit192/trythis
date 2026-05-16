import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function SearchBar({ placeholder = 'Search places, products...' }) {
  return (
    <View style={styles.wrap}>
      <TextInput placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  input: {
    height: 48,
    fontSize: 15,
    color: colors.text
  }
});
