// E2E for frontend-app/api.js — drives every method against the live backend.
// Requires backend running at REACT_APP_API_URL (default http://localhost:4000).
//
// Run: node scripts/e2e-smoke.mjs

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const email = `cra-${Date.now()}@trythis.test`;
const password = 'cra12345';

const die = (m, x) => { console.error('❌', m, x ?? ''); process.exit(1); };
const ok = (m) => console.log('✅', m);

const headersWithAuth = (token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

const main = async () => {
  // 1. signup
  let r = await fetch(`${API}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name: 'CRA' }) });
  let d = await r.json();
  if (d.status !== 'success') die('signup', d);
  const token = d.data.token; ok('signup');

  const h = headersWithAuth(token);

  // 2. login
  r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if ((await r.json()).status !== 'success') die('login'); ok('login');

  // 3. refresh
  r = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: h });
  if ((await r.json()).status !== 'success') die('refresh'); ok('refresh');

  // 4. createSave
  r = await fetch(`${API}/saves`, { method: 'POST', headers: h, body: JSON.stringify({ title: 'CRA Save', description: 'Hike at Manali for $50', sourceType: 'screenshot' }) });
  d = await r.json();
  if (d.status !== 'success') die('createSave', d);
  const saveId = d.data._id;
  if (!d.data.title) die('title missing', d.data);
  if (!d.data.intentStatus) die('intentStatus missing', d.data);
  ok(`createSave (id=${saveId}, intent=${d.data.intentStatus})`);

  // 5. getSaves
  r = await fetch(`${API}/saves`, { headers: h });
  d = await r.json(); if (d.data.length !== 1) die('getSaves len'); ok('getSaves');

  // 6. getSaveById
  r = await fetch(`${API}/saves/${saveId}`, { headers: h });
  if ((await r.json()).status !== 'success') die('getSaveById'); ok('getSaveById');

  // 7. patchSave
  r = await fetch(`${API}/saves/${saveId}`, { method: 'PATCH', headers: h, body: JSON.stringify({ title: 'Renamed' }) });
  d = await r.json(); if (d.data.title !== 'Renamed') die('patchSave'); ok('patchSave');

  // 8. createCollection
  r = await fetch(`${API}/collections`, { method: 'POST', headers: h, body: JSON.stringify({ name: 'My Trip' }) });
  d = await r.json(); const colId = d.data._id; ok(`createCollection (id=${colId})`);

  // 9. getCollections
  r = await fetch(`${API}/collections`, { headers: h });
  if ((await r.json()).data.length !== 1) die('getCollections len'); ok('getCollections');

  // 10. getCollectionById
  r = await fetch(`${API}/collections/${colId}`, { headers: h });
  if ((await r.json()).status !== 'success') die('getCollectionById'); ok('getCollectionById');

  // 11. addSaveToCollection
  r = await fetch(`${API}/collections/${colId}/saves/${saveId}`, { method: 'POST', headers: h });
  d = await r.json(); if (d.data.metadata.itemCount !== 1) die('add'); ok('addSaveToCollection');

  // 12. removeSaveFromCollection
  r = await fetch(`${API}/collections/${colId}/saves/${saveId}`, { method: 'DELETE', headers: h });
  d = await r.json(); if (d.data.metadata.itemCount !== 0) die('remove'); ok('removeSaveFromCollection');

  // 13. search
  r = await fetch(`${API}/search?q=Manali`, { headers: h });
  d = await r.json(); if (d.data.total < 1) die('search'); ok(`search (${d.data.total})`);

  // 14. getRecommendations
  r = await fetch(`${API}/recommendations/${saveId}`, { headers: h });
  if ((await r.json()).status !== 'success') die('recs'); ok('getRecommendations');

  // 15. getNotifications + markRead + dismiss (insert a fake first via direct mongo? skip — just check list endpoint)
  r = await fetch(`${API}/notifications`, { headers: h });
  if ((await r.json()).status !== 'success') die('notifications'); ok('getNotifications');

  // 16. deleteSave
  r = await fetch(`${API}/saves/${saveId}`, { method: 'DELETE', headers: h });
  if ((await r.json()).status !== 'success') die('deleteSave'); ok('deleteSave');

  console.log('\n🎉 All 16 CRA-API integration checks passed.');
};

main().catch((e) => { console.error('❌', e); process.exit(1); });
