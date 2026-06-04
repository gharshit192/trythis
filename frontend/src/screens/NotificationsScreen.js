import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/api';
import { adaptSave } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const TYPE_STYLE = {
  welcome:            { bg: '#d3f9d8', icon: '✨' },
  travel_intelligence:{ bg: '#dbeafe', icon: '✈️' },
  weekend_reminder:   { bg: '#fef3c7', icon: '☀️' },
  resurface:          { bg: '#d3f9d8', icon: '🔄' },
  shared_save_viewed: { bg: '#f3e8ff', icon: '👁️' },
  nearby:             { bg: '#fef3c7', icon: '📍' },
  food_nearby:        { bg: '#fef3c7', icon: '🍽️' },
  shopping_deal:      { bg: '#fce7f3', icon: '🛒' },
  upload_failed:      { bg: '#fee2e2', icon: '❌' },
  upload_success:     { bg: '#d1fae5', icon: '✅' },
  processing_done:    { bg: '#d1fae5', icon: '✅' },
};
const getStyle = (type) => TYPE_STYLE[type] || { bg: '#e8f5e9', icon: '🔔' };

export default function NotificationsScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      setList(res.data?.notifications || res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDismiss = async (id) => {
    try {
      await api.dismissNotification(id);
      setList((prev) => prev.filter((n) => n._id !== id));
    } catch {}
  };

  const handleTap = async (n) => {
    if (n.status !== 'opened') {
      try { await api.markNotificationRead(n._id); } catch {}
      setList((prev) => prev.map((x) => x._id === n._id ? { ...x, status: 'opened' } : x));
    }
    if (n.relatedSaveId) {
      try {
        const res = await api.getSaveById(n.relatedSaveId);
        if (res.status === 'success') {
          navigation.navigate('SaveDetail', { item: adaptSave(res.data) });
          return;
        }
      } catch {}
      navigation.navigate('SaveDetail', { item: { _id: n.relatedSaveId } });
    }
  };

  const renderItem = ({ item: n }) => {
    const { bg, icon } = getStyle(n.type);
    const isRead = n.status === 'opened';
    return (
      <Pressable style={[styles.item, { backgroundColor: isRead ? colors.background : bg }]} onPress={() => handleTap(n)}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.msg}>{n.message || n.title}</Text>
          <Text style={styles.sub}>{n.type?.replace(/_/g, ' ')} · {timeAgo(n.createdAt)}</Text>
        </View>
        <Pressable onPress={() => handleDismiss(n._id)} hitSlop={8}>
          <Text style={styles.dismiss}>✕</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : list.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: 56, paddingBottom: spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  back: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  list: { padding: spacing.md, paddingBottom: 100 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: 14, padding: spacing.sm, marginBottom: spacing.sm,
    borderWidth: 0.5, borderColor: colors.border,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 16 },
  body: { flex: 1 },
  msg: { fontSize: 13, fontWeight: '500', color: colors.text },
  sub: { fontSize: 11, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  dismiss: { fontSize: 12, color: colors.muted, padding: 4 },
  error: { color: colors.coral, padding: spacing.md, textAlign: 'center' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
});
