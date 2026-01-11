// Helper functions for mocking browser APIs in tests

/**
 * Create a mock bookmark object
 */
function createMockBookmark(overrides = {}) {
  return {
    id: `bookmark_${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Bookmark',
    url: 'https://example.com',
    type: 'bookmark',
    parentId: 'toolbar_____',
    index: 0,
    ...overrides
  };
}

/**
 * Create a mock folder object
 */
function createMockFolder(overrides = {}) {
  return {
    id: `folder_${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Folder',
    type: 'folder',
    parentId: 'toolbar_____',
    index: 0,
    ...overrides
  };
}

/**
 * Create a mock container/contextual identity
 */
function createMockContainer(overrides = {}) {
  return {
    cookieStoreId: `container_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Container',
    color: 'blue',
    colorCode: '#0000ff',
    icon: 'fingerprint',
    iconUrl: 'resource://usercontext-content/fingerprint.svg',
    ...overrides
  };
}

/**
 * Create a mock tab object
 */
function createMockTab(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    url: 'https://example.com',
    title: 'Test Tab',
    cookieStoreId: 'firefox-default',
    active: true,
    ...overrides
  };
}

/**
 * Setup browser.bookmarks mock
 */
function setupBookmarksMock() {
  if (!global.browser) {
    global.browser = {};
  }
  
  const bookmarks = {
    get: jest.fn(),
    getChildren: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    move: jest.fn(),
    remove: jest.fn(),
    search: jest.fn()
  };
  
  global.browser.bookmarks = bookmarks;
  return bookmarks;
}

/**
 * Setup browser.tabs mock
 */
function setupTabsMock() {
  if (!global.browser) {
    global.browser = {};
  }
  
  const tabs = {
    query: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn()
  };
  
  global.browser.tabs = tabs;
  return tabs;
}

/**
 * Setup browser.contextualIdentities mock
 */
function setupContextualIdentitiesMock() {
  if (!global.browser) {
    global.browser = {};
  }
  
  const contextualIdentities = {
    get: jest.fn(),
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn()
  };
  
  global.browser.contextualIdentities = contextualIdentities;
  return contextualIdentities;
}

/**
 * Setup browser.runtime mock
 */
function setupRuntimeMock() {
  if (!global.browser) {
    global.browser = {};
  }
  
  const runtime = {
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    getURL: jest.fn((path) => `moz-extension://test-id/${path}`)
  };
  
  global.browser.runtime = runtime;
  return runtime;
}

/**
 * Setup all browser API mocks
 */
function setupAllMocks() {
  return {
    bookmarks: setupBookmarksMock(),
    tabs: setupTabsMock(),
    contextualIdentities: setupContextualIdentitiesMock(),
    runtime: setupRuntimeMock()
  };
}

/**
 * Reset all mocks
 */
function resetAllMocks() {
  if (global.browser) {
    if (global.browser.bookmarks) {
      Object.values(global.browser.bookmarks).forEach(mock => {
        if (jest.isMockFunction(mock)) mock.mockReset();
      });
    }
    if (global.browser.tabs) {
      Object.values(global.browser.tabs).forEach(mock => {
        if (jest.isMockFunction(mock)) mock.mockReset();
      });
    }
    if (global.browser.contextualIdentities) {
      Object.values(global.browser.contextualIdentities).forEach(mock => {
        if (jest.isMockFunction(mock)) mock.mockReset();
      });
    }
    if (global.browser.runtime) {
      Object.values(global.browser.runtime).forEach(mock => {
        if (jest.isMockFunction(mock)) mock.mockReset();
      });
    }
  }
}

module.exports = {
  createMockBookmark,
  createMockFolder,
  createMockContainer,
  createMockTab,
  setupBookmarksMock,
  setupTabsMock,
  setupContextualIdentitiesMock,
  setupRuntimeMock,
  setupAllMocks,
  resetAllMocks
};
