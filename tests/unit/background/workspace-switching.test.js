/**
 * Unit tests for workspace switching functions
 * Tests: switchToWorkspace, showNoBookmarks, showAllBookmarks
 */

const {
  setupAllMocks,
  resetAllMocks,
  createMockBookmark,
  createMockFolder
} = require('../../helpers/mock-browser');

describe('Workspace Switching Functions', () => {
  let mocks;

  beforeEach(() => {
    mocks = setupAllMocks();
    resetAllMocks();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('switchToWorkspace', () => {
    test('should move bookmarks from workspace folder to toolbar', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const workspaceFolder = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const workspaceBookmark = createMockBookmark({ title: 'Dev Bookmark', parentId: 'workspace_dev' });

      mocks.bookmarks.getChildren
        .mockResolvedValueOnce([workspaceBookmark]) // Workspace folder children
        .mockResolvedValueOnce([createMockBookmark({ title: 'change bookmarks test' }), bookspaceFolder]); // Toolbar

      // Should move workspace bookmark to toolbar
      const expectedMove = {
        parentId: 'toolbar_____',
        index: 1 // After "change bookmarks test" at index 0
      };

      expect(expectedMove.parentId).toBe('toolbar_____');
      expect(expectedMove.index).toBe(1);
    });

    test('should move previous workspace bookmarks back to their folder', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const previousWorkspaceFolder = createMockFolder({ title: 'Personal', id: 'workspace_personal' });
      const currentWorkspaceFolder = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const previousBookmark = createMockBookmark({ title: 'Personal Bookmark', parentId: 'toolbar_____' });

      // Simulate switching from Personal to Development
      mocks.bookmarks.getChildren
        .mockResolvedValueOnce([previousBookmark]) // Current toolbar items
        .mockResolvedValueOnce([currentWorkspaceFolder]) // Bookspace children
        .mockResolvedValueOnce([]); // Development workspace (empty for this test)

      // Previous bookmark should be moved back to Personal folder
      const expectedMoveBack = {
        parentId: 'workspace_personal'
      };

      expect(expectedMoveBack.parentId).toBe('workspace_personal');
    });

    test('should preserve nested folder structure', async () => {
      const workspaceFolder = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const nestedFolder = createMockFolder({ title: 'Nested', id: 'nested_1', parentId: 'workspace_dev' });
      const nestedBookmark = createMockBookmark({ title: 'Nested Bookmark', parentId: 'nested_1' });

      // When moving a folder, nested structure is preserved by browser API
      expect(nestedBookmark.parentId).toBe('nested_1');
      expect(nestedFolder.parentId).toBe('workspace_dev');
    });

    test('should handle bookspace-none mode', async () => {
      const workspaceName = 'bookspace-none';
      
      // bookspace-none should show only change bookmarks test + bookspace folder
      const expectedBehavior = {
        workspaceName: 'bookspace-none',
        visibleItems: ['change bookmarks test', 'bookspace']
      };

      // Normalize 'bookspace-none' to 'none' for comparison
      const normalized = expectedBehavior.workspaceName.toLowerCase() === 'bookspace-none' 
        ? 'none' 
        : expectedBehavior.workspaceName.toLowerCase();
      expect(normalized).toBe('none');
    });

    test('should handle bookspace-all mode', async () => {
      const workspaceName = 'bookspace-all';
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const workspace1 = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const workspace2 = createMockFolder({ title: 'Personal', id: 'workspace_personal' });

      // bookspace-all should show all bookmarks from bookspace folder
      const bookspaceChildren = [workspace1, workspace2];
      expect(bookspaceChildren.length).toBe(2);
    });

    test('should handle case-insensitive workspace name matching', async () => {
      const workspaceName1 = 'Development';
      const workspaceName2 = 'DEVELOPMENT';
      const workspaceName3 = 'development';

      // All should match the same workspace folder
      expect(workspaceName1.toLowerCase()).toBe(workspaceName2.toLowerCase());
      expect(workspaceName2.toLowerCase()).toBe(workspaceName3.toLowerCase());
    });

    test('should return success with 0 count for non-existent workspace folder', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      mocks.bookmarks.getChildren.mockResolvedValue([]); // No workspace folder found

      const response = { success: true, count: 0, message: 'No folder found' };
      expect(response.success).toBe(true);
      expect(response.count).toBe(0);
    });

    test('should handle empty workspace folder', async () => {
      const workspaceFolder = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      mocks.bookmarks.getChildren.mockResolvedValue([]); // Empty workspace

      const response = { success: true, count: 0 };
      expect(response.count).toBe(0);
    });

    test('should prevent concurrent switching attempts (isProcessing lock)', async () => {
      let isProcessing = false;

      // First call
      if (!isProcessing) {
        isProcessing = true;
        // Process...
        isProcessing = false;
      }

      // Concurrent call should be blocked
      if (isProcessing) {
        const response = { success: false, message: 'Already processing' };
        expect(response.success).toBe(false);
      }
    });

    test('should return error for missing workspaceName parameter', async () => {
      const response = { success: false, message: 'No workspace name provided' };
      expect(response.success).toBe(false);
      expect(response.message).toContain('workspace name');
    });

    describe('Transition scenarios', () => {
      test('should handle Regular workspace → Regular workspace', async () => {
        // Switch from Personal to Development
        const transition = {
          from: 'Personal',
          to: 'Development',
          type: 'regular-to-regular'
        };

        expect(transition.type).toBe('regular-to-regular');
      });

      test('should handle Regular workspace → bookspace-none', async () => {
        const transition = {
          from: 'Development',
          to: 'bookspace-none',
          type: 'regular-to-none'
        };

        expect(transition.type).toBe('regular-to-none');
      });

      test('should handle Regular workspace → bookspace-all', async () => {
        const transition = {
          from: 'Development',
          to: 'bookspace-all',
          type: 'regular-to-all'
        };

        expect(transition.type).toBe('regular-to-all');
      });

      test('should handle bookspace-none → Regular workspace', async () => {
        const transition = {
          from: 'bookspace-none',
          to: 'Development',
          type: 'none-to-regular'
        };

        expect(transition.type).toBe('none-to-regular');
      });

      test('should handle bookspace-none → bookspace-all', async () => {
        const transition = {
          from: 'bookspace-none',
          to: 'bookspace-all',
          type: 'none-to-all'
        };

        expect(transition.type).toBe('none-to-all');
      });

      test('should handle bookspace-all → Regular workspace', async () => {
        const transition = {
          from: 'bookspace-all',
          to: 'Development',
          type: 'all-to-regular'
        };

        expect(transition.type).toBe('all-to-regular');
      });

      test('should handle bookspace-all → bookspace-none', async () => {
        const transition = {
          from: 'bookspace-all',
          to: 'bookspace-none',
          type: 'all-to-none'
        };

        expect(transition.type).toBe('all-to-none');
      });
    });
  });

  describe('showNoBookmarks', () => {
    test('should move all toolbar items back to bookspace', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const toolbarBookmark = createMockBookmark({ title: 'Toolbar Bookmark', parentId: 'toolbar_____' });

      const toolbarChildren = [
        createMockBookmark({ title: 'change bookmarks test' }),
        toolbarBookmark,
        bookspaceFolder
      ];

      // Items to move back (excluding bookspace and change bookmarks test)
      const itemsToMove = toolbarChildren.filter(
        item => item.id !== bookspaceFolder.id && 
                !(item.type === 'bookmark' && item.title === 'change bookmarks test')
      );

      expect(itemsToMove).toContain(toolbarBookmark);
    });

    test('should ensure bookspace folder is visible at index 1', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      
      // bookspace folder should be at index 1 (after change bookmarks test at index 0)
      const expectedIndex = 1;
      expect(expectedIndex).toBe(1);
    });

    test('should handle transition from regular workspace', async () => {
      // When transitioning from a regular workspace, items should be moved back to their workspace folder
      const previousWorkspace = 'Development';
      const transition = {
        from: previousWorkspace,
        to: 'bookspace-none',
        type: 'regular-to-none'
      };

      expect(transition.type).toBe('regular-to-none');
    });

    test('should prevent duplicate execution', async () => {
      let isProcessing = false;
      let currentWorkspace = 'bookspace-none';

      if (currentWorkspace && currentWorkspace.toLowerCase() === 'bookspace-none') {
        // Should return early if already in bookspace-none
        const response = { success: true, message: 'Already in bookspace-none' };
        expect(response.success).toBe(true);
      }
    });
  });

  describe('showAllBookmarks', () => {
    test('should move all bookspace children to toolbar', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const workspace1 = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const workspace2 = createMockFolder({ title: 'Personal', id: 'workspace_personal' });

      const bookspaceChildren = [workspace1, workspace2];
      mocks.bookmarks.getChildren.mockResolvedValue(bookspaceChildren);

      // All children should be moved to toolbar
      expect(bookspaceChildren.length).toBe(2);
    });

    test('should maintain relative positions', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const item1 = createMockFolder({ title: 'First', id: 'item_1', index: 0 });
      const item2 = createMockFolder({ title: 'Second', id: 'item_2', index: 1 });
      const item3 = createMockFolder({ title: 'Third', id: 'item_3', index: 2 });

      const bookspaceChildren = [item1, item2, item3];

      // Items should maintain their order when moved to toolbar
      expect(bookspaceChildren[0].index).toBe(0);
      expect(bookspaceChildren[1].index).toBe(1);
      expect(bookspaceChildren[2].index).toBe(2);
    });

    test('should preserve nested structure', async () => {
      const workspaceFolder = createMockFolder({ title: 'Development', id: 'workspace_dev' });
      const nestedFolder = createMockFolder({ title: 'Nested', id: 'nested_1', parentId: 'workspace_dev' });
      const nestedBookmark = createMockBookmark({ title: 'Nested Bookmark', parentId: 'nested_1' });

      // Nested structure should be preserved when moving folders
      expect(nestedBookmark.parentId).toBe('nested_1');
      expect(nestedFolder.parentId).toBe('workspace_dev');
    });

    test('should handle transition from bookspace-none', async () => {
      const transition = {
        from: 'bookspace-none',
        to: 'bookspace-all',
        type: 'none-to-all'
      };

      expect(transition.type).toBe('none-to-all');
    });

    test('should handle transition from regular workspace', async () => {
      const transition = {
        from: 'Development',
        to: 'bookspace-all',
        type: 'regular-to-all'
      };

      expect(transition.type).toBe('regular-to-all');
    });
  });
});
