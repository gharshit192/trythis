// E2E smoke: drives every API call the UI makes against a running backend.
// Run with the backend up: `node scripts/e2e-smoke.mjs`
import axios from 'axios';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const email = `smoke-${Date.now()}@trythis.test`;
const password = 'smoke12345';

const die = (msg, extra) => {
  console.error('❌', msg, extra ?? '');
  process.exit(1);
};

const ok = (msg) => console.log('✅', msg);

const main = async () => {
  let token, userId;

  // 1. SIGNUP
  {
    const r = await axios.post(`${API}/auth/signup`, { email, password, name: 'Smoke' });
    if (r.data.status !== 'success') die('signup failed', r.data);
    token = r.data.data.token;
    userId = r.data.data.user.id;
    ok(`signup ok (userId=${userId})`);
  }

  const auth = { Authorization: `Bearer ${token}` };

  // 2. LOGIN (same creds, separate token)
  {
    const r = await axios.post(`${API}/auth/login`, { email, password });
    if (r.data.status !== 'success') die('login failed', r.data);
    ok('login ok');
  }

  // 3. CREATE SAVE (url path, with extraction)
  let saveId;
  {
    const r = await axios.post(`${API}/saves`, {
      title: 'Beach Cafe',
      description: 'Best cafe at Lisbon for $30 with sunset views',
      url: 'https://example.com/cafe',
      sourceType: 'url',
    }, { headers: auth });
    if (r.data.status !== 'success') die('create save failed', r.data);
    saveId = r.data.data._id;
    if (!r.data.data.title) die('title missing', r.data.data);
    if (!r.data.data.intentStatus) die('intentStatus missing', r.data.data);
    ok(`save created (id=${saveId}, intent=${r.data.data.intentStatus}, content=${r.data.data.contentType})`);
  }

  // 4. CREATE SAVE (screenshot path, no url)
  {
    const r = await axios.post(`${API}/saves`, {
      title: 'My screenshot',
      description: 'Saw a hotel in Paris for $200',
      sourceType: 'screenshot',
    }, { headers: auth });
    if (r.data.status !== 'success') die('screenshot save failed', r.data);
    ok('screenshot save ok');
  }

  // 5. LIST SAVES
  {
    const r = await axios.get(`${API}/saves`, { headers: auth });
    if (r.data.data.length !== 2) die(`expected 2 saves, got ${r.data.data.length}`);
    ok(`list saves ok (${r.data.data.length})`);
  }

  // 6. SAVE DETAIL (increments views)
  {
    const r = await axios.get(`${API}/saves/${saveId}`, { headers: auth });
    if (r.data.data.appEngagement?.views !== 1) die('view counter not incremented');
    ok('save detail ok (view counter=1)');
  }

  // 7. PATCH SAVE
  {
    const r = await axios.patch(`${API}/saves/${saveId}`, { title: 'Renamed Cafe' }, { headers: auth });
    if (r.data.data.title !== 'Renamed Cafe') die('patch failed');
    ok('patch save ok');
  }

  // 8. CREATE COLLECTION
  let colId;
  {
    const r = await axios.post(`${API}/collections`, { name: 'Trips', description: 'Travel ideas' }, { headers: auth });
    colId = r.data.data._id;
    ok(`collection created (id=${colId})`);
  }

  // 9. ADD SAVE TO COLLECTION
  {
    const r = await axios.post(`${API}/collections/${colId}/saves/${saveId}`, {}, { headers: auth });
    if (r.data.data.metadata.itemCount !== 1) die('add to collection failed');
    ok('save added to collection');
  }

  // 10. LIST COLLECTIONS
  {
    const r = await axios.get(`${API}/collections`, { headers: auth });
    if (r.data.data.length !== 1) die(`expected 1 collection, got ${r.data.data.length}`);
    ok('list collections ok');
  }

  // 11. SEARCH
  {
    const r = await axios.get(`${API}/search`, { params: { q: 'Lisbon' }, headers: auth });
    if (r.data.data.total < 1) die('search returned no results for known term');
    ok(`search ok (${r.data.data.total} results)`);
  }

  // 12. RECOMMENDATIONS
  {
    const r = await axios.get(`${API}/recommendations/${saveId}`, { headers: auth });
    if (r.data.status !== 'success') die('recs failed');
    ok(`recommendations ok (${r.data.data.length})`);
  }

  // 13. NOTIFICATIONS LIST
  {
    const r = await axios.get(`${API}/notifications`, { headers: auth });
    if (r.data.status !== 'success') die('notifications failed');
    ok(`notifications ok (${r.data.data.notifications.length})`);
  }

  // 14. REFRESH TOKEN via Authorization header (regression: was body-only)
  {
    const r = await axios.post(`${API}/auth/refresh`, {}, { headers: auth });
    if (r.data.status !== 'success' || !r.data.data.token) die('refresh failed');
    ok('refresh ok');
  }

  // 15. DELETE SAVE
  {
    const r = await axios.delete(`${API}/saves/${saveId}`, { headers: auth });
    if (r.data.status !== 'success') die('delete failed');
    ok('delete save ok');
  }

  console.log('\n🎉 All 15 frontend-API integration checks passed.');
};

main().catch((e) => {
  console.error('❌ Unhandled:', e.response?.data || e.message);
  process.exit(1);
});
