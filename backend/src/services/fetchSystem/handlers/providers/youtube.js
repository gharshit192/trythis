const axios = require('axios');

// Free, no-auth oEmbed. Works for any public YouTube/Shorts/youtu.be URL.
const match = (u) => /(?:youtube\.com|youtu\.be)/i.test(u);

const fetch = async (url) => {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(endpoint, { timeout: 6000 });
  return {
    title: data.title || null,
    description: data.author_name ? `By ${data.author_name}` : null,
    image: data.thumbnail_url || null,
    author: data.author_name || null,
    authorUrl: data.author_url || null,
    provider: 'youtube',
    raw: data,
  };
};

module.exports = { match, fetch, name: 'youtube' };
