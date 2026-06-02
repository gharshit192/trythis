import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as api from '../services/api';

const getRelativeTime = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
};

const getDomain = (url) => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
};

const getCategoryIcon = (category) => {
  const map = {
    travel: '🗺️',
    food: '🍴',
    restaurant: '🍽️',
    cafe: '☕',
    shopping: '🛍️',
    tech: '💻',
    blog: '📝',
  };
  return map[category] || '🌍';
};

const isVideo = (save) =>
  save.contentType === 'video' ||
  save.source === 'instagram' ||
  save.source === 'youtube';

const isLink = (save) =>
  (save.contentType === 'link' || save.contentType === 'article' || save.source === 'url') &&
  !isVideo(save);

const isBundle = (save) =>
  save.source === 'screenshot_bundle' ||
  save.contentType === 'screenshot';

export default function SavedListScreen({ navigation, route }) {
  const { filter = '', title = 'Saved', collectionId } = route?.params || {};
  const [filteredSaves, setFilteredSaves] = useState([]);
  const [allSaves, setAllSaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSaves = async () => {
      setLoading(true);
      try {
        let data;
        if (collectionId) {
          // Load saves belonging to a specific collection
          const res = await api.getCollectionById(collectionId);
          data = res.data?.saves || [];
        } else {
          const res = await api.getSaves();
          data = res.data || [];
        }
        setAllSaves(data);
      } catch (err) {
        console.error('Failed to fetch saves:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSaves();
  }, [collectionId]);

  useEffect(() => {
    let filtered = allSaves;
    switch (filter) {
      case 'video':
        filtered = allSaves.filter(isVideo);
        break;
      case 'link':
        filtered = allSaves.filter(isLink);
        break;
      case 'bundle':
        filtered = allSaves.filter(isBundle);
        break;
      default:
        filtered = allSaves;
    }
    setFilteredSaves(filtered);
  }, [allSaves, filter]);

  const renderVideoItem = ({ item }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate('SaveDetail', { saveId: item._id })
      }
      style={{ flex: 0.5, marginRight: 8, marginBottom: 12 }}
    >
      <View
        style={{
          width: '100%',
          height: 120,
          borderRadius: 12,
          backgroundColor: '#f0f0f0',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 30 }}>▶️</Text>
      </View>
      <Text
        numberOfLines={2}
        style={{ fontSize: 12, fontWeight: '500', color: '#1a1a1a', marginTop: 8 }}
      >
        {item.title}
      </Text>
      <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
        {item.source || 'Saved'} · {getRelativeTime(item.createdAt)}
      </Text>
    </TouchableOpacity>
  );

  const renderLinkItem = ({ item, index }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate('SaveDetail', { saveId: item._id })
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: index < filteredSaves.length - 1 ? 0.5 : 0,
        borderBottomColor: '#eee',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: '#f0f0f0',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 18 }}>
          {getCategoryIcon(item.category)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: '500', color: '#1a1a1a' }}
        >
          {item.title}
        </Text>
        <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
          {getDomain(item.url) || item.source}
        </Text>
      </View>
      <Text style={{ fontSize: 16, color: '#bbb' }}>›</Text>
    </TouchableOpacity>
  );

  const renderBundleItem = ({ item }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate('ScreenshotSummary', {
          sessionId: item._id,
          saveId: item._id,
        })
      }
      style={{
        flex: 0.5,
        marginRight: 8,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: '#eee',
        padding: 12,
        backgroundColor: '#fff',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#f0f0f0',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 18 }}>
            {getCategoryIcon(item.category)}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#1a1a1a' }}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 10, color: '#888' }}>
            {item.aiAnalysis?.screenshots?.length || 0} screenshots
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={{ padding: 60, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 16, color: '#888', marginBottom: 8 }}>
        No {title.toLowerCase()} yet
      </Text>
      <Text style={{ fontSize: 12, color: '#888' }}>Tap + to add your first save</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
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
        <Text style={{ fontSize: 18, fontWeight: '600' }}>{title}</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#16a766" />
        </View>
      ) : filteredSaves.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredSaves}
          renderItem={
            filter === 'link'
              ? renderLinkItem
              : filter === 'video'
              ? renderVideoItem
              : renderBundleItem
          }
          keyExtractor={(item) => item._id}
          numColumns={filter === 'link' ? 1 : 2}
          columnWrapperStyle={filter !== 'link' ? { gap: 8 } : undefined}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}
