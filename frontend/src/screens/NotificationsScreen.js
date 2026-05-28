import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as api from '../services/api';

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const NOTIFICATION_COLORS = {
  welcome: { bg: '#d3f9d8', icon: '✨' },
  travel_intelligence: { bg: '#dbeafe', icon: '✈️' },
  weekend_reminder: { bg: '#fef3c7', icon: '☀️' },
  resurface: { bg: '#d3f9d8', icon: '🔄' },
  shared_save_viewed: { bg: '#f3e8ff', icon: '👁️' },
  nearby: { bg: '#fef3c7', icon: '📍' },
  food_nearby: { bg: '#fef3c7', icon: '🍽️' },
  shopping_deal: { bg: '#fce7f3', icon: '🛒' },
};

const getNotificationStyle = (type) => {
  return NOTIFICATION_COLORS[type] || { bg: '#e8f5e9', icon: '🔔' };
};

export default function NotificationsScreen({ navigation }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      if (res.data?.notifications) {
        setList(res.data.notifications);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDismiss = async (id) => {
    try {
      await api.dismissNotification(id);
      setList((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setList((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const renderNotification = ({ item: n }) => {
    const style = getNotificationStyle(n.type);
    return (
      <TouchableOpacity
        onPress={() => !n.read && handleMarkRead(n._id)}
        style={{
          backgroundColor: n.read ? '#f5f5f5' : style.bg,
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#16a766',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>{style.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: '#1a1a1a' }}>
            {n.message}
          </Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {n.trigger || n.type}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 11, color: '#999' }}>
            {timeAgo(n.createdAt)}
          </Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              handleDismiss(n._id);
            }}
          >
            <Text style={{ fontSize: 11, color: '#666' }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 0.5,
          borderBottomColor: '#eee',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#f5f5f5',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>Notifications</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#16a766" />
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: '#d33' }}>{error}</Text>
        </View>
      ) : list.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
            No notifications.
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item._id}
          renderItem={renderNotification}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}
