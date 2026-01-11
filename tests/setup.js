// Jest setup file for bookspace extension tests
// This file runs before all tests

// Create a mock browser object instead of using webextension-polyfill
// (webextension-polyfill requires a browser extension environment)
const { setupAllMocks } = require('./helpers/mock-browser');

// Setup all browser API mocks
setupAllMocks();

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
