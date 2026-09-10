// Local-only fixture server. No production database or real user records.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
process.env.JWT_SECRET = 'local-commerce-preview-only';
const app = require('../src/app');
const User = require('../src/modules/users/models/User');
const Save = require('../src/modules/saves/models/Save');

async function main() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const user = await User.create({ email: 'commerce-preview@example.test', password: await bcrypt.hash('PreviewOnly123!', 10), name: 'Preview', emailVerified: true, location: { city: 'Delhi' } });
  await Save.create({ userId: user._id, title: 'Goa weekend', category: 'travel', processingStatus: 'done',
    aiAnalysis: { structuredData: { type: 'itinerary', itinerary: { destination: 'Goa', duration: '2 days' } } },
    tripPlan: { origin: 'Delhi', data: { destinations: [{ name: 'Goa', country: 'India' }], dailyPlan: [{ day: 1, theme: 'Goa', stops: [] }] }, generatedAt: new Date() } });
  await Save.create({ userId: user._id, title: 'Saved Nykaa item', url: 'https://www.nykaa.com/', category: 'shopping', processingStatus: 'done' });
  const server = app.listen(4000, '127.0.0.1', () => console.log('Preview API ready on http://localhost:4000'));
  const stop = async () => { server.close(); await mongoose.disconnect(); await mongo.stop(); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
main().catch(() => { console.error('Preview could not start'); process.exitCode = 1; });
