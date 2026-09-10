// Public surface of the `search` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get routes() { return require('./routes'); },
  get knowledgeRoutes() { return require('./knowledgeRoutes'); },
  get fold() { return require('./engine/fold'); },
  get vector() { return require('./engine/vector'); },
  get indexer() { return require('./engine/indexer'); },
};
