// <SmartImage> — RN <Image> that lazily refreshes IG/CDN thumbnails when
// they 403 after their `oe=` expiry. Calls POST /saves/:id/refresh-thumb once.
import React, { useEffect, useRef, useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import * as api from '../services/api';
import { colors } from '../theme/colors';

export default function SmartImage({ saveId, source, style, placeholder = '🖼️', ...rest }) {
  const [uri, setUri] = useState(source?.uri);
  const [failed, setFailed] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    setUri(source?.uri);
    setFailed(false);
    tried.current = false;
  }, [source?.uri]);

  const handleError = async () => {
    if (tried.current || !saveId) { setFailed(true); return; }
    tried.current = true;
    try {
      const res = await api.refreshThumb(saveId);
      if (res?.status === 'success' && res.data?.image) {
        setUri(res.data.image);
        return;
      }
    } catch {
      // fall through
    }
    setFailed(true);
  };

  if (!uri || failed) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>{placeholder}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={style} onError={handleError} {...rest} />;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 28 },
});
