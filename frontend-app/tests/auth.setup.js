const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../backend/src/models/User');

function loadEnv(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  for (const line of data.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

module.exports = async () => {
  const root = path.resolve(__dirname, '..', '..');
  loadEnv(path.join(root, 'backend', '.env'));

  await mongoose.connect(process.env.DATABASE_URL);
  const user = await User.findOne({ email: 'gharshit291@gmail.com' }).lean();
  if (!user) {
    throw new Error('Playwright auth setup: user not found');
  }

  const token = jwt.sign(
    { id: String(user._id), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  const storageState = {
    cookies: [],
    origins: [{
      origin: 'http://localhost:3000',
      localStorage: [
        { name: 'auth_token', value: token },
        { name: 'user', value: JSON.stringify({
          id: String(user._id),
          email: user.email,
          name: user.name,
          onboarding: user.onboarding,
        }) },
      ],
    }],
  };

  const authDir = path.join(root, 'frontend-app', '.auth');
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, 'user.json'), JSON.stringify(storageState, null, 2));

  await mongoose.disconnect();
};
