const router = require('express').Router();
const redirects = require('./redirect');

router.get('/:token', (req, res) => {
  try {
    const ua = String(req.headers['user-agent'] || '');
    const result = redirects.resolve(req.params.token, ua);
    void redirects.record(result.payload, ua);
    res.set({ 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
    res.redirect(302, result.url);
  } catch {
    res.status(400).type('text/plain').send('This partner link has expired or is invalid. Open the save again for a fresh link.');
  }
});
module.exports = router;
