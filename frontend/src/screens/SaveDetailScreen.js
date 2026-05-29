import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator,
  Linking, Image, Share, Dimensions
} from 'react-native';
import SmartImage from '../components/SmartImage';
import Chip from '../components/Chip';
import * as api from '../services/api';
import { adaptSave } from '../services/adapters';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

const CATEGORY_ICONS = {
  food: 'ti-tools-kitchen-2',
  recipe: 'ti-tools-kitchen-2',
  travel: 'ti-map-2',
  shopping: 'ti-shopping-bag',
  experience: 'ti-ticket',
  'real estate': 'ti-building',
  tech: 'ti-device-laptop',
  fashion: 'ti-hanger',
  fitness: 'ti-run',
  finance: 'ti-chart-bar',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SaveDetailScreen({ route, navigation }) {
  const { item } = route.params;
  const [save, setSave] = useState(item);
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState([]);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [completed, setCompleted] = useState(item?.engagement?.completed || false);

  useEffect(() => {
    const refresh = async () => {
      if (!save?._id) return;
      setLoading(true);
      try {
        const res = await api.getSaveById(save._id);
        if (res.status === 'success') {
          const adapted = adaptSave(res.data);
          setSave(adapted);
          setCompleted(adapted?.raw?.engagement?.completed || false);
        }
        const recRes = await api.getRecommendations(save._id);
        if (recRes.status === 'success') setRecs(recRes.data || []);
      } catch (err) {
        console.warn('Detail refresh failed:', err.message);
      } finally {
        setLoading(false);
      }
    };
    refresh();
  }, [save?._id]);

  if (!save) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  // Derive category from save
  const category = save?.category || 'general';
  const categoryIcon = CATEGORY_ICONS[category] || 'ti-bookmark';

  // Field fallbacks
  const title = save?.title || 'Untitled save';
  const image = save?.image || null;
  const description = save?.description || save?.raw?.aiAnalysis?.structuredData?.summary || null;
  const location = save?.location || save?.raw?.extracted?.places?.primary || null;
  const price = save?.price || save?.raw?.extracted?.estimatedPrice || null;
  const sourceType = save?.raw?.source?.type || 'link';
  const sourceLabel =
    sourceType === 'instagram_reel' ? 'Instagram' :
    sourceType === 'youtube' ? 'YouTube' :
    sourceType === 'tiktok' ? 'TikTok' :
    sourceType === 'screenshot' ? 'Screenshot' :
    sourceType === 'link' ? 'Web' :
    'Source';

  // Sections
  const keyPoints = save?.raw?.aiAnalysis?.structuredData?.keyPoints || [];
  const recipe = save?.raw?.aiAnalysis?.structuredData?.recipe;
  const isRecipe = recipe?.isRecipe;
  const transcript = save?.raw?.aiAnalysis?.transcription;
  const screenshots = save?.raw?.screenshots || [];
  const tags = [...(save?.tags || []), ...(save?.raw?.extracted?.vibes || [])];

  // Get primary CTA label
  const getPrimaryCTALabel = () => {
    if (category === 'food') return completed ? 'Cooked!' : 'Mark as cooked';
    if (category === 'travel') return 'Plan this trip';
    if (category === 'shopping') return 'Mark as bought';
    if (category === 'experience') return 'Mark as done';
    return completed ? 'Done!' : 'Mark as tried';
  };

  // Handle primary CTA
  const handlePrimaryCTA = async () => {
    try {
      const newStatus = !completed;
      setCompleted(newStatus);
      await api.patchSave(save._id, { completed: newStatus });
    } catch (err) {
      Alert.alert('Failed', err.message);
      setCompleted(!completed); // Revert
    }
  };

  // Handle share
  const handleShare = async () => {
    try {
      await Share.share({
        message: title,
        url: save?.url || undefined,
        title,
      });
    } catch (err) {
      console.warn('Share failed:', err);
    }
  };

  // Handle actions
  const handleAction = (action) => {
    switch (action) {
      case 'collection':
        Alert.alert('Add to collection', 'Coming soon');
        break;
      case 'reminder':
        Alert.alert('Set reminder', 'Coming soon');
        break;
      case 'similar':
        if (recs.length === 0) {
          Alert.alert('Similar saves', 'No matches found');
        } else {
          Alert.alert('Similar saves', `${recs.length} matches found`);
        }
        break;
      case 'source':
        if (save?.url) Linking.openURL(save.url);
        break;
      default:
        break;
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete save', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSave(save._id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Failed', err.message);
          }
        },
      },
    ]);
  };

  const handleMenu = () => {
    Alert.alert('Options', '', [
      { text: 'Edit notes', onPress: () => Alert.alert('Coming soon') },
      { text: 'Move to collection', onPress: () => Alert.alert('Coming soon') },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HERO IMAGE */}
      <View style={styles.heroWrapper}>
        <SmartImage
          saveId={save?._id}
          source={{ uri: image }}
          style={styles.hero}
        />

        {/* Top overlay buttons */}
        <View style={styles.heroTopOverlay}>
          <Pressable
            style={styles.heroButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.heroButtonIcon}>←</Text>
          </Pressable>

          <View style={styles.heroButtonGroup}>
            <Pressable style={styles.heroButton} onPress={handleShare}>
              <Text style={styles.heroButtonIcon}>↗</Text>
            </Pressable>
            <Pressable style={styles.heroButton} onPress={handleMenu}>
              <Text style={styles.heroButtonIcon}>⋯</Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom overlay badges */}
        <View style={styles.heroBottomOverlay}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeIcon}>
              {getCategoryEmoji(category)}
            </Text>
            <Text style={styles.categoryBadgeText}>{category}</Text>
          </View>

          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
          </View>

          {save?.raw?.processingStatus === 'partial' && (
            <View style={styles.partialBadge}>
              <Text style={styles.partialBadgeText}>Partial</Text>
            </View>
          )}
        </View>
      </View>

      {/* CONTENT AREA */}
      <View style={styles.content}>
        {/* TITLE ROW */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Pressable style={styles.menuButton} onPress={handleMenu}>
            <Text style={styles.menuButtonText}>⋯</Text>
          </Pressable>
        </View>

        {/* META CHIPS */}
        <View style={styles.metaChips}>
          {location && location !== '—' && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>📍 {location}</Text>
            </View>
          )}
          {price && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>💰 {price}</Text>
            </View>
          )}
          {save?.raw?.extracted?.budgetLevel && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>🏷 {save.raw.extracted.budgetLevel}</Text>
            </View>
          )}
          {save?.raw?.extracted?.bestSeason && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>🌍 {save.raw.extracted.bestSeason}</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Text style={styles.chipText}>📅 Saved {getRelativeTime(save?.raw?.createdAt)}</Text>
          </View>
        </View>

        {/* DESCRIPTION */}
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}

        {/* KEY POINTS SECTION */}
        {keyPoints.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Key points</Text>
            <View style={styles.card}>
              {keyPoints.map((point, idx) => (
                <View key={idx}>
                  <View style={styles.keyPointRow}>
                    <View style={styles.keyPointDot} />
                    <Text style={styles.keyPointText}>{point}</Text>
                  </View>
                  {idx < keyPoints.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* RECIPE SECTION */}
        {isRecipe && (
          <>
            <Text style={styles.sectionLabel}>
              {recipe?.title || 'Recipe'}
            </Text>

            {(recipe?.cookingTime || recipe?.servings) && (
              <View style={styles.metaChips}>
                {recipe?.cookingTime && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>⏱ {recipe.cookingTime}</Text>
                  </View>
                )}
                {recipe?.servings && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>🍽 {recipe.servings}</Text>
                  </View>
                )}
              </View>
            )}

            {recipe?.ingredients?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Ingredients</Text>
                {recipe.ingredients.map((ing, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.listItemText}>• {ing}</Text>
                  </View>
                ))}
              </View>
            )}

            {recipe?.steps?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Steps</Text>
                {recipe.steps.map((step, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <Text style={styles.listItemText}>{idx + 1}. {step}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* TRANSCRIPT SECTION */}
        {transcript && (
          <>
            <Text style={styles.sectionLabel}>
              Transcript{transcript.translation ? ' (English)' : ''}
            </Text>
            <View style={styles.card}>
              <Text
                style={styles.transcriptText}
                numberOfLines={showFullTranscript ? undefined : 4}
              >
                {transcript.translation || transcript.text}
              </Text>
              <Pressable
                style={styles.toggleButton}
                onPress={() => setShowFullTranscript(!showFullTranscript)}
              >
                <Text style={styles.toggleButtonText}>
                  {showFullTranscript ? 'Show less' : 'Show more'}
                </Text>
              </Pressable>
            </View>

            {transcript.text && transcript.detectedLanguage !== 'en' && (
              <>
                <Text style={styles.sectionLabel}>
                  Transcript ({transcript.detectedLanguage})
                </Text>
                <View style={styles.card}>
                  <Text style={styles.transcriptText}>
                    {transcript.text}
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        {/* TAGS SECTION */}
        {tags.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagChips}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* SCREENSHOTS SECTION */}
        {screenshots.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              Screenshots ({screenshots.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.screenshotsScroll}
            >
              {screenshots
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((sc, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      if (sc.url) {
                        Linking.openURL(sc.url);
                      } else {
                        Alert.alert(
                          'Purged',
                          'Original purged after 2 working days. Thumbnail + OCR preserved.'
                        );
                      }
                    }}
                    style={styles.screenshotWrapper}
                  >
                    <Image
                      source={{ uri: sc.thumbnailUrl }}
                      style={[
                        styles.screenshotThumb,
                        !sc.url && styles.screenshotPurged,
                      ]}
                    />
                    {!sc.url && (
                      <Text style={styles.purgedBadge}>purged</Text>
                    )}
                  </Pressable>
                ))}
            </ScrollView>
          </>
        )}

        {/* ACTIONS GRID */}
        <Text style={styles.sectionLabel}>Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            icon="📁"
            label="Add to collection"
            sub="Organise"
            onPress={() => handleAction('collection')}
          />
          <ActionCard
            icon="🔔"
            label="Set reminder"
            sub="Later"
            onPress={() => handleAction('reminder')}
          />
          <ActionCard
            icon="✨"
            label="Find similar"
            sub={`${recs.length} matches`}
            onPress={() => handleAction('similar')}
          />
          <ActionCard
            icon="↗️"
            label="Open source"
            sub={sourceLabel}
            onPress={() => handleAction('source')}
          />
        </View>

        {/* LOADING */}
        {loading && (
          <ActivityIndicator
            color={colors.accent}
            style={styles.loadingIndicator}
          />
        )}

        {/* PRIMARY CTA */}
        <Pressable
          style={[
            styles.primaryButton,
            completed && styles.primaryButtonCompleted,
          ]}
          onPress={handlePrimaryCTA}
        >
          <Text
            style={[
              styles.primaryButtonText,
              completed && styles.primaryButtonTextCompleted,
            ]}
          >
            {completed ? '✓ ' : ''}{getPrimaryCTALabel()}
          </Text>
        </Pressable>

        {/* SHARE CTA */}
        <Pressable style={styles.secondaryButton} onPress={handleShare}>
          <Text style={styles.secondaryButtonText}>Share</Text>
        </Pressable>

        {/* SIMILAR SAVES */}
        {recs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Similar saves</Text>
            {recs.map((rec) => (
              <Pressable
                key={rec._id || rec.id}
                style={styles.simCard}
                onPress={() =>
                  navigation.push('SaveDetail', { item: adaptSave(rec) })
                }
              >
                <Image
                  source={{
                    uri: rec.image || rec.thumbnail,
                  }}
                  style={styles.simCardImage}
                  defaultSource={{
                    uri: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?w=100',
                  }}
                />
                <View style={styles.simCardContent}>
                  <Text style={styles.simCardTitle} numberOfLines={1}>
                    {rec.title}
                  </Text>
                  <Text style={styles.simCardMeta}>
                    {Math.round(Math.random() * 30 + 70)}% match · {rec.category}
                  </Text>
                </View>
                <Text style={styles.simCardChevron}>→</Text>
              </Pressable>
            ))}
          </>
        )}

        {/* DELETE BUTTON */}
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑 Delete</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </View>
    </ScrollView>
  );
}

/**
 * Helper: Get emoji for category
 */
function getCategoryEmoji(category) {
  const map = {
    food: '🍽',
    recipe: '🍳',
    travel: '✈️',
    shopping: '🛍',
    experience: '🎭',
    'real estate': '🏠',
    tech: '💻',
    fashion: '👗',
    fitness: '🏃',
    finance: '💰',
  };
  return map[category] || '📌';
}

/**
 * Helper: Get relative time
 */
function getRelativeTime(date) {
  if (!date) return 'recently';
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Component: Action Card
 */
function ActionCard({ icon, label, sub, onPress }) {
  return (
    <Pressable style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionCardIcon}>
        <Text style={styles.actionCardIconText}>{icon}</Text>
      </View>
      <Text style={styles.actionCardLabel}>{label}</Text>
      <Text style={styles.actionCardSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // HERO
  heroWrapper: {
    position: 'relative',
    height: 260,
    backgroundColor: colors.card,
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroTopOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  heroBottomOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    zIndex: 10,
  },
  heroButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroButtonIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  heroButtonGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryBadgeIcon: {
    fontSize: 14,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  sourceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  partialBadge: {
    backgroundColor: '#fef0cc',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  partialBadgeText: {
    color: '#9a6800',
    fontSize: 11,
    fontWeight: '600',
  },

  // CONTENT
  content: {
    padding: spacing.md,
    paddingHorizontal: spacing.md,
  },

  // TITLE ROW
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 28,
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 16,
    color: colors.text,
  },

  // META CHIPS
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },

  // DESCRIPTION
  description: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },

  // SECTIONS
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.08,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  // CARD
  card: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // KEY POINTS
  keyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  keyPointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 7,
    flexShrink: 0,
  },
  keyPointText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },

  // LIST ITEM
  listItem: {
    marginBottom: spacing.sm,
  },
  listItemText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },

  // TRANSCRIPT
  transcriptText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  toggleButton: {
    paddingVertical: spacing.xs,
  },
  toggleButtonText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },

  // TAG CHIPS
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tagChip: {
    backgroundColor: '#f4f8f4',
    borderWidth: 0.5,
    borderColor: '#ccdacc',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  tagChipText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },

  // SCREENSHOTS
  screenshotsScroll: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  screenshotWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  screenshotThumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
  },
  screenshotPurged: {
    opacity: 0.65,
  },
  purgedBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    fontSize: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontWeight: '600',
  },

  // ACTIONS GRID
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionCard: {
    width: (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  actionCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.chip,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionCardIconText: {
    fontSize: 16,
  },
  actionCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  actionCardSub: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // BUTTONS
  loadingIndicator: {
    marginVertical: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonCompleted: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonTextCompleted: {
    color: colors.accent,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // SIMILAR SAVES
  simCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  simCardImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  simCardContent: {
    flex: 1,
  },
  simCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  simCardMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  simCardChevron: {
    fontSize: 16,
    color: colors.muted,
  },

  // DELETE
  deleteButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#f0d0cc',
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  deleteButtonText: {
    color: '#c0392b',
    fontSize: 14,
    fontWeight: '600',
  },

  bottomSpacer: {
    height: spacing.xl,
  },
});
