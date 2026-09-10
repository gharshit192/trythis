// Public surface of the `notifications` module. Other modules import this file and nothing
// deeper (ADR 0023). Getters are lazy so cross-module cycles cannot deadlock at load.
module.exports = {
  get routes() { return require('./routes'); },
  get pushPublicRoutes() { return require('./pushPublicRoutes'); },
  get testRoutes() { return require('./testRoutes'); },
  get emailService() { return require('./emailService'); },
  get notificationService() { return require('./notificationService'); },
  get scheduler() { return require('./scheduler'); },
  get Notification() { return require('./models/Notification'); },
};
