// One object, same call sites as before (`api.getSaves()`), assembled from
// one module per backend domain — see ADR 0012.
import auth from './auth';
import saves from './saves';
import collections from './collections';
import search from './search';
import notifications from './notifications';
import places from './places';
import onboarding from './onboarding';
import uploads from './uploads';
import voice from './voice';
import ask from './ask';

const api = { ...auth, ...saves, ...collections, ...search, ...notifications, ...places, ...onboarding, ...uploads, ...voice, ...ask };

export default api;
