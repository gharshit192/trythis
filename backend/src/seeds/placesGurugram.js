// Gurugram, hand-checked (ADR 0014). Same shape as Delhi; NCR users see both.
//
//   ENV_FILE=.env.prod-local node src/seeds/placesGurugram.js
const { seedCity } = require('./lib/seedPlaces');

// [name, area, category, vibeTags, one-line take]
const PLACES = [
  // cafes + bars
  ['Roots Cafe in the Park', 'Leisure Valley Park, Sector 29', 'cafe', ['garden', 'brunch', 'quiet'], 'Cafe inside Leisure Valley park; breakfast under the trees before the sector wakes up.'],
  ['Di Ghent Cafe', 'Cross Point Mall, DLF Phase 4', 'cafe', ['belgian', 'breakfast', 'waffles'], 'Belgian breakfast in Gurugram — waffles, eggs, a proper coffee.'],
  ['Cafe Delhi Heights', 'DLF Cyber Hub', 'cafe', ['all-day', 'family', 'reliable'], 'The all-day safe bet at Cyber Hub; big menu, big portions.'],
  ['Blue Tokai Coffee Roasters', 'Golf Course Road', 'cafe', ['coffee', 'work-friendly', 'quiet'], 'Pour-over and a laptop-friendly room on Golf Course Road.'],
  ['Chaayos', 'DLF Cyber Hub', 'cafe', ['chai', 'quick', 'snacks'], 'Made-to-order chai and bun-maska between meetings.'],
  ['The Wine Company', 'DLF Cyber Hub', 'cafe', ['wine', 'terrace', 'date'], 'Wine by the glass on a terrace over the Cyber Hub plaza.'],
  ['Whisky Samba', 'Two Horizon Center, Golf Course Road', 'cafe', ['cocktails', 'upscale', 'date'], 'Cocktail bar on the Horizon Center rooftop; dress up a little.'],
  ['Molecule Air Bar', 'Sector 29', 'cafe', ['rooftop', 'drinks', 'live-music'], 'The Sector 29 rooftop with the biggest crowd and the longest menu.'],
  ['Prankster', 'Sector 29', 'cafe', ['bar', 'nostalgia', 'groups'], 'School-days-themed bar; go in a group.'],
  ['Imperfecto Shor', 'Sector 29', 'cafe', ['rooftop', 'live-music', 'drinks'], 'Live music most nights on the Sector 29 strip.'],
  // restaurants
  ['Farzi Cafe', 'DLF Cyber Hub', 'restaurant', ['modern-indian', 'cocktails', 'date'], 'Modern Indian small plates; the dal chawal arancini is the order.'],
  ['SodaBottleOpenerWala', 'DLF Cyber Hub', 'restaurant', ['parsi', 'irani-cafe', 'berry-pulao'], 'Bombay Irani cafe food — berry pulao, keema pav, raspberry soda.'],
  ['Burma Burma', 'DLF Cyber Hub', 'restaurant', ['burmese', 'vegetarian', 'khao-suey'], 'Vegetarian Burmese; the khao suey and tea-leaf salad.'],
  ['Punjab Grill', 'DLF Cyber Hub', 'restaurant', ['north-indian', 'kebabs', 'upscale'], 'Polished Punjabi; kebabs and dal for a work dinner.'],
  ['Dhaba by Claridges', 'DLF Cyber Hub', 'restaurant', ['dhaba', 'north-indian', 'family'], 'Highway-dhaba food in a Cyber Hub setting; balti meat and dal.'],
  ['Yum Yum Cha', 'DLF Cyber Hub', 'restaurant', ['asian', 'dim-sum', 'sushi'], 'Dim sum and sushi on the Cyber Hub upper level.'],
  ['Pind Balluchi', 'Sector 29', 'restaurant', ['punjabi', 'village-theme', 'family'], 'Punjabi village-themed dining; tandoori and lassi for a family table.'],
  ['Sagar Ratna', 'Sector 14 Market', 'restaurant', ['south-indian', 'dosa', 'cheap'], 'Dependable dosa and filter coffee in Sector 14.'],
  ['Bikanervala', 'Sector 29', 'restaurant', ['sweets', 'chaat', 'family'], 'Sweets, chaat and thali; the Sector 29 outlet is the big one.'],
  // street food + sweets
  ['Om Sweets & Snacks', 'Sector 14 Market', 'street_food', ['chaat', 'sweets', 'breakfast'], 'Gurugram\'s own sweet-shop chain; chole bhature in the morning.'],
  ['Nathu\'s Sweets', 'Sector 14 Market', 'street_food', ['sweets', 'chaat', 'old-favourite'], 'Delhi\'s Nathu\'s in Sector 14; kachori and mithai.'],
  ['Sadar Bazaar Chaat Lane', 'Sadar Bazaar, Old Gurugram', 'street_food', ['chaat', 'old-gurgaon', 'evening'], 'The evening chaat carts in Old Gurugram\'s main bazaar.'],
  // malls + stores
  ['Ambience Mall', 'NH-8, Ambience Island', 'shopping', ['mall', 'brands', 'huge'], 'The kilometre-long mall on the highway; every brand, PVR, a bowling alley.'],
  ['DLF CyberHub', 'Cyber City', 'shopping', ['restaurants', 'bars', 'evening'], 'Restaurant-and-bar quarter of Cyber City; the evening plan for half the city.'],
  ['DLF Mega Mall', 'Golf Course Road', 'shopping', ['mall', 'restaurants', 'quiet'], 'Smaller Golf Course Road mall; restaurants more than shops.'],
  ['South Point Mall', 'Golf Course Road', 'shopping', ['mall', 'cafes', 'neighbourhood'], 'Neighbourhood mall; cafes and a few brands.'],
  ['Cross Point Mall', 'DLF Phase 4', 'shopping', ['mall', 'cafes', 'compact'], 'Compact DLF Phase 4 mall; Di Ghent and a supermarket.'],
  ['MGF Metropolitan Mall', 'MG Road', 'shopping', ['mall', 'mg-road', 'cinema'], 'One of the original MG Road malls; cinema and mid-range brands.'],
  ['Sahara Mall', 'MG Road', 'shopping', ['mall', 'nightlife', 'old'], 'The MG Road old-timer, known now for its clubs.'],
  ['Airia Mall', 'Sector 68', 'shopping', ['mall', 'sohna-road', 'family'], 'Sohna Road\'s big mall; family weekends.'],
  ['Worldmark Gurugram', 'Sector 65', 'shopping', ['restaurants', 'offices', 'evening'], 'Office towers with a restaurant plaza; quieter than Cyber Hub.'],
  ['Galleria Market', 'DLF Phase 4', 'market', ['open-air', 'cafes', 'boutiques'], 'Open-air market of cafes, bakeries and boutiques — Gurugram\'s Khan Market.'],
  ['Sector 14 Market', 'Sector 14', 'market', ['old-gurgaon', 'food', 'bargain'], 'The old-town market; sweets, tailors, cheap everything.'],
  ['Arjun Marg Market', 'DLF Phase 1', 'market', ['neighbourhood', 'restaurants', 'quiet'], 'Neighbourhood market with good restaurants and no crowds.'],
  ['Sector 29 Market', 'Sector 29', 'market', ['nightlife', 'rooftops', 'restaurants'], 'The bar-and-restaurant strip; every rooftop in the city is here.'],
  ['Sadar Bazaar', 'Old Gurugram', 'market', ['bazaar', 'bargain', 'wholesale'], 'Old Gurugram\'s bazaar; fabric, utensils, street food.'],
  ['Fabindia', 'Ambience Mall', 'shopping', ['handloom', 'kurtas', 'home'], 'The Ambience Mall Fabindia; kurtas and home.'],
  ['Om Book Shop', 'Ambience Mall', 'shopping', ['bookshop', 'stationery', 'mall'], 'Proper bookshop inside Ambience Mall.'],
  // experiences
  ['Sultanpur National Park', 'Sultanpur, Gurugram–Jhajjar Road', 'experience', ['birds', 'winter', 'morning'], 'Bird sanctuary; November to February mornings for the migrants.'],
  ['Aravalli Biodiversity Park', 'Guru Dronacharya Metro', 'experience', ['walk', 'forest', 'free'], 'Restored Aravalli scrub with walking trails, ten minutes from Cyber City.'],
  ['Leisure Valley Park', 'Sector 29', 'experience', ['park', 'morning', 'free'], 'Big park with a fountain show; the Sector 29 morning walk.'],
  ['Museo Camera', 'Sector 44', 'experience', ['museum', 'photography', 'indoor'], 'Camera museum with thousands of cameras; a quiet afternoon.'],
  ['Sheetla Mata Mandir', 'Old Gurugram', 'experience', ['temple', 'heritage', 'old-gurgaon'], 'The city\'s oldest temple; busiest in the Navratri fairs.'],
  ['Damdama Lake', 'Sohna Road', 'experience', ['lake', 'day-trip', 'boating'], 'Lake day-trip off Sohna Road; boating and Aravalli views.'],
  ['Heritage Transport Museum', 'Taoru, off Gurugram–Sohna', 'experience', ['museum', 'vintage-cars', 'day-trip'], 'Vintage cars, buses and a railway saloon; an hour\'s drive, worth it.'],
  ['SkyJumper Trampoline Park', 'Sector 29', 'experience', ['kids', 'indoor', 'active'], 'Trampoline park for kids and reluctant adults.'],
  ['Smaaash', 'Sector 29', 'experience', ['gaming', 'indoor', 'groups'], 'Cricket sim, go-karts and arcade; a group evening.'],
  ['Tau Devi Lal Bio Diversity Park', 'Sector 52', 'experience', ['park', 'running', 'free'], 'The running park on the east side; quiet loops.'],
];

seedCity({ city: 'Gurugram', places: PLACES }).catch((e) => { console.error(e); process.exit(1); });
