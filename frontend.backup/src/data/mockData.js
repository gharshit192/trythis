export const saves = [
  {
    id: '1',
    title: 'Beach Cafe in Goa',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
    intent: 'Visit',
    source: 'Instagram',
    location: 'North Goa',
    price: '₹1200 approx',
    tags: ['Beach', 'Cafe', 'Sunset', 'Weekend'],
    notes: 'Perfect sunset place for a weekend trip.'
  },
  {
    id: '2',
    title: 'Minimal White Sneakers',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    intent: 'Buy',
    source: 'TikTok',
    location: 'Online',
    price: '₹3999',
    tags: ['Sneakers', 'Fashion', 'Deal'],
    notes: 'Check size availability before buying.'
  },
  {
    id: '3',
    title: 'Pottery Workshop',
    image: 'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9',
    intent: 'Experience',
    source: 'Web',
    location: 'Bangalore',
    price: '₹1800',
    tags: ['Workshop', 'Creative', 'Weekend'],
    notes: 'Good for date night or solo activity.'
  }
];

export const collections = [
  { id: 'c1', name: 'Goa Trip', count: 24, images: saves.map((s) => s.image) },
  { id: 'c2', name: 'Things To Buy', count: 16, images: [saves[1].image] },
  { id: 'c3', name: 'Date Night Ideas', count: 9, images: [saves[2].image, saves[0].image] }
];
