const fs = require('fs');
const { syncCampaigns, CONFIG_FILE } = require('../providers/cuelinks');

async function run() {
  const configs = await syncCampaigns();
  fs.writeFileSync(CONFIG_FILE + '.tmp', JSON.stringify(configs), { mode: 0o600 });
  fs.renameSync(CONFIG_FILE + '.tmp', CONFIG_FILE);
  for (const [name, c] of Object.entries(configs)) console.log(`[cuelinks] ${name}: ${c.approved ? c.platforms.join(', ') || 'no eligible platform' : 'not verified'}`);
}
if (require.main === module) run().catch(() => { console.error('[cuelinks] refresh unavailable'); process.exitCode = 1; });
module.exports = { run };
