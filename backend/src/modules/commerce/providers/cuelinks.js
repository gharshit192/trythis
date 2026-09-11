const axios = require('axios');
const fs = require('fs');
const CONFIG_FILE = require('path').join(require('os').tmpdir(), 'wt-cuelinks-campaigns.json');

const MERCHANTS = {
  airindiaexpress: { name: 'Air India Express', domain: 'airindiaexpress.com', url: 'https://www.airindiaexpress.com/home', type: 'TRANSPORT' },
  nykaa: { name: 'Nykaa', domain: 'nykaa.com', url: 'https://www.nykaa.com/', type: 'PRODUCT' },
  thrillophilia: { name: 'Thrillophilia', domain: 'thrillophilia.com', url: 'https://www.thrillophilia.com/', type: 'ACTIVITY' },
  itc: { name: 'ITC Hotels', domain: 'itchotels.com', url: 'https://www.itchotels.com/', type: 'HOTEL' },
  cleartrip: { name: 'Cleartrip Hotels', domain: 'cleartrip.com', url: 'https://www.cleartrip.com/hotels', type: 'HOTEL' },
};

function merchantUrl(value, merchant) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && (u.hostname === merchant.domain || u.hostname === `www.${merchant.domain}`)
      && (merchant !== MERCHANTS.cleartrip || /^\/hotels(?:\/|$)/.test(u.pathname));
  } catch { return false; }
}

function trackedUrl(value, merchant) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.hostname !== 'linksredirect.com' || u.username || u.password || u.port) return null;
    if (!['cid', 'pub_id'].some((key) => /^[a-z0-9_-]+$/i.test(u.searchParams.get(key) || ''))) return null;
    if (!merchantUrl(u.searchParams.get('url'), merchant)) return null;
    return u;
  } catch { return null; }
}

function campaigns() {
  try {
    const value = JSON.parse(process.env.CUELINKS_CAMPAIGNS_JSON || (fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE, 'utf8') : '{}'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function link(id, { destination, platform = 'web' } = {}) {
  const merchant = Object.hasOwn(MERCHANTS, id) ? MERCHANTS[id] : null;
  if (!merchant) return null;
  const target = merchantUrl(destination, merchant) ? destination : merchant.url;
  const config = campaigns()[id];
  const tracking = trackedUrl(config?.trackingUrl, merchant);
  const approved = config?.approved === true && config.redirectVerified === true && Array.isArray(config.platforms) && config.platforms.includes(platform) && tracking
    && Date.now() - Date.parse(config.checkedAt) < 24 * 3600000;
  if (approved && (config.deeplink === true || new URL(target).href === new URL(tracking.searchParams.get('url')).href)) {
    tracking.searchParams.set('url', target);
    return { provider: merchant.name, deeplink: tracking.href, source: 'affiliate', merchant: id };
  }
  return { provider: merchant.name, deeplink: target, source: 'utility', merchant: id };
}

// Run by the setup CLI, never in a user request. Campaign permission is checked
// separately from conversion: a tracking URL alone does not mean approval.
async function syncCampaigns() {
  if (!(process.env.CLUE_LINK || process.env.CUELINKS_API_KEY)) {
    throw new Error('Set CLUE_LINK or CUELINKS_API_KEY before syncing.');
  }
  const client = axios.create({
    baseURL: 'https://developers.cuelinks.com/pub_api/v3', timeout: 10000,
    headers: { Authorization: `Token ${process.env.CLUE_LINK || process.env.CUELINKS_API_KEY}` },
  });
  const configs = {};
  const platforms = { Web: 'web', 'Mobile Web': 'mobile_web', 'Android App': 'android', 'iOS App': 'ios' };
  for (const [id, merchant] of Object.entries(MERCHANTS)) {
    configs[id] = { approved: false, platforms: [] };
    try {
      const conversion = (await client.post('/links/convert', { url: merchant.url, ...(process.env.CUELINKS_CHANNEL_ID ? { channel_id: Number(process.env.CUELINKS_CHANNEL_ID) } : {}) })).data?.data;
      if (conversion?.affiliated !== true || !Number.isInteger(conversion.campaign?.id) || !trackedUrl(conversion.tracking_url, merchant)) continue;
      const detail = (await client.get(`/campaigns/${conversion.campaign.id}`)).data?.data;
      if (!detail?.countries?.some((c) => c.iso === 'IN')) continue;
      if (!detail?.media?.allowed?.includes('Text Link') || detail.media.disallowed?.includes('Text Link')) continue;
      // Conversion can succeed even when tracking lands on an HTTP-200 error page.
      // Do not send API authentication to the tracking or merchant hosts.
      const landing = await axios.get(conversion.tracking_url, {
        timeout: 8000, maxRedirects: 8, responseType: 'stream',
      });
      landing.data?.destroy?.();
      if (!merchantUrl(landing.request?.res?.responseUrl, merchant)) continue;
      configs[id] = {
        approved: true, redirectVerified: true, trackingUrl: conversion.tracking_url,
        platforms: (detail.platforms?.allowed || []).filter((p) => !detail.platforms?.disallowed?.includes(p)).map((p) => platforms[p]).filter(Boolean),
        deeplink: detail.deeplink_allowed === true, checkedAt: new Date().toISOString(),
      };
    } catch {
      // No upstream error body or headers: they may contain the API credential.
      configs[id].error = 'Campaign could not be verified; direct merchant links remain available.';
    }
  }
  return configs;
}

function status() {
  return { configured: Boolean(process.env.CLUE_LINK || process.env.CUELINKS_API_KEY),
    merchants: Object.fromEntries(Object.keys(MERCHANTS).map((id) => [id, ['web', 'mobile_web', 'android', 'ios'].filter((platform) => link(id, { platform }).source === 'affiliate')])) };
}
module.exports = { MERCHANTS, link, merchantUrl, trackedUrl, syncCampaigns, CONFIG_FILE, status };
