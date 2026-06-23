const norm = (s) => (s || '')
  .toString()
  .toLowerCase()
  .trim()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s]/g, '')
  .replace(/\s+/g, ' ');

function buildCanonicalKey({ name, city, country }) {
  return [norm(name), norm(city), norm(country)].filter(Boolean).join('|');
}

module.exports = { norm, buildCanonicalKey };
