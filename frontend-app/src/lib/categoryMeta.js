// Category → tile (kind + glyph) for the text-first UI (ADR 0013), plus the
// older 5-bucket helpers still read by screens not yet rebuilt.

// Four hues carry the whole taxonomy. `kind` picks the tile colour pair in
// theme.css; `icon` is an Icon name.
const TILES = {
  cafe:        { kind: 'place', icon: 'cup',   label: 'Cafe' },
  restaurant:  { kind: 'food',  icon: 'bowl',  label: 'Restaurant' },
  food:        { kind: 'food',  icon: 'bowl',  label: 'Food' },
  street_food: { kind: 'food',  icon: 'bowl',  label: 'Street food' },
  recipe:      { kind: 'food',  icon: 'pot',   label: 'Recipe' },
  cooking:     { kind: 'food',  icon: 'pot',   label: 'Recipe' },
  travel:      { kind: 'place', icon: 'pin',   label: 'Trip' },
  experience:  { kind: 'place', icon: 'pin',   label: 'Experience' },
  hotel:       { kind: 'place', icon: 'pin',   label: 'Stay' },
  market:      { kind: 'shop',  icon: 'tent',  label: 'Market' },
  shopping:    { kind: 'shop',  icon: 'bag',   label: 'Shop' },
  fashion:     { kind: 'shop',  icon: 'bag',   label: 'Fashion' },
  'home-decor':{ kind: 'shop',  icon: 'bag',   label: 'Home' },
  beauty:      { kind: 'shop',  icon: 'bag',   label: 'Beauty' },
  tech:        { kind: 'learn', icon: 'globe', label: 'Tech' },
  blog:        { kind: 'learn', icon: 'globe', label: 'Article' },
  article:     { kind: 'learn', icon: 'globe', label: 'Article' },
  learning:    { kind: 'learn', icon: 'book',  label: 'Learn' },
  book:        { kind: 'learn', icon: 'book',  label: 'Book' },
  film:        { kind: 'learn', icon: 'film',  label: 'Film' },
  movie:       { kind: 'learn', icon: 'film',  label: 'Film' },
  show:        { kind: 'learn', icon: 'film',  label: 'Show' },
};
const TILE_DEFAULT = { kind: 'none', icon: 'bookmark', label: 'Saved' };

export function getCategoryTile(category) {
  return TILES[category] || TILE_DEFAULT;
}

// Interest chips at onboarding + Explore's Categories chip. `dot` is the hue
// shown on an unselected chip; `categories` is what the choice maps to.
export const INTERESTS = [
  { id: 'cafes',       label: 'Cafes',         kind: 'place', categories: ['cafe'] },
  { id: 'street_food', label: 'Street food',   kind: 'food',  categories: ['street_food', 'food'] },
  { id: 'restaurants', label: 'Restaurants',   kind: 'food',  categories: ['restaurant'] },
  { id: 'trips',       label: 'Weekend trips', kind: 'place', categories: ['travel', 'hotel'] },
  { id: 'recipes',     label: 'Recipes',       kind: 'food',  categories: ['recipe', 'cooking'] },
  { id: 'shopping',    label: 'Shopping',      kind: 'shop',  categories: ['shopping', 'home-decor'] },
  { id: 'fashion',     label: 'Fashion',       kind: 'shop',  categories: ['fashion', 'beauty'] },
  { id: 'films',       label: 'Films & shows', kind: 'learn', categories: ['film', 'movie', 'show'] },
  { id: 'books',       label: 'Books',         kind: 'learn', categories: ['book'] },
  { id: 'experiences', label: 'Experiences',   kind: 'place', categories: ['experience'] },
  { id: 'fitness',     label: 'Fitness',       kind: 'place', categories: ['fitness'] },
  { id: 'gadgets',     label: 'Gadgets',       kind: 'shop',  categories: ['tech'] },
];
export const KIND_HUE = { place: 'var(--cat-place)', food: 'var(--cat-food)', shop: 'var(--cat-shop)', learn: 'var(--cat-learn)', none: 'var(--cat-none)' };

// ── Legacy 5-bucket model (Eat / Travel / Shop / Cook / Learn). Read by screens
// still on legacy.css; delete with the last of them. ─────────────────────────
const BUCKETS = {
  eat: { key: 'eat', label: 'Eat & Drink', shortLabel: 'Eat', emoji: '🍽️', chipClass: 'chip-eat', color: 'var(--coral)', gradientClass: 'thumb-1', icon: 'ti-tools-kitchen-2' },
  travel: { key: 'travel', label: 'Travel', shortLabel: 'Travel', emoji: '✈️', chipClass: 'chip-travel', color: 'var(--travel)', gradientClass: 'thumb-2', icon: 'ti-map-2' },
  shop: { key: 'shop', label: 'Shop', shortLabel: 'Shop', emoji: '🛍️', chipClass: 'chip-shop', color: 'var(--shop)', gradientClass: 'thumb-4', icon: 'ti-shopping-bag' },
  cook: { key: 'cook', label: 'Cook', shortLabel: 'Cook', emoji: '👨‍🍳', chipClass: 'chip-cook', color: 'var(--cook)', gradientClass: 'thumb-3', icon: 'ti-chef-hat' },
  learn: { key: 'learn', label: 'Learn', shortLabel: 'Learn', emoji: '📚', chipClass: 'chip-learn', color: 'var(--learn)', gradientClass: 'thumb-5', icon: 'ti-device-laptop' },
  saved: { key: 'saved', label: 'Saved', shortLabel: 'Saved', emoji: '🔖', chipClass: 'chip-neutral', color: 'var(--mute)', gradientClass: 'thumb-6', icon: 'ti-bookmark' },
};
const CATEGORY_TO_BUCKET = {
  food: 'eat', cafe: 'eat', restaurant: 'eat',
  travel: 'travel', experience: 'travel',
  shopping: 'shop', 'home-decor': 'shop', fashion: 'shop', beauty: 'shop',
  recipe: 'cook', cooking: 'cook',
  tech: 'learn', blog: 'learn',
};
export function getCategoryBucket(category) { return CATEGORY_TO_BUCKET[category] || 'saved'; }
export function getCategoryMeta(category) { return BUCKETS[getCategoryBucket(category)]; }
export function getBucketMeta(bucketId) { return BUCKETS[bucketId] || BUCKETS.saved; }
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
