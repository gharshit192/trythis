import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import * as Location from 'expo-location';
import * as api from '../services/api';
import { adaptSave } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const formatDistance = (m) => {
  if (m < 1000) return `${m}m away`;
  return `${(m / 1000).toFixed(1)}km away`;
};

export default function NearbySavesScreen({ navigation }) {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [radius, setRadius] = useState(5000); // 5km default

  const load = async (radiusMetres = radius) => {
    setLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Enable it in Settings to see nearby saves.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const res = await api.getNearbySaves(loc.coords.latitude, loc.coords.longitude, radiusMetres);
      setSaves(res.saves || []);
    } catch (err) {
      setLocationError(err.message || 'Could not get location.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const radiusOptions = [
    { label: '1 km', value: 1000 },
    { label: '5 km', value: 5000 },
    { label: '10 km', value: 10000 },
    { label: '25 km', value: 25000 },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Nearby Saves</Text>
      </View>

      {/* Radius selector */}
      <View style={styles.radiusRow}>
        {radiusOptions.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.radiusBtn, radius === opt.value && styles.radiusBtnActive]}
            onPress={() => { setRadius(opt.value); load(opt.value); }}
          >
            <Text style={[styles.radiusBtnText, radius === opt.value && styles.radiusBtnTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.hint}>Getting your location…</Text>
        </View>
      ) : locationError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{locationError}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : saves.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>Nothing nearby</Text>
          <Text style={styles.emptyHint}>No saves with location data within {radius / 1000}km.</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Refresh</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={saves}
          keyExtractor={(s) => s._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const adapted = adaptSave(item);
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('SaveDetail', { item: adapted })}
              >
                <Image
                  source={{ uri: item.thumbnail }}
                  style={styles.thumb}
                  defaultSource={{ uri: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?w=100' }}
                />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {item.extractedLocation?.name || item.extractedLocation?.city || 'Location found'}
                  </Text>
                  <Text style={styles.cardDistance}>{formatDistance(item.distanceMetres)}</Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  back: { marginRight: spacing.md },
  backText: { fontSize: 22, color: colors.accent, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '900', color: colors.text },
  radiusRow: {
    flexDirection: 'row', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  radiusBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  radiusBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  radiusBtnText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  radiusBtnTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  hint: { color: colors.muted, marginTop: spacing.sm },
  errorText: { color: colors.coral, textAlign: 'center', lineHeight: 22 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  emptyHint: { color: colors.muted, marginTop: spacing.xs, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.lg, backgroundColor: colors.accent,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  list: { padding: spacing.md },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16, marginBottom: spacing.sm,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.border },
  cardContent: { flex: 1, marginHorizontal: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardDistance: { fontSize: 12, color: colors.accent, fontWeight: '700', marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 18 },
});
