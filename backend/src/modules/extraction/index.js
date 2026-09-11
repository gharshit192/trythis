// Public surface of the `extraction` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get uploadRoutes() { return require('./uploadRoutes'); },
  get audioRoutes() { return require('./audioRoutes'); },
  get engine() { return require('./extractionEngine'); },
  get domainClassifier() { return require('./extractionEngine/domainClassifier'); },
  get fetchSystem() { return require('./fetchSystem'); },
  get mediaProcessor() { return require('./mediaProcessor'); },
  get screenshotBundle() { return require('./screenshotBundle'); },
  get screenshotPipeline() { return require('./screenshotPipeline'); },
  get thumbnailCache() { return require('./thumbnailCache'); },
  get transcription() { return require('./transcription'); },
  get urlClassifier() { return require('./urlClassifier'); },
  get purgeScreenshots() { return require('./purgeScreenshots'); },
  get recoverStuckSaves() { return require('./recoverStuckSaves'); },
  get cleanupBundles() { return require('./cleanupBundles'); },
  get uploadWorker() { return require('./uploadWorker'); },
};
