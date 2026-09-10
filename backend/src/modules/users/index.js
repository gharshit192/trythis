// Public surface of the `users` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get User() { return require('./models/User'); },
  get UserBehavior() { return require('./models/UserBehavior'); },
  get badgeService() { return require('./badgeService'); },
  get behaviorRollup() { return require('./behaviorRollup'); },
  get refresh() { return require('./behaviorRollup/refresh'); },
};
