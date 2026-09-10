// Public surface of the `content` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get blogRoutes() { return require('./blogRoutes'); },
  get shareRoutes() { return require('./shareRoutes'); },
  get blogPage() { return require('./blogPage'); },
  get Post() { return require('./models/Post'); },
};
