// nanoid v4+ is ESM-only, the same problem as uuid — see tests/helpers/uuidStub.js.
// It is used for opaque share ids, so tests substitute a CJS generator with the
// same alphabet and default length.
const { randomInt } = require('crypto');

const ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

const nanoid = (size = 21) => {
  let out = '';
  for (let i = 0; i < size; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
};

module.exports = { nanoid, customAlphabet: (a, n = 21) => () => {
  let out = '';
  for (let i = 0; i < n; i += 1) out += a[randomInt(a.length)];
  return out;
} };
