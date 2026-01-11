# Bookspace Extension Test Suite

This directory contains the comprehensive test suite for the bookspace browser extension.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual functions
│   ├── background/    # Background script tests
│   └── popup/         # Popup UI tests
├── integration/       # Integration tests for API interactions
├── e2e/               # End-to-end workflow tests
├── helpers/           # Test helper functions and mocks
└── setup.js           # Jest setup file
```

## Setup

Install dependencies using pnpm:

```bash
pnpm install --save-dev jest webextension-polyfill sinon @types/jest
pnpm install web-ext
pnpm install --save-dev nyc  # or c8 for code coverage
```

## Running Tests

### Run all tests
```bash
pnpm test
```

### Run tests in watch mode
```bash
pnpm test:watch
```

### Run tests with coverage
```bash
pnpm test:coverage
```

### Run specific test suites
```bash
# Unit tests only
pnpm test:unit

# Integration tests only
pnpm test:integration

# E2E tests only
pnpm test:e2e
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage of background.js functions
- **Integration Tests**: All browser API interactions
- **E2E Tests**: Critical user workflows

Coverage thresholds are configured in `jest.config.js`:
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Test Categories

### Unit Tests

- **bookmark-organization.test.js**: Tests for bookmark organization functions
- **workspace-switching.test.js**: Tests for workspace switching logic
- **container-detection.test.js**: Tests for container detection
- **state-management.test.js**: Tests for state management
- **ui-interactions.test.js**: Tests for popup UI interactions

### Integration Tests

- **browser-apis.test.js**: Tests for browser API interactions (bookmarks, tabs, contextual identities)
- **message-handling.test.js**: Tests for message passing between background and popup

### E2E Tests

- **workspace-workflows.test.js**: End-to-end tests for workspace switching workflows
- **container-detection-workflows.test.js**: End-to-end tests for container-based auto-switching

## Notes

- Unit and integration tests use mocked browser APIs via `webextension-polyfill`
- E2E tests require actual browser automation (web-ext or Playwright)
- Some tests may need the codebase to be refactored to export functions for better testability
- E2E tests are currently placeholders and need browser automation implementation

## Mock Browser APIs

The test helpers (`tests/helpers/mock-browser.js`) provide utilities for:
- Creating mock bookmarks, folders, containers, and tabs
- Setting up browser API mocks
- Resetting mocks between tests
