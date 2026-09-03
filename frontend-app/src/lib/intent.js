// Which saves take part in the Want to try → Planning → Tried loop (ADR 0015),
// and which are documents you keep and act on (bills, notes, a table of
// contents, a chat). The intent control only appears on the first kind; the
// second gets a reminder and a Done.
const TRYABLE_CATEGORIES = new Set(['cafe', 'cafes', 'restaurant', 'restaurants', 'food', 'street_food', 'recipe', 'recipes', 'cooking', 'travel', 'experience', 'experiences', 'hotel', 'hotels', 'market', 'shopping', 'fashion', 'home-decor', 'beauty', 'tech', 'film', 'movie', 'show', 'book', 'events', 'entertainment', 'fitness', 'products', 'product']);
const TRYABLE_SHOTS = new Set(['menu', 'product_page', 'travel_booking', 'price_list', 'map', 'social_post']);
const DOCUMENT_THEMES = new Set(['notes', 'document', 'bill', 'invoice', 'receipt', 'finance', 'chat', 'code', 'app_ui', 'notification', 'handwritten_note']);

export function isTryable(save) {
  if (!save) return false;
  if (save.source === 'voice') return save.memoryType === 'plan' || save.memoryType === 'place';
  if (save.contentType === 'image' || save.source === 'screenshot') {
    const sa = save.aiAnalysis?.screenshotAnalysis || {};
    const type = sa.type === 'bundle' ? null : (sa.type || sa.data?.type);
    const theme = sa.data?.detectedTheme;
    if (type && TRYABLE_SHOTS.has(type)) return true;
    if (theme && DOCUMENT_THEMES.has(theme)) return false;
    if (sa.data?.handwrittenAnalysis) return false;
    return TRYABLE_CATEGORIES.has(save.category);
  }
  return TRYABLE_CATEGORIES.has(save.category);
}

export function kindLabel(save) {
  const sa = save?.aiAnalysis?.screenshotAnalysis || {};
  const theme = sa.data?.detectedTheme || sa.data?.handwrittenAnalysis?.documentType;
  if (theme && theme !== 'auto') return theme.replace(/_/g, ' ');
  return save?.memoryType || 'document';
}
