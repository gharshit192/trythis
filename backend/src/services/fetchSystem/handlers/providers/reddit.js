const axios = require('axios');

const match = (u) => /reddit\.com\/r\//i.test(u);

const fetch = async (url) => {
  // Reddit exposes JSON by appending .json — needs a polite UA
  const jsonUrl = url.replace(/\/?(\?.*)?$/, '.json$1');
  const { data } = await axios.get(jsonUrl, {
    timeout: 6000,
    headers: { 'User-Agent': 'TryThis/1.0 (intent-infra)' },
  });
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post) return null;
  return {
    title: post.title || null,
    description: post.selftext || `r/${post.subreddit} · u/${post.author}`,
    image: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : (post.url_overridden_by_dest || null),
    author: post.author || null,
    authorUrl: post.author ? `https://www.reddit.com/user/${post.author}` : null,
    provider: 'reddit',
    raw: { id: post.id, subreddit: post.subreddit, score: post.score, num_comments: post.num_comments },
  };
};

module.exports = { match, fetch, name: 'reddit' };
