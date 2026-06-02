import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

// When onPress is provided the bar acts as a tap target (navigates to Search).
// Without onPress it renders a live TextInput (used inside SearchScreen).
export default function SearchBar({ placeholder = 'Search places, products…', onPress, value, onChangeText, onSubmit }) {
  if (onPress) {
    return (
      <Pressable style={styles.wrap} onPress={onPress}>
        <Text style={styles.placeholder}>🔍  {placeholder}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.wrap}>
      <TextInput
        placeholder={'🔍  ' + placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
    justifyContent: 'center',
  },
  placeholder: { fontSize: 15, color: colors.muted },
  input: { height: 48, fontSize: 15, color: colors.text },
});
