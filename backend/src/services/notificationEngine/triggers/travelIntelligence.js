const axios = require('axios');
const Save  = require('../../../models/Save');
const Notification = require('../../../models/Notification');
const { getMessage } = require('../../notificationMessageService');
const logger = require('../../../utils/logger');

// Extract destination from a save
const extractDestination = (save) => {
  const title   = (save.title   || '').toLowerCase();
  const summary = (save.aiAnalysis?.summary || '').toLowerCase();
  const tags    = (save.tags    || []).join(' ').toLowerCase();
  const combined = `${title} ${summary} ${tags}`;

  // Indian destinations
  const destinations = [
    { name: 'Goa',        keywords: ['goa', 'baga', 'calangute', 'anjuna', 'panaji'] },
    { name: 'Kerala',     keywords: ['kerala', 'munnar', 'alleppey', 'kochi', 'wayanad', 'kovalam'] },
    { name: 'Himachal',   keywords: ['himachal', 'manali', 'shimla', 'kasol', 'tirthan', 'spiti'] },
    { name: 'Rajasthan',  keywords: ['rajasthan', 'jaipur', 'udaipur', 'jodhpur', 'jaisalmer'] },
    { name: 'Uttarakhand',keywords: ['uttarakhand', 'rishikesh', 'mussoorie', 'nainital', 'auli'] },
    { name: 'Ladakh',     keywords: ['ladakh', 'leh', 'pangong', 'nubra'] },
    { name: 'Andaman',    keywords: ['andaman', 'port blair', 'havelock'] },
    { name: 'Coorg',      keywords: ['coorg', 'kodagu', 'madikeri'] },
    { name: 'Ooty',       keywords: ['ooty', 'ootacamund', 'nilgiris'] },
    { name: 'Meghalaya',  keywords: ['meghalaya', 'shillong', 'cherrapunji'] },
  ];

  for (const dest of destinations) {
    if (dest.keywords.some(kw => combined.includes(kw))) {
      return dest.name;
    }
  }

  // Try extracting from structuredData
  const itinerary = save.aiAnalysis?.structuredData?.itinerary;
  if (itinerary?.destination) return itinerary.destination;

  return null;
};

