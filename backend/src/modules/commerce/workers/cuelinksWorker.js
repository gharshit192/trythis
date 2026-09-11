const { fork } = require('child_process');
const path = require('path');
const logger = require('../../../utils/logger');
let timer;
let child;
function start() {
  if (timer || !(process.env.CLUE_LINK || process.env.CUELINKS_API_KEY)) return;
  const refresh = () => {
    if (child) return;
    child = fork(path.join(__dirname, 'cuelinksSync.js'), [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const timeout = setTimeout(() => child?.kill(), 180000);
    child.on('error', () => logger.warn('[cuelinks] refresh worker unavailable'));
    child.on('exit', () => { clearTimeout(timeout); child = null; });
  };
  refresh();
  timer = setInterval(refresh, 6 * 3600000);
  timer.unref();
}
module.exports = { start };
