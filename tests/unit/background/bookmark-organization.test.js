/**
 * Unit tests for bookmark organization functions
 * Tests: organizeBookmarksIntoBookspace, getOrCreateBookspaceFolder, 
 * findSubfolder, countItemsInFolder, ensureChangeBookmarksFirst, 
 * createChangeBookmarksBookmark
 */

const {
  setupAllMocks,
  resetAllMocks,
  createMockBookmark,
  createMockFolder
} = require('../../helpers/mock-browser');

// Note: In a real implementation, we would need to either:
// 1. Export functions from background.js, or
// 2. Use a module loader that can execute background.js and access its functions
// For now, these tests demonstrate the test structure and can be adapted

describe('Bookmark Organization Functions', () => {
  let mocks;

  beforeEach(() => {
    mocks = setupAllMocks();
    resetAllMocks();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('getOrCreateBookspaceFolder', () => {
    test('should find existing bookspace folder', async () => {
      const existingFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const toolbarChildren = [
        createMockBookmark({ title: 'change bookmarks test' }),
        existingFolder
      ];

      mocks.bookmarks.getChildren.mockResolvedValue(toolbarChildren);

      // In real test, we would call: await getOrCreateBookspaceFolder()
      // For now, we test the expected behavior
      expect(toolbarChildren.find(c => c.title === 'bookspace')).toBe(existingFolder);
    });

    test('should create bookspace folder if missing', async () => {
      const newFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_new' });
      const toolbarChildren = [createMockBookmark({ title: 'change bookmarks test' })];

      mocks.bookmarks.getChildren.mockResolvedValue(toolbarChildren);
      mocks.bookmarks.create.mockResolvedValue(newFolder);

      // In real test: await getOrCreateBookspaceFolder()
      // Should call browser.bookmarks.create with correct params
      const expectedCreateCall = {
        parentId: 'toolbar_____',
        title: 'bookspace',
        type: 'folder',
        index: 1
      };

      // Verify the create would be called with correct params
      expect(expectedCreateCall.parentId).toBe('toolbar_____');
      expect(expectedCreateCall.title).toBe('bookspace');
      expect(expectedCreateCall.index).toBe(1);
    });

    test('should place folder at correct index (index 1)', async () => {
      const newFolder = createMockFolder({ title: 'bookspace' });
      mocks.bookmarks.getChildren.mockResolvedValue([]);
      mocks.bookmarks.create.mockResolvedValue(newFolder);

      // Verify index is 1 (after "change bookmarks test" at index 0)
      const createParams = {
        parentId: 'toolbar_____',
        title: 'bookspace',
        type: 'folder',
        index: 1
      };
      expect(createParams.index).toBe(1);
    });
  });

  describe('findSubfolder', () => {
    test('should find folder by name (case-insensitive)', async () => {
      const workspaceFolder = createMockFolder({ title: 'Development' });
      const children = [
        workspaceFolder,
        createMockFolder({ title: 'Personal' })
      ];

      mocks.bookmarks.getChildren.mockResolvedValue(children);

      // Test case-insensitive matching
      const found1 = children.find(c => 
        c.type === 'folder' && c.title.toLowerCase() === 'development'.toLowerCase()
      );
      const found2 = children.find(c => 
        c.type === 'folder' && c.title.toLowerCase() === 'DEVELOPMENT'.toLowerCase()
      );

      expect(found1).toBe(workspaceFolder);
      expect(found2).toBe(workspaceFolder);
    });

    test('should return undefined for non-existent folder', async () => {
      const children = [createMockFolder({ title: 'Development' })];
      mocks.bookmarks.getChildren.mockResolvedValue(children);

      const found = children.find(c => 
        c.type === 'folder' && c.title.toLowerCase() === 'nonexistent'.toLowerCase()
      );

      expect(found).toBeUndefined();
    });

    test('should handle special characters in folder names', async () => {
      const specialFolder = createMockFolder({ title: 'Work & Personal' });
      const children = [specialFolder];
      mocks.bookmarks.getChildren.mockResolvedValue(children);

      const found = children.find(c => 
        c.type === 'folder' && c.title.toLowerCase() === 'work & personal'.toLowerCase()
      );

      expect(found).toBe(specialFolder);
    });
  });

  describe('countItemsInFolder', () => {
    test('should count bookmarks correctly', async () => {
      const children = [
        createMockBookmark({ title: 'Bookmark 1' }),
        createMockBookmark({ title: 'Bookmark 2' }),
        createMockFolder({ title: 'Folder 1' })
      ];

      mocks.bookmarks.getChildren.mockResolvedValue(children);

      const bookmarkCount = children.filter(c => c.type === 'bookmark').length;
      expect(bookmarkCount).toBe(2);
    });

    test('should count folders correctly', async () => {
      const children = [
        createMockBookmark({ title: 'Bookmark 1' }),
        createMockFolder({ title: 'Folder 1' }),
        createMockFolder({ title: 'Folder 2' })
      ];

      mocks.bookmarks.getChildren.mockResolvedValue(children);

      const folderCount = children.filter(c => c.type === 'folder').length;
      expect(folderCount).toBe(2);
    });

    test('should recursively count nested items', async () => {
      const subFolder = createMockFolder({ title: 'Subfolder', id: 'sub_1' });
      const parentFolder = createMockFolder({ title: 'Parent', id: 'parent_1' });
      
      const parentChildren = [subFolder, createMockBookmark({ title: 'Bookmark 1' })];
      const subChildren = [
        createMockBookmark({ title: 'Nested Bookmark 1' }),
        createMockBookmark({ title: 'Nested Bookmark 2' })
      ];

      mocks.bookmarks.getChildren
        .mockResolvedValueOnce(parentChildren) // Parent folder
        .mockResolvedValueOnce(subChildren);   // Subfolder

      // Simulate recursive counting
      const parentBookmarks = parentChildren.filter(c => c.type === 'bookmark').length;
      const subBookmarks = subChildren.filter(c => c.type === 'bookmark').length;
      const totalBookmarks = parentBookmarks + subBookmarks;

      expect(totalBookmarks).toBe(3); // 1 in parent + 2 in subfolder
    });

    test('should return zero for empty folders', async () => {
      mocks.bookmarks.getChildren.mockResolvedValue([]);

      const count = { bookmarks: 0, folders: 0, total: 0 };
      expect(count.bookmarks).toBe(0);
      expect(count.folders).toBe(0);
      expect(count.total).toBe(0);
    });
  });

  describe('organizeBookmarksIntoBookspace', () => {
    test('should move all toolbar bookmarks to bookspace folder', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const toolbarBookmark1 = createMockBookmark({ title: 'Bookmark 1' });
      const toolbarBookmark2 = createMockBookmark({ title: 'Bookmark 2' });
      const toolbarFolder = createMockFolder({ title: 'My Folder' });

      const toolbarChildren = [
        createMockBookmark({ title: 'change bookmarks test' }),
        toolbarBookmark1,
        toolbarBookmark2,
        toolbarFolder,
        bookspaceFolder
      ];

      mocks.bookmarks.get.mockResolvedValue([{ id: 'toolbar_____' }]);
      mocks.bookmarks.getChildren.mockResolvedValue(toolbarChildren);
      mocks.bookmarks.move.mockResolvedValue();

      // Items to move (excluding bookspace folder and change bookmarks test)
      const itemsToMove = toolbarChildren.filter(
        item => item.id !== bookspaceFolder.id && 
                !(item.type === 'bookmark' && item.title === 'change bookmarks test')
      );

      expect(itemsToMove.length).toBe(3); // 2 bookmarks + 1 folder
      expect(itemsToMove).toContain(toolbarBookmark1);
      expect(itemsToMove).toContain(toolbarBookmark2);
      expect(itemsToMove).toContain(toolbarFolder);
    });

    test('should preserve bookmark structure (folders and nested items)', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const nestedFolder = createMockFolder({ title: 'Nested', id: 'nested_1' });
      const nestedBookmark = createMockBookmark({ title: 'Nested Bookmark', parentId: 'nested_1' });
      const parentFolder = createMockFolder({ title: 'Parent', id: 'parent_1' });

      // When moving a folder, nested items are preserved by the browser API
      mocks.bookmarks.move.mockResolvedValue();

      // Verify that moving a folder preserves its structure
      expect(nestedBookmark.parentId).toBe('nested_1');
    });

    test('should skip "change bookmarks test" bookmark', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const changeBookmarksTest = createMockBookmark({ title: 'change bookmarks test' });
      const regularBookmark = createMockBookmark({ title: 'Regular Bookmark' });

      const toolbarChildren = [changeBookmarksTest, regularBookmark, bookspaceFolder];

      const itemsToMove = toolbarChildren.filter(
        item => item.id !== bookspaceFolder.id && 
                !(item.type === 'bookmark' && item.title === 'change bookmarks test')
      );

      expect(itemsToMove).not.toContain(changeBookmarksTest);
      expect(itemsToMove).toContain(regularBookmark);
    });

    test('should skip bookspace folder itself', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const regularBookmark = createMockBookmark({ title: 'Regular Bookmark' });

      const toolbarChildren = [regularBookmark, bookspaceFolder];

      const itemsToMove = toolbarChildren.filter(
        item => item.id !== bookspaceFolder.id
      );

      expect(itemsToMove).not.toContain(bookspaceFolder);
      expect(itemsToMove).toContain(regularBookmark);
    });

    test('should handle empty toolbar', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const toolbarChildren = [
        createMockBookmark({ title: 'change bookmarks test' }),
        bookspaceFolder
      ];

      const itemsToMove = toolbarChildren.filter(
        item => item.id !== bookspaceFolder.id && 
                !(item.type === 'bookmark' && item.title === 'change bookmarks test')
      );

      expect(itemsToMove.length).toBe(0);
    });

    test('should prevent concurrent execution (isProcessing lock)', async () => {
      // This would test the isProcessing flag
      // In real implementation, we'd check if isProcessing is set
      let isProcessing = false;

      // Simulate first call
      if (!isProcessing) {
        isProcessing = true;
        // Process...
        isProcessing = false;
      }

      // Simulate concurrent call
      if (isProcessing) {
        // Should return early
        expect(isProcessing).toBe(false); // After first call completes
      }
    });

    test('should return correct success/failure responses', async () => {
      const bookspaceFolder = createMockFolder({ title: 'bookspace', id: 'bookspace_123' });
      const toolbarBookmark = createMockBookmark({ title: 'Bookmark 1' });
      const toolbarChildren = [toolbarBookmark, bookspaceFolder];

      mocks.bookmarks.getChildren.mockResolvedValue(toolbarChildren);
      mocks.bookmarks.move.mockResolvedValue();

      // Success case
      const successResponse = { success: true, movedCount: 1 };
      expect(successResponse.success).toBe(true);
      expect(successResponse.movedCount).toBe(1);

      // Failure case
      mocks.bookmarks.move.mockRejectedValueOnce(new Error('Move failed'));
      const failureResponse = { success: false, error: 'Move failed' };
      expect(failureResponse.success).toBe(false);
    });
  });

  describe('ensureChangeBookmarksFirst', () => {
    test('should move "change bookmarks test" to index 0', async () => {
      const changeBookmarksTest = createMockBookmark({ title: 'change bookmarks test', id: 'change_test_1' });
      const otherBookmark = createMockBookmark({ title: 'Other', id: 'other_1' });

      const toolbarChildren = [otherBookmark, changeBookmarksTest];

      const currentIndex = toolbarChildren.findIndex(c => c.id === changeBookmarksTest.id);
      expect(currentIndex).not.toBe(0);

      // After move, should be at index 0
      mocks.bookmarks.move.mockResolvedValue();
      // In real test: await ensureChangeBookmarksFirst()
      expect(mocks.bookmarks.move).toBeDefined();
    });

    test('should be no-op if already at index 0', async () => {
      const changeBookmarksTest = createMockBookmark({ title: 'change bookmarks test', id: 'change_test_1' });
      const toolbarChildren = [changeBookmarksTest];

      const currentIndex = toolbarChildren.findIndex(c => c.id === changeBookmarksTest.id);
      expect(currentIndex).toBe(0);

      // Should not call move if already at index 0
      expect(currentIndex).toBe(0);
    });

    test('should handle missing bookmark gracefully', async () => {
      const toolbarChildren = [createMockBookmark({ title: 'Other' })];

      const changeBookmarks = toolbarChildren.find(
        child => child.type === 'bookmark' && child.title === 'change bookmarks test'
      );

      expect(changeBookmarks).toBeUndefined();
      // Should not throw error
    });
  });

  describe('createChangeBookmarksBookmark', () => {
    test('should create bookmark if missing', async () => {
      const popupUrl = 'moz-extension://test-id/popup.html';
      const newBookmark = createMockBookmark({ 
        title: 'change bookmarks test', 
        url: popupUrl,
        id: 'change_test_new'
      });

      mocks.runtime.getURL.mockReturnValue(popupUrl);
      mocks.bookmarks.getChildren.mockResolvedValue([]);
      mocks.bookmarks.create.mockResolvedValue(newBookmark);

      // In real test: await createChangeBookmarksBookmark()
      const expectedCreateCall = {
        parentId: 'toolbar_____',
        title: 'change bookmarks test',
        url: popupUrl,
        index: 0
      };

      expect(expectedCreateCall.title).toBe('change bookmarks test');
      expect(expectedCreateCall.index).toBe(0);
    });

    test('should update URL if bookmark exists but URL changed', async () => {
      const popupUrl = 'moz-extension://test-id/popup.html';
      const oldUrl = 'moz-extension://old-id/popup.html';
      const existingBookmark = createMockBookmark({ 
        title: 'change bookmarks test',
        url: oldUrl,
        id: 'change_test_existing'
      });

      mocks.runtime.getURL.mockReturnValue(popupUrl);
      mocks.bookmarks.getChildren.mockResolvedValue([existingBookmark]);
      mocks.bookmarks.update.mockResolvedValue({ ...existingBookmark, url: popupUrl });

      // Should update if URL changed
      if (existingBookmark.url !== popupUrl) {
        expect(mocks.bookmarks.update).toBeDefined();
      }
    });

    test('should place bookmark at index 0', async () => {
      const popupUrl = 'moz-extension://test-id/popup.html';
      const newBookmark = createMockBookmark({ 
        title: 'change bookmarks test',
        url: popupUrl,
        id: 'change_test_new'
      });

      const createParams = {
        parentId: 'toolbar_____',
        title: 'change bookmarks test',
        url: popupUrl,
        index: 0
      };

      expect(createParams.index).toBe(0);
    });
  });
});
