// Public surface of the `places` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get routes() { return require('./routes'); },
  get geocoder() { return require('./geocoder'); },
  get resolver() { return require('./resolver'); },
  get Place() { return require('./models/Place'); },
};
