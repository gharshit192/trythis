module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/config/**'],
  moduleNameMapper: {
    // uuid and nanoid are ESM-only and Jest cannot parse them without a Babel
    // pipeline; between them they were taking routes/api.test.js down at load
    // time, which is why 'npm test' was not a usable gate.
    '^uuid$': '<rootDir>/tests/helpers/uuidStub.js',
    '^nanoid$': '<rootDir>/tests/helpers/nanoidStub.js',
  },
};
