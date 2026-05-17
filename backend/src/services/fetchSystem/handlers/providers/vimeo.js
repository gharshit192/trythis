const axios = require('axios');

const match = (u) => /vimeo\.com/i.test(u);

const fetch = async (url) => {
  const endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(endpoint, { timeout: 6000 });
  return {
    title: data.title || null,
    description: data.description || (data.author_name ? `By ${data.author_name}` : null),
    image: data.thumbnail_url || null,
    author: data.author_name || null,
    authorUrl: data.author_url || null,
    provider: 'vimeo',
    raw: data,
  };
};

module.exports = { match, fetch, name: 'vimeo' };
