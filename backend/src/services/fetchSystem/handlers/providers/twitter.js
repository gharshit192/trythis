const axios = require('axios');

const match = (u) => /(?:twitter\.com|x\.com)/i.test(u);

const fetch = async (url) => {
  const endpoint = `https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(endpoint, { timeout: 6000 });
  // Twitter oembed returns the tweet HTML; strip tags for a plain description.
  const stripped = (data.html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return {
    title: stripped ? stripped.slice(0, 140) : (data.author_name ? `Tweet by ${data.author_name}` : 'Tweet'),
    description: stripped || null,
    image: null, // Twitter oembed doesn't include a thumbnail
    author: data.author_name || null,
    authorUrl: data.author_url || null,
    provider: 'twitter',
    raw: data,
  };
};

module.exports = { match, fetch, name: 'twitter' };
