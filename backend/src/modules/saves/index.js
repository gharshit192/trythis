// Public surface of the `saves` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get routes() { return require('./routes'); },
  get collectionRoutes() { return require('./collectionRoutes'); },
  get Save() { return require('./models/Save'); },
  get autoCollection() { return require('./autoCollection'); },
  get insightsEngine() { return require('./insightsEngine'); },
};
