const { classifyByDomain, classifyByDomainFull } = require('../../src/services/extractionEngine/domainClassifier');

describe('classifyByDomain', () => {
  it.each([
    // Food
    ['https://www.zomato.com/bangalore/third-wave-coffee-roasters-3-indiranagar', 'cafes'],
    ['https://www.zomato.com/bangalore/toit-indiranagar', 'restaurants'],
    ['https://www.swiggy.com/restaurants/social-koramangala-bangalore-50286', 'restaurants'],
    ['https://www.archanaskitchen.com/recipes/dal-makhani-recipe', 'recipes'],

    // Hotels (must beat the generic travel rule)
    ['https://www.airbnb.co.in/rooms/12345678', 'hotels'],
    ['https://www.booking.com/hotel/in/posh-pebbles-goa.html', 'hotels'],
    ['https://www.thepostcardhotel.com/the-postcard-on-the-arabian-sea', 'hotels'],
    ['https://www.makemytrip.com/hotels/hotel-listing/?checkin=11242026&city=CTGOI', 'hotels'],
    ['https://www.airbnb.co.in/s/experiences/Bengaluru', 'experiences'],

    // Travel guides
    ['https://www.tripoto.com/trip/tirthan-valley-himachal-pradesh-travel-guide', 'travel'],
    ['https://www.lonelyplanet.com/india/meghalaya', 'travel'],
    ['https://www.makemytrip.com/blog/best-places-visit-spiti-valley', 'travel'],

    // Shopping subcategories
    ['https://nicobar.com/collections/women', 'fashion'],
    ['https://nicobar.com/collections/home', 'home-decor'],
    ['https://urbanladder.com/products/heath-2-seater-sofa-charcoal-grey', 'home-decor'],
    ['https://www.amazon.in/Apple-MacBook-Air-13-3-inch-Display/dp/B0CX23V2ZK', 'tech'],
    ['https://store.dji.com/in/product/osmo-pocket-3', 'tech'],
    ['https://www.keychron.com/products/keychron-q1-pro', 'tech'],
    ['https://www.amazon.in/gp/bestsellers', 'shopping'],
    ['https://www.flipkart.com/offers-list/top-deals', 'shopping'],

    // Health
    ['https://www.youtube.com/@yogawithadriene', 'fitness'],
    ['https://www.cult.fit/live/yoga', 'fitness'],
    ['https://www.headspace.com/meditation/sleep', 'wellness'],
    ['https://www.calm.com/', 'wellness'],

    // Growth
    ['https://www.notion.so/templates', 'productivity'],
    ['https://todoist.com/', 'productivity'],
    ['https://www.coursera.org/learn/machine-learning', 'learning'],
    ['https://www.youtube.com/@3blue1brown', 'learning'],
    ['https://www.ycombinator.com/library/4A-a-guide-to-seed-fundraising', 'startups'],
    ['https://news.ycombinator.com/', 'startups'],
    ['https://www.paulgraham.com/ds.html', 'startups'],

    // Finance
    ['https://groww.in/mutual-funds/category/best-flexi-cap-mutual-funds', 'finance'],
    ['https://zerodha.com/varsity/', 'finance'],

    // Events
    ['https://insider.in/events', 'events'],
    ['https://in.bookmyshow.com/explore/home/bengaluru', 'events'],

    // Experiences
    ['https://www.thrillophilia.com/cities/bangalore', 'experiences'],
    ['https://www.tripoto.com/experiences/pottery-workshops-bangalore', 'experiences'],

    // Entertainment
    ['https://www.netflix.com/in/title/81002370', 'entertainment'],
    ['https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy', 'entertainment'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'entertainment'],
  ])('%s → %s', (url, expected) => {
    expect(classifyByDomain(url)).toBe(expected);
  });

  it('returns null for unknown domains', () => {
    expect(classifyByDomain('https://random-blog.example.com/post')).toBeNull();
  });

  it('returns null for missing url', () => {
    expect(classifyByDomain(null)).toBeNull();
    expect(classifyByDomain(undefined)).toBeNull();
    expect(classifyByDomain('')).toBeNull();
  });
});

describe('classifyByDomainFull', () => {
  it('maps Zomato cafe URL to extractor=cafes + category=food', () => {
    const r = classifyByDomainFull('https://www.zomato.com/bangalore/third-wave-coffee-roasters');
    expect(r.extractor).toBe('cafes');
    expect(r.category).toBe('food');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it('maps Airbnb stay URL to extractor=hotels + category=travel', () => {
    const r = classifyByDomainFull('https://www.airbnb.co.in/rooms/99999');
    expect(r.extractor).toBe('hotels');
    expect(r.category).toBe('travel');
  });
  it('returns nulls when no rule matches', () => {
    const r = classifyByDomainFull('https://unknown.example.com');
    expect(r.extractor).toBeNull();
    expect(r.category).toBeNull();
    expect(r.confidence).toBe(0);
  });
});
