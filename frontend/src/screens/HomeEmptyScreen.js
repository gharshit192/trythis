import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import * as storage from '../services/storage';
import { useEffect, useState } from 'react';

export default function HomeEmptyScreen({ navigation }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await storage.getUser();
      setUser(u);
    };
    loadUser();
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            padding: 20,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View>
            <Text style={{ fontSize: 13, color: '#666' }}>Hello, {firstName}</Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              Your saves
            </Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: '#16a766',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              {(user?.name || 'U').substring(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 16,
            height: 44,
            backgroundColor: '#f5f5f5',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <Text style={{ fontSize: 14, color: '#666', flex: 1 }}>
            Search saves, places, vibes…
          </Text>
        </View>

        {/* Empty State */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 80,
            paddingHorizontal: 20,
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📭</Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            No saves yet
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#666',
              marginBottom: 32,
              textAlign: 'center',
            }}
          >
            Start saving things to try later
          </Text>

          {/* Action Cards */}
          <View style={{ width: '100%', gap: 12 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('QuickSave')}
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#d4d4d0',
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <Text style={{ fontSize: 24, flexShrink: 0 }}>🔗</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#000',
                    marginBottom: 4,
                  }}
                >
                  Save from web
                </Text>
                <Text style={{ fontSize: 12, color: '#888' }}>
                  Paste a URL or save from your device
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('QuickSave')}
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#d4d4d0',
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <Text style={{ fontSize: 24, flexShrink: 0 }}>📸</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#000',
                    marginBottom: 4,
                  }}
                >
                  Screenshot
                </Text>
                <Text style={{ fontSize: 12, color: '#888' }}>
                  Capture and save images from your device
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('QuickSave')}
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#d4d4d0',
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <Text style={{ fontSize: 24, flexShrink: 0 }}>✍️</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#000',
                    marginBottom: 4,
                  }}
                >
                  Add manually
                </Text>
                <Text style={{ fontSize: 12, color: '#888' }}>
                  Create a save with your own notes
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
