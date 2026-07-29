const planEngine = require('../../src/services/planEngine');

const { buildDayRouteLink, uniquePlacesFromPlan } = planEngine.__test__;

describe('planEngine day planner helpers', () => {
  test('dedupes places from explicit places and daily stops', () => {
    const places = uniquePlacesFromPlan({
      places: [{ name: 'Dawki', type: 'river' }],
      daily_plan: [{ stops: [{ place: 'Dawki' }, { place: 'Mawlynnong' }] }],
    }, 'Meghalaya');
    expect(places.map((p) => p.name)).toEqual(['Dawki', 'Mawlynnong']);
  });

  test('builds route links with coordinates when available', () => {
    const map = new Map([
      ['dawki', { lat: 25.184, lng: 92.017 }],
      ['mawlynnong', { lat: 25.202, lng: 91.916 }],
    ]);
    expect(buildDayRouteLink([{ place: 'Dawki' }, { place: 'Mawlynnong' }], map))
      .toBe('https://www.google.com/maps/dir/25.184%2C92.017/25.202%2C91.916');
  });
});
