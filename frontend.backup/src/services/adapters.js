// Adapters: normalize backend Save/Collection shapes to what the UI components expect.
// Backend Save: { _id, title, description, url, image, source, category, metadata: { price, location, domain }, tags, notes, engagement, ... }
// UI legacy:    { id, title, image, intent, source, location, price, tags, notes }

const intentForCategory = (category) => {
  switch (category) {
    case 'travel': return 'Visit';
    case 'shopping': return 'Buy';
    case 'food': return 'Try';
    case 'experience': return 'Experience';
    default: return 'Save';
  }
};

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?w=800';

export const adaptSave = (save) => {
  if (!save) return null;
  const sd = save.aiAnalysis?.structuredData || {};
  const place = sd.place || {};
  const product = sd.product || {};
  const itinerary = sd.itinerary || {};
  const event = sd.event || {};

  const location =
    place.city || place.country || itinerary.destination || event.venue || (() => {
      try { return save.url ? new URL(save.url).hostname : ''; } catch { return ''; }
    })();

  const price =
    (product.price && (product.currency || '') + ' ' + product.price) ||
    (event.price && (event.currency || '') + ' ' + event.price) ||
    '';

  return {
    id: save._id || save.id,
    _id: save._id,
    title: save.title || 'Untitled',
    // back-compat: image -> thumbnail
    image: save.thumbnail || save.image || PLACEHOLDER_IMAGE,
    thumbnail: save.thumbnail || save.image || PLACEHOLDER_IMAGE,
    videoUrl: save.videoUrl,
    intent: intentForCategory(save.category),
    intentStatus: save.intentStatus,
    source: save.source ? save.source[0].toUpperCase() + save.source.slice(1) : 'Web',
    author: save.author,
    authorHandle: save.authorHandle,
    location: location || '—',
    price,
    tags: save.tags || [],
    notes: save.userNote || save.notes || '',
    description: save.description || '',
    url: save.url,
    category: save.category,
    contentType: save.contentType,
    duration: save.duration,
    likeCount: save.likeCount,
    aiAnalysis: save.aiAnalysis,
    processingStatus: save.processingStatus,
    raw: save,
  };
};

export const adaptSaves = (list) => (Array.isArray(list) ? list.map(adaptSave).filter(Boolean) : []);

export const adaptCollection = (collection) => {
  if (!collection) return null;
  const saves = Array.isArray(collection.saves) ? collection.saves : [];
  const images = saves
    .map((s) => (typeof s === 'object' ? s.image : null))
    .filter(Boolean);
  return {
    id: collection._id || collection.id,
    _id: collection._id,
    name: collection.name,
    count: collection.metadata?.itemCount ?? saves.length,
    images: images.length ? images : [PLACEHOLDER_IMAGE],
    raw: collection,
  };
};

export const adaptCollections = (list) => (Array.isArray(list) ? list.map(adaptCollection).filter(Boolean) : []);
