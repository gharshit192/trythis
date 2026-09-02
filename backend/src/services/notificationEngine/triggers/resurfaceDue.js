// Fires a memory on the date the user asked for (ADR 0016): "follow up in six
// months" → resurfaceAt → one notification, once. The age-based `resurface`
// trigger is a different thing (saves that went quiet); this one is a promise.
const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');

const evaluate = async (userId) => {
  try {
    const due = await Save.find({
      userId,
      status: 'active',
      resurfaceAt: { $ne: null, $lte: new Date() },
      resurfacedAt: null,
    }).sort({ resurfaceAt: 1 }).limit(3).lean();
    if (!due.length) return [];

    const out = [];
    for (const save of due) {
      const who = save.entities?.people?.[0];
      const where = save.entities?.place;
      const ago = Math.max(1, Math.round((Date.now() - new Date(save.createdAt)) / 86400000));
      const when = ago >= 60 ? `${Math.round(ago / 30)} months ago` : ago >= 14 ? `${Math.round(ago / 7)} weeks ago` : `${ago} days ago`;
      const plannedToday = save.plannedFor && Math.abs(new Date(save.plannedFor) - new Date(save.resurfaceAt)) < 60000;
      const spot = save.extractedLocation?.name || save.extractedLocation?.city;
      const body = plannedToday
        ? `You planned this for today${spot ? ` — ${spot}` : ''}. ${save.aiAnalysis?.structuredData?.place?.priceRange ? `${save.aiAnalysis.structuredData.place.priceRange}. ` : ''}Still on?`
        : who
          ? `You met ${who}${where ? ` at ${where}` : ''} ${when}. ${save.aiAnalysis?.timeSignal ? `You said "${save.aiAnalysis.timeSignal}".` : ''} Reconnect?`
          : `${when} you said this mattered: "${save.aiAnalysis?.summary || save.title}". Now's the time.`;
      out.push({
        type: plannedToday ? 'planned_today' : 'resurface_due',
        category: save.category,
        title: plannedToday ? `Today: ${save.title}` : save.title,
        message: body.trim(),
        relatedSaveId: save._id,
        priority: 'high',
        relevanceScore: 0.95,
        metadata: { saveId: save._id.toString(), daysOldSave: ago },
        actionUrl: `/saves/${save._id}`,
      });
      // Mark as fired now so a slow delivery can't double-send it.
      await Save.updateOne({ _id: save._id }, { $set: { resurfacedAt: new Date() } });
    }
    return out;
  } catch (err) {
    logger.error(`[resurfaceDue] failed: ${err.message}`);
    return [];
  }
};

module.exports = { evaluate };
