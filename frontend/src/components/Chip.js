import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';

export default function Chip({ label, active }) {
  return (
    <Pressable style={[styles.chip, active && styles.active]}>
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.chip,
    marginRight: 8,
    marginBottom: 8
  },
  active: { backgroundColor: colors.accent },
  text: { color: colors.text, fontWeight: '600' },
  activeText: { color: '#fff' }
});
