// Where the world reaches us. Share links are pasted into WhatsApp and must
// never carry localhost. Set BASE_URL (API) and APP_URL (the client) in prod.
const publicBaseUrl = () =>
  process.env.BASE_URL
  || (process.env.NODE_ENV === 'production' ? 'https://trythis-am0j.onrender.com' : `http://localhost:${process.env.PORT || 4000}`);
const appUrl = () => process.env.APP_URL || process.env.FRONTEND_URL || 'https://trythis-frontend.vercel.app';
module.exports = { publicBaseUrl, appUrl };
