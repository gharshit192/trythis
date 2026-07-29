const logger = require('../utils/logger');

// Known cities and popular travel destinations. `aliases` covers alternate
// spellings AND Devanagari names — an India-first app must match "गोवा" as
// well as "Goa", otherwise Hindi saves never get a location and every
// location-based trigger silently skips them.
const KNOWN_LOCATIONS = [
  // Indian metros
  { key: 'goa', aliases: ['गोवा'], city: 'Goa', state: 'Goa', country: 'India', lat: 15.2993, lng: 73.8243 },
  { key: 'gurugram', aliases: ['gurgaon', 'गुरुग्राम', 'गुड़गांव'], city: 'Gurugram', state: 'Haryana', country: 'India', lat: 28.4595, lng: 77.0266 },
  { key: 'delhi', aliases: ['new delhi', 'दिल्ली'], city: 'Delhi', state: 'Delhi', country: 'India', lat: 28.7041, lng: 77.1025 },
  { key: 'mumbai', aliases: ['bombay', 'मुंबई'], city: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.0760, lng: 72.8777 },
  { key: 'bangalore', aliases: ['bengaluru', 'बैंगलोर', 'बेंगलुरु'], city: 'Bangalore', state: 'Karnataka', country: 'India', lat: 12.9716, lng: 77.5946 },
  { key: 'hyderabad', aliases: ['हैदराबाद'], city: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.3850, lng: 78.4867 },
  { key: 'pune', aliases: ['पुणे'], city: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lng: 73.8567 },
  { key: 'jaipur', aliases: ['जयपुर'], city: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lng: 75.7873 },
  { key: 'kolkata', aliases: ['calcutta', 'कोलकाता'], city: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lng: 88.3639 },
  { key: 'ahmedabad', aliases: ['अहमदाबाद'], city: 'Ahmedabad', state: 'Gujarat', country: 'India', lat: 23.0225, lng: 72.5714 },
  { key: 'chennai', aliases: ['madras', 'चेन्नई'], city: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lng: 80.2707 },
  { key: 'lucknow', aliases: ['लखनऊ'], city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.8467, lng: 80.9462 },
  { key: 'chandigarh', aliases: ['चंडीगढ़'], city: 'Chandigarh', state: 'Chandigarh', country: 'India', lat: 30.7333, lng: 76.7794 },
  { key: 'indore', aliases: ['इंदौर'], city: 'Indore', state: 'Madhya Pradesh', country: 'India', lat: 22.7196, lng: 75.8577 },
  { key: 'bhopal', aliases: ['भोपाल'], city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', lat: 23.2599, lng: 77.4126 },
  { key: 'patna', aliases: ['पटना'], city: 'Patna', state: 'Bihar', country: 'India', lat: 25.5941, lng: 85.1376 },
  { key: 'surat', aliases: ['सूरत'], city: 'Surat', state: 'Gujarat', country: 'India', lat: 21.1702, lng: 72.8311 },
  { key: 'nagpur', aliases: ['नागपुर'], city: 'Nagpur', state: 'Maharashtra', country: 'India', lat: 21.1458, lng: 79.0882 },
  { key: 'noida', aliases: ['नोएडा'], city: 'Noida', state: 'Uttar Pradesh', country: 'India', lat: 28.5355, lng: 77.3910 },

  // Indian travel destinations
  { key: 'udaipur', aliases: ['उदयपुर'], city: 'Udaipur', state: 'Rajasthan', country: 'India', lat: 24.5854, lng: 73.7125 },
  { key: 'jodhpur', aliases: ['जोधपुर'], city: 'Jodhpur', state: 'Rajasthan', country: 'India', lat: 26.2389, lng: 73.0243 },
  { key: 'jaisalmer', aliases: ['जैसलमेर'], city: 'Jaisalmer', state: 'Rajasthan', country: 'India', lat: 26.9157, lng: 70.9083 },
  { key: 'pushkar', aliases: ['पुष्कर'], city: 'Pushkar', state: 'Rajasthan', country: 'India', lat: 26.4897, lng: 74.5511 },
  { key: 'rishikesh', aliases: ['ऋषिकेश'], city: 'Rishikesh', state: 'Uttarakhand', country: 'India', lat: 30.0869, lng: 78.2676 },
  { key: 'haridwar', aliases: ['हरिद्वार'], city: 'Haridwar', state: 'Uttarakhand', country: 'India', lat: 29.9457, lng: 78.1642 },
  { key: 'nainital', aliases: ['नैनीताल'], city: 'Nainital', state: 'Uttarakhand', country: 'India', lat: 29.3919, lng: 79.4542 },
  { key: 'mussoorie', aliases: ['मसूरी'], city: 'Mussoorie', state: 'Uttarakhand', country: 'India', lat: 30.4598, lng: 78.0644 },
  { key: 'manali', aliases: ['मनाली'], city: 'Manali', state: 'Himachal Pradesh', country: 'India', lat: 32.2396, lng: 77.1887 },
  { key: 'shimla', aliases: ['शिमला'], city: 'Shimla', state: 'Himachal Pradesh', country: 'India', lat: 31.1048, lng: 77.1734 },
  { key: 'kasol', aliases: ['कसोल'], city: 'Kasol', state: 'Himachal Pradesh', country: 'India', lat: 32.0100, lng: 77.3152 },
  { key: 'dharamshala', aliases: ['dharamsala', 'mcleodganj', 'धर्मशाला'], city: 'Dharamshala', state: 'Himachal Pradesh', country: 'India', lat: 32.2190, lng: 76.3234 },
  { key: 'leh', aliases: ['ladakh', 'लेह', 'लद्दाख'], city: 'Leh', state: 'Ladakh', country: 'India', lat: 34.1526, lng: 77.5771 },
  { key: 'srinagar', aliases: ['श्रीनगर'], city: 'Srinagar', state: 'Jammu and Kashmir', country: 'India', lat: 34.0837, lng: 74.7973 },
  { key: 'varanasi', aliases: ['banaras', 'kashi', 'वाराणसी', 'बनारस', 'काशी'], city: 'Varanasi', state: 'Uttar Pradesh', country: 'India', lat: 25.3176, lng: 82.9739 },
  { key: 'agra', aliases: ['आगरा'], city: 'Agra', state: 'Uttar Pradesh', country: 'India', lat: 27.1767, lng: 78.0081 },
  { key: 'mathura', aliases: ['vrindavan', 'मथुरा', 'वृंदावन'], city: 'Mathura', state: 'Uttar Pradesh', country: 'India', lat: 27.4924, lng: 77.6737 },
  { key: 'amritsar', aliases: ['अमृतसर'], city: 'Amritsar', state: 'Punjab', country: 'India', lat: 31.6340, lng: 74.8723 },
  { key: 'kochi', aliases: ['cochin', 'कोच्चि'], city: 'Kochi', state: 'Kerala', country: 'India', lat: 9.9312, lng: 76.2673 },
  { key: 'munnar', aliases: ['मुन्नार'], city: 'Munnar', state: 'Kerala', country: 'India', lat: 10.0889, lng: 77.0595 },
  { key: 'alleppey', aliases: ['alappuzha', 'अलेप्पी'], city: 'Alleppey', state: 'Kerala', country: 'India', lat: 9.4981, lng: 76.3388 },
  { key: 'mysore', aliases: ['mysuru', 'मैसूर'], city: 'Mysore', state: 'Karnataka', country: 'India', lat: 12.2958, lng: 76.6394 },
  { key: 'ooty', aliases: ['ऊटी'], city: 'Ooty', state: 'Tamil Nadu', country: 'India', lat: 11.4102, lng: 76.6950 },
  { key: 'coorg', aliases: ['kodagu', 'कूर्ग'], city: 'Coorg', state: 'Karnataka', country: 'India', lat: 12.3375, lng: 75.8069 },
  { key: 'hampi', aliases: ['हम्पी'], city: 'Hampi', state: 'Karnataka', country: 'India', lat: 15.3350, lng: 76.4600 },
  { key: 'gokarna', aliases: ['गोकर्णा'], city: 'Gokarna', state: 'Karnataka', country: 'India', lat: 14.5479, lng: 74.3188 },
  { key: 'pondicherry', aliases: ['puducherry', 'पांडिचेरी'], city: 'Pondicherry', state: 'Puducherry', country: 'India', lat: 11.9416, lng: 79.8083 },
  { key: 'darjeeling', aliases: ['दार्जिलिंग'], city: 'Darjeeling', state: 'West Bengal', country: 'India', lat: 27.0360, lng: 88.2627 },
  { key: 'gangtok', aliases: ['गंगटोक'], city: 'Gangtok', state: 'Sikkim', country: 'India', lat: 27.3389, lng: 88.6065 },
  { key: 'lonavala', aliases: ['लोनावला'], city: 'Lonavala', state: 'Maharashtra', country: 'India', lat: 18.7546, lng: 73.4062 },
  { key: 'mahabaleshwar', aliases: ['महाबलेश्वर'], city: 'Mahabaleshwar', state: 'Maharashtra', country: 'India', lat: 17.9237, lng: 73.6586 },
  { key: 'mount abu', aliases: ['माउंट आबू'], city: 'Mount Abu', state: 'Rajasthan', country: 'India', lat: 24.5926, lng: 72.7156 },
  { key: 'port blair', aliases: ['andaman', 'अंडमान'], city: 'Port Blair', state: 'Andaman and Nicobar', country: 'India', lat: 11.6234, lng: 92.7265 },

  // International
  { key: 'dubai', aliases: ['दुबई'], city: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  { key: 'london', aliases: ['लंदन'], city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { key: 'paris', aliases: ['पेरिस'], city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { key: 'bangkok', aliases: ['बैंकॉक'], city: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
  { key: 'singapore', aliases: ['सिंगापुर'], city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { key: 'tokyo', aliases: ['टोक्यो'], city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { key: 'new york', aliases: [], city: 'New York', state: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060 },
  { key: 'bali', aliases: ['बाली'], city: 'Bali', country: 'Indonesia', lat: -8.6705, lng: 115.2126 },
  { key: 'maldives', aliases: ['मालदीव'], city: 'Maldives', country: 'Maldives', lat: 3.2028, lng: 73.2207 },
];

const toResult = (location) => ({
  name: location.city,
  city: location.city,
  country: location.country,
  state: location.state || undefined,
  lat: location.lat,
  lng: location.lng,
  source: 'keyword_match',
});

const isAscii = (s) => /^[\x00-\x7F]+$/.test(s);

// All (name → location) pairs, longest names first so "new delhi" wins over
// "delhi" and "मथुरा" doesn't shadow a longer alias.
const NAME_INDEX = KNOWN_LOCATIONS
  .flatMap((loc) => [loc.key, ...(loc.aliases || [])].map((name) => [name.toLowerCase(), loc]))
  .sort((a, b) => b[0].length - a[0].length);

/**
 * Extract location from free text (title, description, transcript, OCR).
 * ASCII names match on word boundaries; Devanagari/other scripts match as
 * substrings (JS \b is ASCII-only and never fires around Devanagari).
 * Returns { name, city, country, state, lat, lng, source } or null.
 */
async function extractLocation(text) {
  if (!text) return null;

  try {
    const normalizedText = String(text).toLowerCase();

    for (const [name, location] of NAME_INDEX) {
      const matched = isAscii(name)
        ? new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalizedText)
        : normalizedText.includes(name);
      if (matched) {
        logger.info(`[locationExtractor] Found: ${location.city} via "${name}"`);
        return toResult(location);
      }
    }

    logger.debug(`[locationExtractor] No location found in: "${String(text).substring(0, 100)}..."`);
    return null;
  } catch (err) {
    logger.warn(`[locationExtractor] Error extracting location: ${err.message}`);
    return null;
  }
}

/**
 * Look up a known location by an (already extracted) city/place name — used to
 * turn structuredData.place.city / itinerary.destination into coordinates.
 */
function findKnownLocation(name) {
  if (!name) return null;
  const q = String(name).toLowerCase().trim();
  for (const [key, location] of NAME_INDEX) {
    if (q === key || q.includes(key)) return toResult(location);
  }
  return null;
}

module.exports = {
  extractLocation,
  findKnownLocation,
};
