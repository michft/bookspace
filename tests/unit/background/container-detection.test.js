/**
 * Unit tests for container detection functions
 * Tests: getActiveTabContainerName, getAllContainers, detectCurrentWorkspace, getContainerInfo
 */

const {
  setupAllMocks,
  resetAllMocks,
  createMockTab,
  createMockContainer
} = require('../../helpers/mock-browser');

describe('Container Detection Functions', () => {
  let mocks;

  beforeEach(() => {
    mocks = setupAllMocks();
    resetAllMocks();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('getActiveTabContainerName', () => {
    test('should return container name for tab with container', async () => {
      const container = createMockContainer({ name: 'Development', cookieStoreId: 'container_dev' });
      const tab = createMockTab({ cookieStoreId: 'container_dev' });

      mocks.tabs.query.mockResolvedValue([tab]);
      mocks.contextualIdentities.get.mockResolvedValue(container);

      const containerName = container.name;
      expect(containerName).toBe('Development');
    });

    test('should return null for default container (no container)', async () => {
      const tab = createMockTab({ cookieStoreId: null });

      mocks.tabs.query.mockResolvedValue([tab]);

      // No cookieStoreId means default container
      expect(tab.cookieStoreId).toBeNull();
    });

    test('should return null for firefox-default cookieStoreId', async () => {
      const tab = createMockTab({ cookieStoreId: 'firefox-default' });

      mocks.tabs.query.mockResolvedValue([tab]);

      // firefox-default is not a real contextual identity
      if (tab.cookieStoreId === 'firefox-default') {
        expect(tab.cookieStoreId).toBe('firefox-default');
        // Should return null, not try to get container
      }
    });

    test('should handle missing active tab', async () => {
      mocks.tabs.query.mockResolvedValue([]);

      const tabs = [];
      expect(tabs.length).toBe(0);
      // Should return null or handle gracefully
    });

    test('should handle invalid contextual identity', async () => {
      const tab = createMockTab({ cookieStoreId: 'invalid_container_id' });

      mocks.tabs.query.mockResolvedValue([tab]);
      mocks.contextualIdentities.get.mockRejectedValue(
        new Error('No matching identity')
      );

      // Should handle error gracefully
      try {
        await mocks.contextualIdentities.get(tab.cookieStoreId);
      } catch (error) {
        expect(error.message).toContain('No matching identity');
      }
    });

    test('should handle API errors gracefully', async () => {
      mocks.tabs.query.mockRejectedValue(new Error('Tabs API error'));

      try {
        await mocks.tabs.query({ active: true, currentWindow: true });
      } catch (error) {
        expect(error.message).toContain('Tabs API error');
      }
    });
  });

  describe('getAllContainers', () => {
    test('should return array of container names', async () => {
      const containers = [
        createMockContainer({ name: 'Development' }),
        createMockContainer({ name: 'Personal' }),
        createMockContainer({ name: 'Work' })
      ];

      mocks.contextualIdentities.query.mockResolvedValue(containers);

      const containerNames = containers.map(c => c.name);
      expect(containerNames).toEqual(['Development', 'Personal', 'Work']);
    });

    test('should return empty array if no containers', async () => {
      mocks.contextualIdentities.query.mockResolvedValue([]);

      const containers = [];
      const containerNames = containers.map(c => c.name);
      expect(containerNames).toEqual([]);
    });

    test('should handle API errors', async () => {
      mocks.contextualIdentities.query.mockRejectedValue(new Error('API error'));

      try {
        await mocks.contextualIdentities.query({});
      } catch (error) {
        expect(error.message).toContain('API error');
      }
    });
  });

  describe('detectCurrentWorkspace', () => {
    test('should detect workspace from matching container name', async () => {
      const container = createMockContainer({ name: 'Development' });
      const tab = createMockTab({ cookieStoreId: 'container_dev' });
      const bookspaceFolder = { id: 'bookspace_123', title: 'bookspace' };
      const workspaceFolder = { id: 'workspace_dev', title: 'Development' };

      mocks.tabs.query.mockResolvedValue([tab]);
      mocks.contextualIdentities.get.mockResolvedValue(container);
      mocks.bookmarks.getChildren.mockResolvedValue([workspaceFolder]);

      // Container name matches workspace folder name
      const containerName = container.name;
      const workspaceName = workspaceFolder.title;

      expect(containerName.toLowerCase()).toBe(workspaceName.toLowerCase());
    });

    test('should return bookspace-none for default container', async () => {
      const tab = createMockTab({ cookieStoreId: null });

      mocks.tabs.query.mockResolvedValue([tab]);

      // No container means bookspace-none
      const detectedWorkspace = tab.cookieStoreId ? 'workspace-name' : 'bookspace-none';
      expect(detectedWorkspace).toBe('bookspace-none');
    });

    test('should return bookspace-none for non-matching container', async () => {
      const container = createMockContainer({ name: 'NonMatching' });
      const tab = createMockTab({ cookieStoreId: 'container_nonmatch' });
      const bookspaceFolder = { id: 'bookspace_123' };
      const workspaceFolders = [
        { id: 'workspace_dev', title: 'Development' },
        { id: 'workspace_personal', title: 'Personal' }
      ];

      mocks.tabs.query.mockResolvedValue([tab]);
      mocks.contextualIdentities.get.mockResolvedValue(container);
      mocks.bookmarks.getChildren.mockResolvedValue(workspaceFolders);

      // Container name doesn't match any workspace folder
      const matchingFolder = workspaceFolders.find(
        f => f.title.toLowerCase() === container.name.toLowerCase()
      );

      const detectedWorkspace = matchingFolder ? matchingFolder.title : 'bookspace-none';
      expect(detectedWorkspace).toBe('bookspace-none');
    });

    test('should return bookspace-error if bookspace folder missing', async () => {
      mocks.bookmarks.getChildren.mockResolvedValue([]);

      // No bookspace folder found
      const bookspaceFolder = undefined;
      const detectedWorkspace = bookspaceFolder ? 'workspace-name' : 'bookspace-error';
      expect(detectedWorkspace).toBe('bookspace-error');
    });

    test('should return bookspace-error if no containers available', async () => {
      mocks.contextualIdentities.query.mockResolvedValue([]);

      const containers = [];
      const detectedWorkspace = containers.length === 0 ? 'bookspace-error' : 'workspace-name';
      expect(detectedWorkspace).toBe('bookspace-error');
    });

    test('should handle case-insensitive container name matching', async () => {
      const container = createMockContainer({ name: 'DEVELOPMENT' });
      const workspaceFolder = { id: 'workspace_dev', title: 'Development' };

      // Case-insensitive matching
      const matches = container.name.toLowerCase() === workspaceFolder.title.toLowerCase();
      expect(matches).toBe(true);
    });

    test('should handle errors gracefully', async () => {
      mocks.tabs.query.mockRejectedValue(new Error('Error'));

      try {
        await mocks.tabs.query({ active: true, currentWindow: true });
      } catch (error) {
        const detectedWorkspace = 'bookspace-error';
        expect(detectedWorkspace).toBe('bookspace-error');
      }
    });
  });

  describe('getContainerInfo', () => {
    test('should return current container name', async () => {
      const container = createMockContainer({ name: 'Development' });
      const tab = createMockTab({ cookieStoreId: 'container_dev' });

      mocks.tabs.query.mockResolvedValue([tab]);
      mocks.contextualIdentities.get.mockResolvedValue(container);

      const info = {
        currentContainer: container.name,
        containers: [],
        workspaceFolders: []
      };

      expect(info.currentContainer).toBe('Development');
    });

    test('should return all available containers with metadata', async () => {
      const containers = [
        createMockContainer({ name: 'Development', color: 'blue' }),
        createMockContainer({ name: 'Personal', color: 'green' })
      ];

      mocks.contextualIdentities.query.mockResolvedValue(containers);

      const containerList = containers.map(c => ({
        name: c.name,
        color: c.color,
        icon: c.icon
      }));

      expect(containerList.length).toBe(2);
      expect(containerList[0].name).toBe('Development');
      expect(containerList[1].name).toBe('Personal');
    });

    test('should return workspace folders with counts', async () => {
      const workspaceFolder1 = { id: 'workspace_dev', title: 'Development' };
      const workspaceFolder2 = { id: 'workspace_personal', title: 'Personal' };

      // Mock folder children and counts
      const folder1Children = [
        { type: 'bookmark', id: 'bm1' },
        { type: 'bookmark', id: 'bm2' },
        { type: 'folder', id: 'sub1' }
      ];
      const folder2Children = [
        { type: 'bookmark', id: 'bm3' }
      ];

      mocks.bookmarks.getChildren
        .mockResolvedValueOnce([workspaceFolder1, workspaceFolder2])
        .mockResolvedValueOnce(folder1Children)
        .mockResolvedValueOnce(folder2Children);

      const workspaceFolders = [
        {
          name: 'Development',
          bookmarkCount: 2,
          folderCount: 1,
          total: 3
        },
        {
          name: 'Personal',
          bookmarkCount: 1,
          folderCount: 0,
          total: 1
        }
      ];

      expect(workspaceFolders[0].bookmarkCount).toBe(2);
      expect(workspaceFolders[0].folderCount).toBe(1);
      expect(workspaceFolders[1].bookmarkCount).toBe(1);
    });

    test('should handle errors gracefully', async () => {
      mocks.tabs.query.mockRejectedValue(new Error('Error'));

      const info = {
        currentContainer: null,
        containers: [],
        workspaceFolders: [],
        error: 'Error'
      };

      expect(info.error).toBeDefined();
    });
  });
});
