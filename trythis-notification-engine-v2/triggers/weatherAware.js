const Save = require('../../../models/Save');
const logger = require('../../../utils/logger');
const axios = require('axios');

/**
 * Weather-aware notification trigger.
 *
 * Uses Open-Meteo (free, no API key) to fetch current weather for user location
 * and matches saves to the conditions.
 *
 * Examples:
 *   - Rainy → suggest cozy indoor cafes
 *   - Clear weekend → suggest travel/outdoor saves
 *   - Hot day → suggest indoor experiences, AC cafes
 *   - Pleasant evening → suggest restaurant patios, outdoor experiences
 *
 * Categories from the 18-extractor map: cafe, restaurant, travel, hotel,
 * experience, fitness, etc.
 */

const WEATHER_CACHE = new Map(); // city → { fetchedAt, weather }
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Mapping weather conditions → save categories that match
const WEATHER_RULES = {
  rain: {
    categories: ['cafe', 'restaurant', 'experience'],
    vibe: 'cozy',
    minRelevance: 0.78,
    title: (save) => `Rainy day calls for "${save.title}"`,
    message: (save) => `Indoor, cozy, exactly what you saved "${save.title}" for.`,
  },
  clear_pleasant: {
    categories: ['travel', 'experience', 'restaurant'],
    vibe: 'outdoors',
    minRelevance: 0.75,
    title: (save) => `Perfect weather for "${save.title}"`,
    message: (save) => `Clear skies, ideal day for "${save.title}".`,
  },
  hot: {
    categories: ['cafe', 'restaurant', 'shopping'],
    vibe: 'cooling indoor',
    minRelevance: 0.70,
    title: (save) => `Beat the heat at "${save.title}"`,
    message: (save) => `It's hot out — "${save.title}" is air-conditioned and waiting.`,
  },
  cold: {
    categories: ['cafe', 'restaurant', 'travel'],
    vibe: 'warming',
    minRelevance: 0.72,
    title: (save) => `Warm up at "${save.title}"`,
    message: (save) => `Chilly out — perfect time for "${save.title}".`,
  },
};

async function evaluate(userId, context = {}, userPersona = null) {
  try {
    const { userLocation } = context;
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      return [];
    }

    const weather = await getWeather(userLocation);
    if (!weather) return [];

    const condition = classifyCondition(weather);
    const rule = WEATHER_RULES[condition];
    if (!rule) return [];

    const matchingSaves = await Save.find({
      userId,
      status: 'active',
      category: { $in: rule.categories },
      'engagement.visited': { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(8);

    return matchingSaves.map((save) => ({
      type: 'weather_aware',
      category: save.category,
      title: rule.title(save),
      message: rule.message(save),
      relatedSaveId: save._id,
      priority: 'medium',
      relevanceScore: computeRelevance(rule.minRelevance, weather, save),
      metadata: {
        weatherCondition: condition,
        temperatureC: weather.temperature,
        precipitation: weather.precipitation,
        weatherMatch: true,
        contextMatch: true,
        triggerVibe: rule.vibe,
        userPersona: 'context_responsive',
      },
      actionUrl: `/saves/${save._id}`,
    }));
  } catch (error) {
    logger.error(`Weather-aware evaluation failed: ${error.message}`);
    return [];
  }
}

/**
 * Fetch current weather from Open-Meteo. Free, no API key, fast.
 * https://open-meteo.com/en/docs
 */
async function getWeather({ lat, lng }) {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = WEATHER_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.weather;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast`;
    const { data } = await axios.get(url, {
      params: {
        latitude: lat,
        longitude: lng,
        current: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
        timezone: 'auto',
      },
      timeout: 5000,
    });

    if (!data || !data.current) return null;

    const weather = {
      temperature: data.current.temperature_2m,
      precipitation: data.current.precipitation,
      weatherCode: data.current.weather_code,
      windSpeed: data.current.wind_speed_10m,
    };

    WEATHER_CACHE.set(cacheKey, { fetchedAt: Date.now(), weather });
    return weather;
  } catch (err) {
    logger.warn(`Weather fetch failed: ${err.message}`);
    return null;
  }
}

/**
 * Map Open-Meteo weather codes + temperature to our rule keys.
 * Weather code reference: https://open-meteo.com/en/docs (WMO codes)
 *   0=clear, 1-3=mostly clear/cloudy, 45-48=fog,
 *   51-67=drizzle/rain, 71-77=snow, 80-82=showers, 95-99=storm
 */
function classifyCondition(weather) {
  const { temperature, precipitation, weatherCode } = weather;

  // Rain / storm
  if (precipitation > 0.5 || (weatherCode >= 51 && weatherCode <= 99)) {
    return 'rain';
  }

  // Temperature-driven
  if (temperature >= 35) return 'hot';
  if (temperature <= 12) return 'cold';

  // Clear and pleasant zone: 18-32°C, low/no precipitation
  if (temperature >= 18 && temperature <= 32 && weatherCode <= 3) {
    return 'clear_pleasant';
  }

  return null;
}

function computeRelevance(base, weather, save) {
  let score = base;

  // Recently-saved items feel more relevant
  const daysSinceCreated = (Date.now() - save.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 7) score += 0.08;
  else if (daysSinceCreated < 30) score += 0.04;

  // Extreme conditions feel more urgent → boost score
  if (weather.precipitation > 5 || weather.temperature >= 38 || weather.temperature <= 5) {
    score += 0.05;
  }

  return Math.min(score, 1.0);
}

module.exports = { evaluate, classifyCondition, getWeather };
