// One city, deep (ADR 0014): a hand-checked Delhi list for Explore's "near
// you" and "popular" before organic saves fill them in.
//
//   ENV_FILE=.env.prod-local node src/seeds/placesDelhi.js
//
// Idempotent: keyed on canonicalKey; re-running updates the take and tags.
const { seedCity } = require('./lib/seedPlaces');

// [name, area, category, vibeTags, one-line take]
const PLACES = [
  // cafes
  ['Blue Tokai Coffee Roasters', 'Champa Gali, Saidulajab', 'cafe', ['coffee', 'work-friendly', 'quiet'], 'The roastery cafe in the lane; pour-over and a courtyard that stays quiet on weekdays.'],
  ['Kunzum Books', 'M Block Market, Greater Kailash 2', 'cafe', ['bookshop', 'coffee', 'quiet'], 'A bookshop you can sit in — pay-what-you-like coffee and nobody hurries you.'],
  ['Cafe Lota', 'Crafts Museum, Pragati Maidan', 'cafe', ['regional-indian', 'breakfast', 'garden'], 'Regional Indian plates under the trees of the Crafts Museum; go for the breakfast.'],
  ['Diggin', 'Anand Lok, Chanakyapuri', 'cafe', ['garden', 'italian', 'date'], 'Fairy-lit garden cafe; pizzas and pasta, better for the setting than the speed.'],
  ['Greenr Cafe', 'Vasant Vihar', 'cafe', ['vegetarian', 'healthy', 'work-friendly'], 'Vegetarian bowls and long coffees; a laptop crowd on weekday afternoons.'],
  ['Rose Cafe', 'Saidulajab, Saket', 'cafe', ['pink', 'brunch', 'garden'], 'The pink-and-white brunch spot in Saidulajab; book on weekends.'],
  ["Elma's Bakery", 'Hauz Khas Village', 'cafe', ['cakes', 'brunch', 'english'], 'English-style bakery and brunch above the village; the cakes are the point.'],
  ['The Big Chill Cafe', 'Khan Market', 'cafe', ['dessert', 'cheesecake', 'busy'], 'Delhi\'s reference cheesecake; expect a queue at dinner.'],
  ['Indian Coffee House', 'Mohan Singh Place, Connaught Place', 'cafe', ['old-delhi', 'cheap', 'rooftop'], 'The rooftop institution — filter coffee, cutlets, and no rush since 1957.'],
  ['Jugmug Thela', 'Champa Gali, Saidulajab', 'cafe', ['chai', 'quiet', 'garden'], 'Chai and hand-made snacks at the far end of Champa Gali.'],
  ['Perch Wine & Coffee Bar', 'Khan Market', 'cafe', ['wine', 'coffee', 'date'], 'Coffee by day, wine by night, upstairs in Khan Market.'],
  ['Devans Coffee', 'Khanna Market, Lodhi Colony', 'cafe', ['coffee', 'roaster', 'old-school'], 'A 60-year-old roaster; buy beans, drink a filter coffee at the counter.'],
  ['Social', 'Hauz Khas Village', 'cafe', ['rooftop', 'lake-view', 'drinks'], 'The lake-facing terrace in the village; go at sunset.'],
  ['Coast Cafe', 'Hauz Khas Village', 'restaurant', ['rooftop', 'coastal', 'seafood'], 'Coastal Indian food two floors up; the seafood thali is the order.'],
  // restaurants + street food
  ['Karim\'s', 'Jama Masjid', 'restaurant', ['mughlai', 'old-delhi', 'legendary'], 'Mutton burra and nihari in the lane by the mosque; since 1913.'],
  ['Al Jawahar', 'Jama Masjid', 'restaurant', ['mughlai', 'old-delhi', 'nihari'], 'Karim\'s neighbour; many locals prefer its nihari and korma.'],
  ['Moti Mahal', 'Daryaganj', 'restaurant', ['butter-chicken', 'heritage', 'north-indian'], 'Where butter chicken and dal makhani were born.'],
  ['Andhra Bhavan', 'Ashoka Road', 'restaurant', ['thali', 'south-indian', 'cheap'], 'The unlimited Andhra thali at government prices; go before 1pm.'],
  ['Saravana Bhavan', 'Janpath', 'restaurant', ['south-indian', 'dosa', 'vegetarian'], 'Reliable dosa and filter coffee opposite Janpath market.'],
  ['Kake Da Hotel', 'Connaught Place', 'restaurant', ['punjabi', 'butter-chicken', 'cheap'], 'Butter chicken and dal on a shared table since 1931.'],
  ['Khan Chacha', 'Khan Market', 'street_food', ['kebab', 'roll', 'quick'], 'The mutton kakori roll from a counter; eat it standing.'],
  ['Naivedyam', 'Hauz Khas Village', 'restaurant', ['south-indian', 'vegetarian', 'temple'], 'South Indian in a temple-style room; the rasam arrives first.'],
  ['Paranthe Wali Gali', 'Chandni Chowk', 'street_food', ['paratha', 'old-delhi', 'breakfast'], 'Stuffed parathas fried in ghee since the 1870s; go before noon.'],
  ['Natraj Dahi Bhalle Wala', 'Chandni Chowk', 'street_food', ['chaat', 'dahi-bhalla', 'old-delhi'], 'One thing, done since 1940: dahi bhalla and aloo tikki.'],
  ['Old Famous Jalebi Wala', 'Chandni Chowk', 'street_food', ['jalebi', 'sweet', 'old-delhi'], 'Thick jalebis fried in desi ghee at the Dariba corner.'],
  ['Sita Ram Diwan Chand', 'Paharganj', 'street_food', ['chole-bhature', 'breakfast', 'legendary'], 'Delhi\'s benchmark chole bhature; it runs out.'],
  ['Dolma Aunty Momos', 'Lajpat Nagar', 'street_food', ['momos', 'cheap', 'tibetan'], 'The stall that started Delhi\'s momo habit in 1994.'],
  ['Kuremal Mohan Lal Kulfi Wale', 'Chawri Bazar', 'street_food', ['kulfi', 'dessert', 'old-delhi'], 'Stuffed fruit kulfi — a whole mango or pomegranate, frozen.'],
  ['Haldiram\'s', 'Chandni Chowk', 'restaurant', ['chaat', 'sweets', 'family'], 'The big, clean chaat stop when Old Delhi queues are too much.'],
  ['Bikanervala', 'Connaught Place', 'restaurant', ['sweets', 'chaat', 'family'], 'Sweets and thali in CP; reliable rather than exciting.'],
  // malls
  ['Select Citywalk', 'Saket', 'shopping', ['mall', 'brands', 'cinema'], 'The mall Delhi actually goes to; brands, PVR, and the Sunday plaza.'],
  ['DLF Promenade', 'Vasant Kunj', 'shopping', ['mall', 'brands', 'quieter'], 'The calmer of the Vasant Kunj malls, connected to Emporio.'],
  ['DLF Emporio', 'Vasant Kunj', 'shopping', ['mall', 'luxury', 'designer'], 'Luxury and Indian designer labels under one roof.'],
  ['Ambience Mall', 'Vasant Kunj', 'shopping', ['mall', 'brands', 'food-court'], 'Big-box mall with the widest brand spread in south Delhi.'],
  ['DLF Avenue', 'Saket', 'shopping', ['mall', 'restaurants', 'cinema'], 'Across from Citywalk; restaurants and a quieter cinema.'],
  ['Pacific Mall', 'Tagore Garden', 'shopping', ['mall', 'west-delhi', 'family'], 'West Delhi\'s main mall; cinema, food court, weekend crowds.'],
  ['Vegas Mall', 'Dwarka', 'shopping', ['mall', 'dwarka', 'family'], 'Dwarka\'s big mall; easier parking than the south Delhi ones.'],
  // markets + stores
  ['Dilli Haat', 'INA', 'market', ['handloom', 'state-food', 'crafts'], 'Craft stalls from every state and their food; ₹30 entry.'],
  ['Khan Market', 'Khan Market', 'market', ['bookshops', 'cafes', 'upscale'], 'Bookshops, boutiques and cafes in a horseshoe; pricey but walkable.'],
  ['Sarojini Nagar Market', 'Sarojini Nagar', 'market', ['bargain', 'export-surplus', 'fashion'], 'Export-surplus fashion at ₹100–500; bargain hard, go on a weekday.'],
  ['Janpath Market', 'Janpath', 'market', ['bargain', 'jewellery', 'tibetan'], 'Silver, kurtas and the Tibetan stalls along Janpath.'],
  ['Lajpat Nagar Central Market', 'Lajpat Nagar', 'market', ['fabric', 'wedding', 'bargain'], 'Fabric, wedding shopping and mehendi ladies; chaotic and complete.'],
  ['Chandni Chowk', 'Old Delhi', 'market', ['old-delhi', 'wholesale', 'street-food'], 'The original bazaar — spices, silver, saris, and the food lanes.'],
  ['Sadar Bazaar', 'Old Delhi', 'market', ['wholesale', 'decor', 'bargain'], 'Wholesale everything; decor and party supplies at trade prices.'],
  ['Ghaffar Market', 'Karol Bagh', 'market', ['electronics', 'bargain', 'phones'], 'Phones, gadgets and their accessories at Karol Bagh prices.'],
  ['Shahpur Jat', 'Shahpur Jat', 'market', ['designer', 'boutiques', 'lanes'], 'Designer boutiques inside an urban village; wander the lanes.'],
  ['Champa Gali', 'Saidulajab', 'market', ['lane', 'cafes', 'boutiques'], 'One lane of cafes and studios; Delhi\'s smallest neighbourhood.'],
  ['Hauz Khas Village', 'Hauz Khas', 'market', ['lake', 'cafes', 'nightlife'], 'Cafes, bars and boutiques wrapped around a 14th-century reservoir.'],
  ['Meharchand Market', 'Lodhi Colony', 'market', ['designer', 'cafes', 'upscale'], 'Designer stores and cafes on one quiet Lodhi Colony road.'],
  ['Nehru Place', 'Nehru Place', 'market', ['electronics', 'computers', 'repairs'], 'Asia\'s computer market; parts, repairs and pirated everything.'],
  ['Majnu ka Tilla', 'Majnu ka Tilla', 'market', ['tibetan', 'momos', 'lanes'], 'The Tibetan colony — momos, thukpa, and winter wear.'],
  ['Kamla Nagar Market', 'Kamla Nagar', 'market', ['student', 'bargain', 'street-food'], 'North campus\'s market; cheap clothes and better street food.'],
  ['Fabindia', 'Khan Market', 'shopping', ['handloom', 'kurtas', 'home'], 'The Khan Market flagship; kurtas, linen and home.'],
  ['Good Earth', 'Khan Market', 'shopping', ['home', 'design', 'luxury'], 'Indian design for the home at the top end.'],
  ['Anokhi', 'Khan Market', 'shopping', ['block-print', 'kurtas', 'jaipur'], 'Jaipur block-print clothing and linen.'],
  ['Bahrisons Booksellers', 'Khan Market', 'shopping', ['bookshop', 'independent', 'since-1953'], 'Delhi\'s independent bookshop since 1953; staff who actually read.'],
  ['Full Circle Bookstore', 'Khan Market', 'shopping', ['bookshop', 'cafe', 'upstairs'], 'Bookshop with Cafe Turtle upstairs.'],
  // experiences + heritage
  ['Lodhi Art District', 'Lodhi Colony', 'experience', ['street-art', 'walk', 'free'], 'India\'s first open-air art district; walk the blocks between Khanna and Meharchand markets.'],
  ['Sunder Nursery', 'Nizamuddin', 'experience', ['garden', 'picnic', 'heritage'], 'Restored Mughal garden next to Humayun\'s Tomb; picnics and Sunday markets.'],
  ['Humayun\'s Tomb', 'Nizamuddin', 'experience', ['heritage', 'mughal', 'unesco'], 'The tomb that inspired the Taj; best in the first hour after opening.'],
  ['Qutub Minar', 'Mehrauli', 'experience', ['heritage', 'unesco', 'sunset'], 'The 12th-century minaret; combine with Mehrauli Archaeological Park.'],
  ['Mehrauli Archaeological Park', 'Mehrauli', 'experience', ['heritage', 'walk', 'free'], 'A hundred monuments in a forest park, almost no crowds.'],
  ['Lotus Temple', 'Kalkaji', 'experience', ['architecture', 'quiet', 'free'], 'The Bahá\'í house of worship; silence inside is the rule.'],
  ['India Gate', 'Rajpath', 'experience', ['landmark', 'evening', 'free'], 'The war memorial on the axis; evenings are the crowd.'],
  ['Hauz Khas Fort & Deer Park', 'Hauz Khas', 'experience', ['heritage', 'park', 'lake'], 'Tughlaq-era madrasa on the lake, with a deer park behind.'],
  ['Garden of Five Senses', 'Saidulajab', 'experience', ['garden', 'sculpture', 'date'], 'Landscaped garden with sculpture and amphitheatre; ₹35 entry.'],
  ['Kiran Nadar Museum of Art', 'Saket', 'experience', ['art', 'museum', 'free'], 'Free modern and contemporary Indian art, inside a mall.'],
  ['National Rail Museum', 'Chanakyapuri', 'experience', ['museum', 'kids', 'trains'], 'Vintage locomotives and a toy train; kids\' favourite.'],
  ['Akshardham', 'Noida Mor', 'experience', ['temple', 'architecture', 'evening-show'], 'The giant temple complex; no phones inside, evening water show.'],
  ['Jama Masjid', 'Old Delhi', 'experience', ['mosque', 'heritage', 'minaret'], 'Climb the minaret for the Old Delhi rooftops.'],
  ['Red Fort', 'Old Delhi', 'experience', ['heritage', 'unesco', 'mughal'], 'The Mughal seat; the museums inside are newer than the walls.'],
  ['Agrasen ki Baoli', 'Connaught Place', 'experience', ['stepwell', 'heritage', 'free'], 'A stepwell hidden behind CP; ten minutes, worth it.'],
  ['Nizamuddin Dargah', 'Nizamuddin', 'experience', ['qawwali', 'sufi', 'thursday'], 'Thursday-evening qawwali at the Sufi shrine.'],
  ['Lodhi Garden', 'Lodhi Road', 'experience', ['park', 'tombs', 'morning'], 'Tombs among the joggers; the best morning walk in the city.'],
  ['Sanjay Van', 'Vasant Kunj', 'experience', ['forest', 'birding', 'walk'], 'Ridge forest with ruins and birds; go with someone.'],
];

seedCity({ city: 'Delhi', places: PLACES }).catch((e) => { console.error(e); process.exit(1); });
