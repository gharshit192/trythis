import React, { useCallback, useState } from 'react';
import {
  FlatList, Text, StyleSheet, View, ActivityIndicator,
  RefreshControl, Modal, TextInput, Pressable, Alert, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import CollectionCard from '../components/CollectionCard';
import * as api from '../services/api';
import { adaptCollections } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function CollectionsScreen({ navigation }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // collection being edited

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getCollections();
      setCollections(adaptCollections(res.data));
    } catch (err) {
      setError(err.message || 'Failed to load collections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      if (editTarget) {
        await api.updateCollection(editTarget._id || editTarget.id, { name: newName.trim() });
      } else {
        await api.createCollection(newName.trim());
      }
      setNewName('');
      setShowModal(false);
      setEditTarget(null);
      load();
    } catch (err) {
      Alert.alert(editTarget ? 'Failed to rename' : 'Failed to create', err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleLongPress = (collection) => {
    Alert.alert(collection.name, 'What would you like to do?', [
      {
        text: 'Rename',
        onPress: () => {
          setEditTarget(collection);
          setNewName(collection.name);
          setShowModal(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete collection?', `"${collection.name}" and its saves will be unlinked.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive',
              onPress: async () => {
                try {
                  await api.deleteCollection(collection._id || collection.id);
                  load();
                } catch (err) {
                  Alert.alert('Failed', err.message);
                }
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openCollection = (collection) => {
    navigation.navigate('SavedList', {
      collectionId: collection._id || collection.id,
      title: collection.name,
    });
  };

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={collections}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Collections</Text>
            <Pressable onPress={() => setShowModal(true)}>
              <Text style={styles.plus}>＋</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          loading
            ? <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: spacing.xl }} />
            : error
            ? <Text style={styles.error}>{error}</Text>
            : <Text style={styles.empty}>No collections yet. Tap ＋ to create one.</Text>
        }
        renderItem={({ item }) => (
          <CollectionCard
            collection={item}
            onPress={() => openCollection(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
      />

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowModal(false); setEditTarget(null); setNewName(''); }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editTarget ? 'Rename Collection' : 'New Collection'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Collection name"
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setShowModal(false); setEditTarget(null); setNewName(''); }} disabled={creating}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreate} disabled={creating}>
                <Text style={styles.confirm}>
                  {creating ? '…' : editTarget ? 'Save' : 'Create'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 30, fontWeight: '900', color: colors.text },
  plus: { fontSize: 30, color: colors.accent },
  error: { color: colors.coral, marginTop: spacing.lg, textAlign: 'center' },
  empty: { color: colors.muted, marginTop: spacing.xl, textAlign: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalBox: { backgroundColor: colors.card, borderRadius: 22, padding: spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border, color: colors.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.lg },
  cancel: { color: colors.muted, fontWeight: '700' },
  confirm: { color: colors.accent, fontWeight: '900' },
});
