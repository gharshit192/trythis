const assert = require('assert');
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const puppeteer = require('puppeteer-core');
process.env.JWT_SECRET = 'isolated-commerce-browser-test';
process.env.CUELINKS_CAMPAIGNS_JSON = '{}';
delete process.env.TRAVELPAYOUTS_TOKEN;
const app = require('../src/app');
const Save = require('../src/modules/saves').Save;
const User = require('../src/modules/users').User;
const listen = (server) => new Promise((resolve) => { const instance = server.listen(0, '127.0.0.1', () => resolve(instance)); });

async function main() {
  const mongo = await MongoMemoryServer.create();
  let api; let web; let browser;
  try {
    await mongoose.connect(mongo.getUri());
    const user = await User.create({ email: 'commerce-browser@example.test', password: 'not-a-login-password', name: 'Commerce Test', emailVerified: true, location: { city: 'Delhi' } });
    const save = await Save.create({ userId: user._id, title: 'Goa browser test', category: 'travel', processingStatus: 'done',
      aiAnalysis: { structuredData: { type: 'itinerary', itinerary: { destination: 'Goa', duration: '2 days' } } },
      tripPlan: { origin: 'Delhi', data: { destinations: [{ name: 'Goa', country: 'India' }], dailyPlan: [{ day: 1, theme: 'Goa', stops: [] }] }, generatedAt: new Date() } });
    const product = await Save.create({ userId: user._id, title: 'Nykaa browser test', url: 'https://www.nykaa.com/item/p/123', category: 'shopping', processingStatus: 'done' });
    api = await listen(app);
    const apiOrigin = `http://127.0.0.1:${api.address().port}`;
    const staticApp = express();
    const build = path.resolve(__dirname, '../../frontend-app/build');
    staticApp.use(express.static(build));
    staticApp.get('*', (req, res) => res.sendFile(path.join(build, 'index.html')));
    web = await listen(staticApp);
    const webOrigin = `http://127.0.0.1:${web.address().port}`;
    browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
    fs.mkdirSync('/tmp/wt-commerce-proof', { recursive: true });
    for (const width of [390, 1365]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, isMobile: width < 500 });
      await page.setBypassServiceWorker(true);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', async (req) => {
        const url = new URL(req.url());
        if (url.origin === 'http://localhost:4000' || url.hostname === 'trythis-am0j.onrender.com') {
          try {
            const result = await fetch(apiOrigin + url.pathname + url.search, { method: req.method(), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, ...(req.postData() ? { body: req.postData() } : {}) });
            await req.respond({ status: result.status, headers: { 'Content-Type': result.headers.get('content-type') || 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: await result.text() });
          } catch { await req.abort(); }
        } else await req.continue();
      });
      await page.evaluateOnNewDocument((t, id) => {
        if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {});
        localStorage.setItem('auth_token', t);
        localStorage.setItem('user', JSON.stringify({ id, name: 'Commerce Test' }));
        localStorage.setItem('location_requested', 'denied');
      }, token, String(user._id));
      await page.goto(`${webOrigin}/saves/${save._id}`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => [...document.querySelectorAll('.wt-row-title')].find((x) => x.textContent === 'Goa browser test')?.click());
      await page.waitForFunction(() => document.body.innerText.includes('Find stays for Goa'), { timeout: 20000 }).catch(async (error) => { console.log('Browser body:', await page.evaluate(() => document.body.innerText)); console.log('Browser errors:', errors); throw error; });
      await page.screenshot({ path: `/tmp/wt-commerce-proof/trip-${width}.png`, fullPage: true });
      const hrefs = await page.$$eval('a[href*="/go/"]', (nodes) => nodes.map((n) => n.href));
      assert(hrefs.length > 0, 'Trip must expose partner actions');
      for (const href of hrefs) {
        const r = await fetch(apiOrigin + new URL(href).pathname, { redirect: 'manual' });
        assert.equal(r.status, 302);
        assert(new URL(r.headers.get('location')).protocol === 'https:');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      await page.evaluate(() => [...document.querySelectorAll('.wt-section-label')].find((x) => x.textContent.includes('Complete your trip'))?.querySelector('.action')?.click());
      await page.waitForFunction(() => document.body.textContent.includes('Experiences for Goa'), { timeout: 20000 }).catch(async (error) => { console.log('Expanded body:', await page.evaluate(() => document.body.innerText)); console.log('Expanded errors:', errors); throw error; });
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '5 nights')?.click());
      await page.waitForNetworkIdle();
      await page.screenshot({ path: `/tmp/wt-commerce-proof/options-${width}.png`, fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No expanded-view overflow');
      await page.goto(`${webOrigin}/saves/${product._id}`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => [...document.querySelectorAll('.wt-row-title')].find((x) => x.textContent === 'Nykaa browser test')?.click());
      await page.waitForFunction(() => document.body.innerText.includes('View your saved item on Nykaa'), { timeout: 20000 });
      await page.screenshot({ path: `/tmp/wt-commerce-proof/product-${width}.png`, fullPage: true });
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`Browser ${width}px: trip, product, redirects and layout passed`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    if (api) await new Promise((resolve) => api.close(resolve));
    if (web) await new Promise((resolve) => web.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
