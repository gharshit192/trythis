const logger = require('../utils/logger');

// Known Indian cities and popular travel destinations
const KNOWN_LOCATIONS = {
  'goa': { city: 'Goa', state: 'Goa', country: 'India', lat: 15.2993, lng: 73.8243 },
  'gurugram': { city: 'Gurugram', state: 'Haryana', country: 'India', lat: 28.4595, lng: 77.0266 },
  'delhi': { city: 'Delhi', state: 'Delhi', country: 'India', lat: 28.7041, lng: 77.1025 },
  'mumbai': { city: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.0760, lng: 72.8777 },
  'bangalore': { city: 'Bangalore', state: 'Karnataka', country: 'India', lat: 12.9716, lng: 77.5946 },
  'hyderabad': { city: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.3850, lng: 78.4867 },
  'pune': { city: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lng: 73.8567 },
  'jaipur': { city: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lng: 75.7873 },
  'kolkata': { city: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lng: 88.3639 },
  'ahmedabad': { city: 'Ahmedabad', state: 'Gujarat', country: 'India', lat: 23.0225, lng: 72.5714 },
  'lucknow': { city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.8467, lng: 80.9462 },
  'chandigarh': { city: 'Chandigarh', state: 'Chandigarh', country: 'India', lat: 30.7333, lng: 76.7794 },
  'dubai': { city: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  'london': { city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  'paris': { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  'bangkok': { city: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
  'singapore': { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  'tokyo': { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  'new york': { city: 'New York', state: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060 },
  'bali': { city: 'Bali', country: 'Indonesia', lat: -8.6705, lng: 115.2126 }
};

/**
 * Extract location from text using keyword matching.
 * Returns { name, city, country, lat, lng, source } or null if not found.
 */
async function extractLocation(text) {
  if (!text) return null;

  try {
    // Normalize text: lowercase, remove punctuation
    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ');

    // Search for known locations
    for (const [key, location] of Object.entries(KNOWN_LOCATIONS)) {
      // Word boundary matching: ensure we match whole words, not substrings
      const wordRegex = new RegExp(`\\b${key}\\b`, 'i');
      if (wordRegex.test(normalizedText)) {
        return {
          name: location.city,
          city: location.city,
          country: location.country,
          state: location.state || undefined,
          lat: location.lat,
          lng: location.lng,
          source: 'keyword_match'
        };
      }
    }

    return null;
  } catch (err) {
    logger.warn(`[locationExtractor] Error extracting location: ${err.message}`);
    return null;
  }
}

module.exports = {
  extractLocation
};
