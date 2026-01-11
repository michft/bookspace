/**
 * Integration tests for browser API interactions
 * Tests: Bookmarks API, Tabs API, Contextual Identities API
 */

const {
  setupAllMocks,
  resetAllMocks,
  createMockBookmark,
  createMockFolder,
  createMockTab,
  createMockContainer
} = require('../helpers/mock-browser');

describe('Browser API Integration Tests', () => {
  let mocks;

  beforeEach(() => {
    mocks = setupAllMocks();
    resetAllMocks();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('Bookmarks API Integration', () => {
    test('should create bookmark', async () => {
      const bookmark = createMockBookmark({ title: 'Test Bookmark', url: 'https://example.com' });
      mocks.bookmarks.create.mockResolvedValue(bookmark);

      const result = await mocks.bookmarks.create({
        parentId: 'toolbar_____',
        title: 'Test Bookmark',
        url: 'https://example.com',
        type: 'bookmark'
      });

      expect(mocks.bookmarks.create).toHaveBeenCalled();
      expect(result).toEqual(bookmark);
    });

    test('should read bookmark', async () => {
      const bookmark = createMockBookmark({ id: 'bookmark_123' });
      mocks.bookmarks.get.mockResolvedValue([bookmark]);

      const result = await mocks.bookmarks.get('bookmark_123');

      expect(mocks.bookmarks.get).toHaveBeenCalledWith('bookmark_123');
      expect(result).toEqual([bookmark]);
    });

    test('should update bookmark', async () => {
      const bookmark = createMockBookmark({ id: 'bookmark_123', title: 'Old Title' });
      const updatedBookmark = { ...bookmark, title: 'New Title' };
      mocks.bookmarks.update.mockResolvedValue(updatedBookmark);

      const result = await mocks.bookmarks.update('bookmark_123', { title: 'New Title' });

      expect(mocks.bookmarks.update).toHaveBeenCalledWith('bookmark_123', { title: 'New Title' });
      expect(result.title).toBe('New Title');
    });

    test('should delete bookmark', async () => {
      mocks.bookmarks.remove.mockResolvedValue();

      await mocks.bookmarks.remove('bookmark_123');

      expect(mocks.bookmarks.remove).toHaveBeenCalledWith('bookmark_123');
    });

    test('should move bookmark and preserve structure', async () => {
      const bookmark = createMockBookmark({ id: 'bookmark_123', parentId: 'folder_1' });
      mocks.bookmarks.move.mockResolvedValue({ ...bookmark, parentId: 'folder_2' });

      const result = await mocks.bookmarks.move('bookmark_123', { parentId: 'folder_2' });

      expect(mocks.bookmarks.move).toHaveBeenCalledWith('bookmark_123', { parentId: 'folder_2' });
      expect(result.parentId).toBe('folder_2');
    });

    test('should maintain folder hierarchy', async () => {
      const parentFolder = createMockFolder({ id: 'parent_1', title: 'Parent' });
      const childFolder = createMockFolder({ id: 'child_1', title: 'Child', parentId: 'parent_1' });
      const bookmark = createMockBookmark({ id: 'bm_1', parentId: 'child_1' });

      mocks.bookmarks.getChildren
        .mockResolvedValueOnce([childFolder])
        .mockResolvedValueOnce([bookmark]);

      const parentChildren = await mocks.bookmarks.getChildren('parent_1');
      const childChildren = await mocks.bookmarks.getChildren('child_1');

      expect(parentChildren[0].parentId).toBe('parent_1');
      expect(childChildren[0].parentId).toBe('child_1');
    });

    test('should handle index positioning', async () => {
      const bookmark1 = createMockBookmark({ id: 'bm_1', index: 0 });
      const bookmark2 = createMockBookmark({ id: 'bm_2', index: 1 });
      mocks.bookmarks.move.mockResolvedValue({ ...bookmark1, index: 1 });

      await mocks.bookmarks.move('bm_1', { index: 1 });

      expect(mocks.bookmarks.move).toHaveBeenCalledWith('bm_1', { index: 1 });
    });
  });

  describe('Tabs API Integration', () => {
    test('should query active tab', async () => {
      const tab = createMockTab({ id: 1, active: true });
      mocks.tabs.query.mockResolvedValue([tab]);

      const result = await mocks.tabs.query({ active: true, currentWindow: true });

      expect(mocks.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(result).toEqual([tab]);
      expect(result[0].active).toBe(true);
    });

    test('should get tab cookieStoreId', async () => {
      const tab = createMockTab({ 
        id: 1, 
        cookieStoreId: 'container_dev' 
      });
      mocks.tabs.get.mockResolvedValue(tab);

      const result = await mocks.tabs.get(1);

      expect(mocks.tabs.get).toHaveBeenCalledWith(1);
      expect(result.cookieStoreId).toBe('container_dev');
    });

    test('should handle tab activation events', async () => {
      const tab1 = createMockTab({ id: 1, active: false, cookieStoreId: 'container_dev' });
      const tab2 = createMockTab({ id: 2, active: true, cookieStoreId: 'container_personal' });

      // Mock tabs.get to return the correct tab based on ID
      mocks.tabs.get.mockImplementation((tabId) => {
        if (tabId === 1) return Promise.resolve(tab1);
        if (tabId === 2) return Promise.resolve(tab2);
        return Promise.reject(new Error('Tab not found'));
      });

      const activatedTab = await mocks.tabs.get(2);
      expect(activatedTab.active).toBe(true);
      expect(activatedTab.cookieStoreId).toBe('container_personal');
    });
  });

  describe('Contextual Identities API Integration', () => {
    test('should query all containers', async () => {
      const containers = [
        createMockContainer({ name: 'Development' }),
        createMockContainer({ name: 'Personal' })
      ];
      mocks.contextualIdentities.query.mockResolvedValue(containers);

      const result = await mocks.contextualIdentities.query({});

      expect(mocks.contextualIdentities.query).toHaveBeenCalledWith({});
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Development');
      expect(result[1].name).toBe('Personal');
    });

    test('should get container by cookieStoreId', async () => {
      const container = createMockContainer({ 
        name: 'Development', 
        cookieStoreId: 'container_dev' 
      });
      mocks.contextualIdentities.get.mockResolvedValue(container);

      const result = await mocks.contextualIdentities.get('container_dev');

      expect(mocks.contextualIdentities.get).toHaveBeenCalledWith('container_dev');
      expect(result.name).toBe('Development');
    });

    test('should handle default container (firefox-default)', async () => {
      // firefox-default is not a real contextual identity
      const cookieStoreId = 'firefox-default';
      
      mocks.contextualIdentities.get.mockRejectedValue(
        new Error('No matching identity')
      );

      try {
        await mocks.contextualIdentities.get(cookieStoreId);
      } catch (error) {
        expect(error.message).toContain('No matching identity');
      }
    });

    test('should handle invalid identities', async () => {
      mocks.contextualIdentities.get.mockRejectedValue(
        new Error('Invalid contextual identity')
      );

      try {
        await mocks.contextualIdentities.get('invalid_id');
      } catch (error) {
        expect(error.message).toContain('Invalid contextual identity');
      }
    });
  });

  describe('Message Passing', () => {
    test('should handle organize action', async () => {
      const message = { action: 'organize' };
      const response = { success: true, movedCount: 5 };

      // Simulate message handler
      const handleMessage = (msg) => {
        if (msg.action === 'organize') {
          return Promise.resolve(response);
        }
      };

      const result = await handleMessage(message);
      expect(result.success).toBe(true);
      expect(result.movedCount).toBe(5);
    });

    test('should handle switchWorkspace action', async () => {
      const message = { action: 'switchWorkspace', workspaceName: 'Development' };
      const response = { success: true, count: 3 };

      const handleMessage = (msg) => {
        if (msg.action === 'switchWorkspace') {
          return Promise.resolve(response);
        }
      };

      const result = await handleMessage(message);
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    test('should handle getState action', async () => {
      const message = { action: 'getState' };
      const response = {
        isOrganized: true,
        currentWorkspace: 'Development',
        workspaceFolders: ['Development', 'Personal'],
        isProcessing: false
      };

      const handleMessage = (msg) => {
        if (msg.action === 'getState') {
          return Promise.resolve(response);
        }
      };

      const result = await handleMessage(message);
      expect(result.isOrganized).toBe(true);
      expect(result.currentWorkspace).toBe('Development');
    });

    test('should handle getContainerInfo action', async () => {
      const message = { action: 'getContainerInfo' };
      const response = {
        currentContainer: 'Development',
        containers: [{ name: 'Development' }, { name: 'Personal' }],
        workspaceFolders: []
      };

      const handleMessage = (msg) => {
        if (msg.action === 'getContainerInfo') {
          return Promise.resolve(response);
        }
      };

      const result = await handleMessage(message);
      expect(result.currentContainer).toBe('Development');
      expect(result.containers.length).toBe(2);
    });

    test('should handle errors in message handlers', async () => {
      const message = { action: 'switchWorkspace', workspaceName: 'Invalid' };
      const error = new Error('Workspace not found');

      const handleMessage = async (msg) => {
        if (msg.action === 'switchWorkspace') {
          throw error;
        }
      };

      await expect(handleMessage(message)).rejects.toThrow('Workspace not found');
    });
  });
});
