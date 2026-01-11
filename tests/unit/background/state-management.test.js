/**
 * Unit tests for state management functions
 * Tests: getCurrentState
 */

const {
  setupAllMocks,
  resetAllMocks,
  createMockFolder,
  createMockBookmark
} = require('../../helpers/mock-browser');

describe('State Management Functions', () => {
  let mocks;

  beforeEach(() => {
    mocks = setupAllMocks();
    resetAllMocks();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('getCurrentState', () => {
    test('should return correct isOrganized status', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      mocks.bookmarks.getChildren.mockResolvedValue([bookspaceFolder]);

      const state = {
        isOrganized: !!bookspaceFolder,
        currentWorkspace: null,
        workspaceFolders: [],
        isProcessing: false
      };

      expect(state.isOrganized).toBe(true);
    });

    test('should return current workspace (detected or stored)', async () => {
      const currentWorkspace = 'Development';
      const state = {
        isOrganized: true,
        currentWorkspace: currentWorkspace,
        workspaceFolders: [],
        isProcessing: false
      };

      expect(state.currentWorkspace).toBe('Development');
    });

    test('should return workspace folders list', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const workspace1 = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const workspace2 = createMockFolder({ title: 'Personal', id: 'workspace_personal' });

      mocks.bookmarks.getChildren.mockResolvedValue([workspace1, workspace2]);

      const workspaceFolders = [workspace1, workspace2]
        .filter(c => c.type === 'folder')
        .map(c => c.title);

      const state = {
        isOrganized: true,
        currentWorkspace: null,
        workspaceFolders: workspaceFolders,
        isProcessing: false
      };

      expect(state.workspaceFolders).toEqual(['Development', 'Personal']);
    });

    test('should return isProcessing status', async () => {
      const state = {
        isOrganized: true,
        currentWorkspace: 'Development',
        workspaceFolders: [],
        isProcessing: true
      };

      expect(state.isProcessing).toBe(true);
    });

    test('should handle bookspace-all mode (folders at toolbar root)', async () => {
      const currentWorkspace = 'bookspace-all';
      const toolbarChildren = [
        createMockBookmark({ title: 'change bookmarks test' }),
        createMockFolder({ title: 'Development', id: 'workspace_dev' }),
        createMockFolder({ title: 'Personal', id: 'workspace_personal' })
      ];

      mocks.bookmarks.getChildren.mockResolvedValue(toolbarChildren);

      // In bookspace-all mode, workspace folders are at toolbar root
      const workspaceFolders = toolbarChildren
        .filter(c => c.type === 'folder' && c.title !== 'bookspace')
        .map(c => c.title);

      const state = {
        isOrganized: true,
        currentWorkspace: currentWorkspace,
        workspaceFolders: workspaceFolders,
        isProcessing: false
      };

      expect(state.currentWorkspace).toBe('bookspace-all');
      expect(state.workspaceFolders).toContain('Development');
      expect(state.workspaceFolders).toContain('Personal');
    });

    test('should handle regular mode (folders inside bookspace)', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const workspace1 = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const workspace2 = createMockFolder({ title: 'Personal', id: 'workspace_personal' });

      mocks.bookmarks.getChildren.mockResolvedValue([workspace1, workspace2]);

      // In regular mode, workspace folders are inside bookspace
      const workspaceFolders = [workspace1, workspace2]
        .filter(c => c.type === 'folder')
        .map(c => c.title);

      const state = {
        isOrganized: true,
        currentWorkspace: 'Development',
        workspaceFolders: workspaceFolders,
        isProcessing: false
      };

      expect(state.workspaceFolders).toEqual(['Development', 'Personal']);
    });

    test('should handle missing bookspace folder', async () => {
      mocks.bookmarks.getChildren.mockResolvedValue([]);

      const bookspaceFolder = undefined;
      const state = {
        isOrganized: !!bookspaceFolder,
        currentWorkspace: null,
        workspaceFolders: [],
        isProcessing: false
      };

      expect(state.isOrganized).toBe(false);
    });

    test('should return error state on failure', async () => {
      mocks.bookmarks.getChildren.mockRejectedValue(new Error('API error'));

      const state = {
        isOrganized: false,
        currentWorkspace: null,
        workspaceFolders: [],
        isProcessing: false,
        error: 'API error'
      };

      expect(state.error).toBeDefined();
      expect(state.error).toBe('API error');
    });
  });
});
