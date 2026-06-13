// Central mapping from real save categories (food, cafe, restaurant, travel,
// experience, shopping, home-decor, recipe, cooking, tech, blog, ...) to the
// 5-bucket category language used by the redesign (Eat / Travel / Shop / Cook / Learn).

const BUCKETS = {
  eat: { key: 'eat', label: 'Eat & Drink', shortLabel: 'Eat', emoji: '🍽️', chipClass: 'chip-eat', color: 'var(--coral)', gradientClass: 'thumb-1', icon: 'ti-tools-kitchen-2' },
  travel: { key: 'travel', label: 'Travel', shortLabel: 'Travel', emoji: '✈️', chipClass: 'chip-travel', color: 'var(--travel)', gradientClass: 'thumb-2', icon: 'ti-map-2' },
  shop: { key: 'shop', label: 'Shop', shortLabel: 'Shop', emoji: '🛍️', chipClass: 'chip-shop', color: 'var(--shop)', gradientClass: 'thumb-4', icon: 'ti-shopping-bag' },
  cook: { key: 'cook', label: 'Cook', shortLabel: 'Cook', emoji: '👨‍🍳', chipClass: 'chip-cook', color: 'var(--cook)', gradientClass: 'thumb-3', icon: 'ti-chef-hat' },
  learn: { key: 'learn', label: 'Learn', shortLabel: 'Learn', emoji: '📚', chipClass: 'chip-learn', color: 'var(--learn)', gradientClass: 'thumb-5', icon: 'ti-device-laptop' },
  saved: { key: 'saved', label: 'Saved', shortLabel: 'Saved', emoji: '🔖', chipClass: 'chip-neutral', color: 'var(--mute)', gradientClass: 'thumb-6', icon: 'ti-bookmark' },
};

const CATEGORY_TO_BUCKET = {
  food: 'eat',
  cafe: 'eat',
  restaurant: 'eat',
  travel: 'travel',
  experience: 'travel',
  shopping: 'shop',
  'home-decor': 'shop',
  fashion: 'shop',
  beauty: 'shop',
  recipe: 'cook',
  cooking: 'cook',
  tech: 'learn',
  blog: 'learn',
};

export function getCategoryBucket(category) {
  return CATEGORY_TO_BUCKET[category] || 'saved';
}

export function getCategoryMeta(category) {
  return BUCKETS[getCategoryBucket(category)];
}

// Look up bucket metadata directly by bucket id (e.g. 'eat', 'travel', 'saved').
export function getBucketMeta(bucketId) {
  return BUCKETS[bucketId] || BUCKETS.saved;
}

export function categoryMatchesFilter(category, filterId) {
  if (!filterId || filterId === 'all') return true;
  return getCategoryBucket(category) === filterId;
}

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'eat', label: '🍽️ Eat' },
  { id: 'travel', label: '✈️ Travel' },
  { id: 'shop', label: '🛍️ Shop' },
  { id: 'cook', label: '👨‍🍳 Cook' },
  { id: 'learn', label: '📚 Learn' },
];
