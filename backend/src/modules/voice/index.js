// Public surface of the `voice` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get routes() { return require('./routes'); },
  get sarvamSpeech() { return require('./sarvamSpeech'); },
  get service() { return require('./service'); },
};