// Check weather via Open-Meteo (free, no API key)
const checkWeather = async (destination) => {
  const coords = {
    'Goa':         { lat: 15.2993, lng: 74.1240 },
    'Kerala':      { lat: 10.8505, lng: 76.2711 },
    'Himachal':    { lat: 31.1048, lng: 77.1734 },
    'Rajasthan':   { lat: 27.0238, lng: 74.2179 },
    'Uttarakhand': { lat: 30.0668, lng: 79.0193 },
    'Ladakh':      { lat: 34.1526, lng: 77.5771 },
    'Meghalaya':   { lat: 25.4670, lng: 91.3662 },
  };

  const coord = coords[destination];
  if (!coord) return null;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lng}&daily=temperature_2m_max,precipitation_sum&timezone=Asia%2FKolkata&forecast_days=3`;
    const res = await axios.get(url, { timeout: 5000 });
    const data = res.data?.daily;
    if (!data) return null;

    const maxTemp = data.temperature_2m_max?.[0];
    const rain    = data.precipitation_sum?.[0];

    // Good weather: temp 15-30°C, rain < 5mm
    if (maxTemp >= 15 && maxTemp <= 30 && rain < 5) {
      return {
        type: 'weather_good',
        description: `${Math.round(maxTemp)}°C and clear skies`,
        maxTemp,
        rain
      };
    }
    return null;
  } catch {
    return null;
  }
};

// Check events via Eventbrite (free tier)
const checkEvents = async (destination) => {
  if (!process.env.EVENTBRITE_API_KEY) return null;

  try {
    const res = await axios.get('https://www.eventbriteapi.com/v3/events/search/', {
      params: {
        q: destination,
        location__address: `${destination}, India`,
        start_date__range_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        sort_by: 'best',
        expand: 'venue'
      },
      headers: { Authorization: `Bearer ${process.env.EVENTBRITE_API_KEY}` },
      timeout: 5000
    });

    const events = res.data?.events?.filter(e => !e.is_free === false || e.is_free);
    if (!events?.length) return null;

    const event = events[0];
    return {
      type: 'cultural_event',
      eventName: event.name?.text,
      startDate: new Date(event.start?.local).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      url: event.url
    };
  } catch {
    return null;
  }
};

// Known Indian cultural events (fallback when no API)
const getKnownEvents = (destination, month) => {
  const events = {
    'Kerala':  [
      { months: [8, 9],  name: 'Onam celebrations across Kerala',       type: 'cultural_event' },
      { months: [12, 1], name: 'Thrissur Pooram preparations underway',  type: 'cultural_event' },
    ],
    'Goa':     [
      { months: [11, 12], name: 'Sunburn Festival in Goa',               type: 'cultural_event' },
      { months: [12],     name: 'Goa Carnival season approaching',        type: 'cultural_event' },
    ],
    'Rajasthan': [
      { months: [1, 2],  name: 'Jaipur Literature Festival',             type: 'cultural_event' },
      { months: [10, 11], name: 'Pushkar Camel Fair',                    type: 'cultural_event' },
    ],
    'Himachal': [
      { months: [9, 10], name: 'Kullu Dussehra — India\'s biggest Dussehra', type: 'cultural_event' },
    ]
  };

  const destEvents = events[destination] || [];
  return destEvents.find(e => e.months.includes(month)) || null;
};

// Main trigger
const evaluate = async (userId, context = {}, userPersona = {}) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const travelSaves = await Save.find({
      userId,
      category: { $in: ['travel', 'experience'] },
      status: 'active',
      processingStatus: { $in: ['done', 'partial'] }
    }).sort({ createdAt: -1 }).limit(20);

    if (!travelSaves.length) return [];

    // Group saves by destination
    const byDestination = {};
    for (const save of travelSaves) {
      const dest = extractDestination(save);
      if (!dest) continue;
      if (!byDestination[dest]) byDestination[dest] = [];
      byDestination[dest].push(save);
    }

    const notifications = [];
    const currentMonth  = new Date().getMonth() + 1;
    const dayOfWeek     = new Date().getDay();
    const isWeekend     = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

    for (const [destination, saves] of Object.entries(byDestination)) {
      // Skip if already notified about this destination in last 7 days
      const recentNotif = await Notification.findOne({
        userId,
        'metadata.destination': destination,
        createdAt: { $gte: sevenDaysAgo }
      });
      if (recentNotif) continue;

      const featuredSave = saves[0];
      let signal = null;

      // Try weather first (always available, free)
      if (isWeekend) {
        signal = await checkWeather(destination);
      }

      // Try events API, fall back to known events
      if (!signal) {
        signal = await checkEvents(destination);
        if (!signal) {
          const known = getKnownEvents(destination, currentMonth);
          if (known) signal = known;
        }
      }

      // Weekend reminder as final fallback
      if (!signal && isWeekend && saves.length >= 2) {
        signal = {
          type: 'weekend_reminder',
          dayName: dayOfWeek === 5 ? 'Friday' : dayOfWeek === 6 ? 'Saturday' : 'Sunday',
        };
      }

      if (!signal) continue;

      // Generate unique message with Groq
      const messageData = await getMessage({
        type: 'travel_' + destination.toLowerCase(),
        saveTitle: featuredSave.title,
        destination,
        vars: {
          count: saves.length,
          temp: signal.maxTemp,
          eventName: signal.eventName,
          date: signal.startDate,
          dayName: signal.dayName
        },
        userId
      });

      if (!messageData || !messageData.body) continue;

      notifications.push({
        type:           'travel_intelligence',
        category:       featuredSave.category,
        title:          messageData.title,
        message:        messageData.body,
        relatedSaveId:  featuredSave._id,
        priority:       signal.type === 'cultural_event' ? 'high' : 'medium',
        relevanceScore: signal.type === 'cultural_event' ? 0.9 : 0.75,
        metadata: {
          destination,
          signalType:  signal.type,
          saveCount:   saves.length,
          eventName:   signal.eventName   || null,
          weatherTemp: signal.maxTemp     || null,
          eventUrl:    signal.url         || null
        },
        actionUrl: `/saves/${featuredSave._id}`
      });

      // Only one notification per destination per run
      break;
    }

    return notifications;
  } catch (err) {
    logger.error(`[travelIntelligence] failed: ${err.message}`);
    return [];
  }
};

module.exports = { evaluate };
