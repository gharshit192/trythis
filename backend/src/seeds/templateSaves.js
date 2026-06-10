require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const Save = require('../models/Save');

const TEMPLATE_SAVES = [
  {
    title: 'Goa 3 Day Perfect Itinerary',
    description: 'Beaches, sunset cafés, night markets — fully planned',
    source: 'manual',
    contentType: 'article',
    category: 'travel',
    tags: ['goa', 'beach', 'travel', 'itinerary', 'weekend trip'],
    isTemplate: true,
    processingStatus: 'done',
    confidence: 0.95,
    aiAnalysis: {
      summary: 'A 3-day Goa itinerary covering North Goa beaches, Anjuna flea market, Panjim heritage walk, and best sunset spots.',
      keyPoints: [
        'Day 1: Calangute, Baga Beach, beach shacks',
        'Day 2: Anjuna flea market, Vagator cliff',
        'Day 3: Panjim heritage, Miramar Beach',
        'Best season: November to February',
        'Budget: ₹8,000–15,000 for 3 days',
      ],
      structuredData: {
        type: 'itinerary',
        itinerary: {
          destination: 'Goa',
          duration: '3 days',
          bestSeason: 'November–February',
          estimatedCost: '₹8,000–15,000',
          highlights: ['Calangute Beach', 'Anjuna Market', 'Panjim', 'Vagator'],
        },
      },
    },
  },
  {
    title: 'Hidden Café in Hauz Khas, Delhi',
    description: 'Rooftop café with fort views, specialty coffee, and all-day brunch',
    source: 'manual',
    contentType: 'article',
    category: 'food',
    tags: ['cafe', 'delhi', 'coffee', 'rooftop', 'aesthetic', 'laptop friendly'],
    isTemplate: true,
    processingStatus: 'done',
    confidence: 0.95,
    aiAnalysis: {
      summary: 'A tucked-away rooftop café in Hauz Khas Village overlooking the historic fort, serving specialty coffee and brunch from 9AM–10PM.',
      keyPoints: [
        'Location: Hauz Khas Village, Delhi',
        'Open 9AM–10PM, all days',
        'Specialty coffee starting ₹180',
        'Rooftop seating with fort view',
        'Laptop friendly, good WiFi',
      ],
      structuredData: {
        type: 'place',
        place: {
          name: 'Hauz Khas Rooftop Café',
          city: 'Delhi',
        },
      },
    },
  },
  {
    title: 'Watermelon Mint Cooler Recipe',
    description: '5 minute summer health drink — refreshing and detoxifying',
    source: 'manual',
    contentType: 'article',
    category: 'food',
    tags: ['recipe', 'summer drink', 'healthy', 'watermelon', 'mint', '5 minutes'],
    isTemplate: true,
    processingStatus: 'done',
    confidence: 0.95,
    aiAnalysis: {
      summary: 'A quick 5-minute watermelon and mint cooler with black salt and lemon — perfect summer detox drink.',
      keyPoints: [
        'Ready in 5 minutes',
        '4 ingredients only',
        'No sugar added',
        'Best served chilled',
      ],
      structuredData: {
        type: 'recipe',
        recipe: {
          isRecipe: true,
          ingredients: ['2 cups watermelon', 'handful fresh mint', '1 lemon juiced', 'pinch black salt', 'ice cubes'],
          steps: [
            'Blend watermelon chunks until smooth',
            'Add lemon juice and black salt',
            'Blend in mint leaves',
            'Pour over ice and serve immediately',
          ],
          cookingTime: '5 minutes',
          servings: '2',
        },
      },
    },
  },
  {
    title: 'Coorg Weekend Trip — Coffee Country',
    description: "2 day escape to India's coffee capital — waterfalls, estates, misty hills",
    source: 'manual',
    contentType: 'article',
    category: 'travel',
    tags: ['coorg', 'weekend trip', 'travel', 'bangalore', 'coffee', 'hills'],
    isTemplate: true,
    processingStatus: 'done',
    confidence: 0.95,
    aiAnalysis: {
      summary: 'A 2-day Coorg itinerary covering Abbey Falls, coffee estate tours, Raja\'s Seat sunrise, and local Coorgi food.',
      keyPoints: [
        'Best for: couples, solo, friend groups',
        'Distance from Bangalore: 5 hours',
        'Best season: October to March',
        'Budget: ₹5,000–10,000 for 2 days',
        'Stay: homestays recommended',
      ],
      structuredData: {
        type: 'itinerary',
        itinerary: {
          destination: 'Coorg, Karnataka',
          duration: '2 days',
          bestSeason: 'October–March',
          estimatedCost: '₹5,000–10,000',
          highlights: ['Abbey Falls', 'Coffee Estate', "Raja's Seat", 'Namdroling Monastery'],
        },
      },
    },
  },
  {
    title: 'Masala Chai Recipe — Authentic Dhaba Style',
    description: 'Strong, spiced chai just like roadside dhabas make it',
    source: 'manual',
    contentType: 'article',
    category: 'food',
    tags: ['chai', 'recipe', 'masala', 'tea', 'indian', 'dhaba style'],
    isTemplate: true,
    processingStatus: 'done',
    confidence: 0.95,
    aiAnalysis: {
      summary: 'Classic dhaba-style masala chai with ginger, cardamom, and strong tea — the real recipe, not the watered-down version.',
      keyPoints: [
        'Ready in 8 minutes',
        'Strong ginger-cardamom base',
        'Adjust milk ratio to taste',
        'Serves 2',
      ],
      structuredData: {
        type: 'recipe',
        recipe: {
          isRecipe: true,
          ingredients: [
            '1.5 cups water',
            '1 cup whole milk',
            '2 tsp strong black tea leaves',
            '1 inch fresh ginger grated',
            '3 cardamom pods crushed',
            '2 tsp sugar',
          ],
          steps: [
            'Boil water with grated ginger and crushed cardamom for 2 minutes',
            'Add tea leaves and boil 1 more minute',
            'Add milk and sugar, bring to boil',
            'Simmer 3-4 minutes until deep brown',
            'Strain and serve hot',
          ],
          cookingTime: '8 minutes',
          servings: '2',
        },
      },
    },
  },
];

async function seed() {
  const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/trythis';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  let systemUser = await User.findOne({ email: 'system@trythis.app' });
  if (!systemUser) {
    systemUser = await User.create({
      email: 'system@trythis.app',
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
      name: 'TryThis System',
    });
    console.log('Created system user');
  } else {
    console.log('System user already exists');
  }

  for (const tmpl of TEMPLATE_SAVES) {
    const exists = await Save.findOne({ userId: systemUser._id, title: tmpl.title, isTemplate: true });
    if (!exists) {
      await Save.create({ ...tmpl, userId: systemUser._id });
      console.log(`Created: ${tmpl.title}`);
    } else {
      console.log(`Exists:  ${tmpl.title}`);
    }
  }

  const count = await Save.countDocuments({ isTemplate: true });
  console.log(`\nDone — ${count} template save(s) in DB`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
