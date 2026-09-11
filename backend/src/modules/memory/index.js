// Public surface of the `memory` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get routes() { return require('./routes'); },
  get brief() { return require('./engine/brief'); },
  get extract() { return require('./engine/extract'); },
  get observe() { return require('./engine/observe'); },
  get provenance() { return require('./provenance'); },
  get dna() { return require('./engine/dna'); },
};
