// Public surface of the `commerce` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get routes() { return require('./routes'); },
  get service() { return require('./service'); },
  get cuelinks() { return require('./providers/cuelinks'); },
  get cuelinksWorker() { return require('./workers/cuelinksWorker'); },
};
