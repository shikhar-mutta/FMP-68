module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    // Exclude test files and directories
    '!src/**/*.test.{js,jsx}',
    '!src/**/*.spec.{js,jsx}',
    '!src/__tests__/**',
    // Exclude configuration and entry files
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/setupTests.js',
    // Exclude mocks
    '!src/**/__mocks__/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/__tests__/',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx}',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  coverageThresholds: {
    global: {
      statements: 50,
      branches: 50,
      functions: 50,
      lines: 50,
    },
  },
};
