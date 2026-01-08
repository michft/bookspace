/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Bookspace Extension
 * 
 * Filters bookmarks display based on the current workspace name.
 * When a workspace is active, only bookmarks from a folder matching
 * the workspace name are displayed. If no matching folder exists,
 * all bookmarks are shown.
 */

// Store the current workspace name and state
let currentWorkspaceName = null;
let isProcessing = false;

// Store the original bookmarks toolbar state
let originalToolbarBookmarks = [];
let workspaceFolder = null;

/**
 * Get the bookmarks toolbar folder
 */
async function getToolbarFolder() {
  try {
    const tree = await browser.bookmarks.getTree();
    // The toolbar folder is typically the second child of the root
    // In Firefox/Zen, it has the id 'toolbar_____'
    function findToolbar(nodes) {
      for (const node of nodes) {
        if (node.id === 'toolbar_____' || node.title === 'Bookmarks Toolbar') {
          return node;
        }
        if (node.children) {
          const found = findToolbar(node.children);
          if (found) return found;
        }
      }
      return null;
    }
    return findToolbar(tree);
  } catch (error) {
    console.error('Bookspace: Error getting toolbar folder:', error);
    return null;
  }
}

/**
 * Find a bookmark folder by name within a parent folder (case-insensitive)
 */
async function findFolderByName(parentFolder, folderName) {
  if (!parentFolder || !parentFolder.children) {
    // If no children loaded, fetch them
    if (parentFolder && parentFolder.id) {
      try {
        const children = await browser.bookmarks.getChildren(parentFolder.id);
        parentFolder.children = children;
      } catch (error) {
        console.error('Bookspace: Error getting children:', error);
        return null;
      }
    } else {
      return null;
    }
  }
  
  for (const child of parentFolder.children) {
    if (child.type === 'folder' && 
        child.title.toLowerCase() === folderName.toLowerCase()) {
      return child;
    }
  }
  return null;
}

/**
 * Find a bookmark folder anywhere in the bookmarks tree
 */
async function findBookmarkFolder(folderName) {
  try {
    const bookmarks = await browser.bookmarks.getTree();
    
    function searchFolders(nodes) {
      for (const node of nodes) {
        if (node.type === 'folder' && 
            node.title && 
            node.title.toLowerCase() === folderName.toLowerCase()) {
          return node;
        }
        if (node.children) {
          const found = searchFolders(node.children);
          if (found) return found;
        }
      }
      return null;
    }
    
    return searchFolders(bookmarks);
  } catch (error) {
    console.error('Bookspace: Error finding bookmark folder:', error);
    return null;
  }
}

/**
 * Get all bookmarks from a folder
 */
async function getBookmarksInFolder(folderId) {
  try {
    const children = await browser.bookmarks.getChildren(folderId);
    return children.filter(child => child.type === 'bookmark' || child.url);
  } catch (error) {
    console.error('Bookspace: Error getting bookmarks in folder:', error);
    return [];
  }
}

/**
 * Get all bookmarks from a folder including subfolders
 */
async function getAllBookmarksInFolder(folderId) {
  const bookmarks = [];
  
  try {
    const children = await browser.bookmarks.getChildren(folderId);
    
    for (const child of children) {
      if (child.type === 'bookmark' || child.url) {
        bookmarks.push(child);
      } else if (child.type === 'folder') {
        // Recursively get bookmarks from subfolders
        const subBookmarks = await getAllBookmarksInFolder(child.id);
        bookmarks.push(...subBookmarks);
      }
    }
  } catch (error) {
    console.error('Bookspace: Error getting all bookmarks:', error);
  }
  
  return bookmarks;
}

/**
 * Apply workspace bookmark filter
 * This updates the extension state and notifies any open popups
 */
async function applyWorkspaceFilter(workspaceName) {
  if (isProcessing) {
    console.log('Bookspace: Already processing, skipping...');
    return;
  }
  
  isProcessing = true;
  
  try {
    console.log(`Bookspace: Applying filter for workspace "${workspaceName}"`);
    
    // Find folder matching workspace name
    const folder = await findBookmarkFolder(workspaceName);
    
    if (folder) {
      workspaceFolder = folder;
      console.log(`Bookspace: Found matching folder "${folder.title}" (${folder.id})`);
      
      // Get bookmarks from the workspace folder
      const bookmarks = await getAllBookmarksInFolder(folder.id);
      console.log(`Bookspace: Folder contains ${bookmarks.length} bookmarks`);
      
      // Store the current state
      await browser.storage.local.set({
        currentWorkspace: workspaceName,
        hasMatchingFolder: true,
        workspaceFolderId: folder.id,
        bookmarkCount: bookmarks.length
      });
      
    } else {
      workspaceFolder = null;
      console.log(`Bookspace: No folder found matching "${workspaceName}", showing all bookmarks`);
      
      // Store the state indicating no matching folder
      await browser.storage.local.set({
        currentWorkspace: workspaceName,
        hasMatchingFolder: false,
        workspaceFolderId: null,
        bookmarkCount: 0
      });
    }
    
    currentWorkspaceName = workspaceName;
    
  } catch (error) {
    console.error('Bookspace: Error applying workspace filter:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Get bookmarks for the current workspace
 * Returns bookmarks from the matching folder, or all bookmarks if no match
 */
async function getWorkspaceBookmarks(workspaceName) {
  const folder = await findBookmarkFolder(workspaceName);
  
  if (folder) {
    // Return bookmarks from the workspace folder
    const bookmarks = await getAllBookmarksInFolder(folder.id);
    return {
      filtered: true,
      folderName: folder.title,
      bookmarks: bookmarks
    };
  } else {
    // Return all bookmarks from toolbar
    const toolbar = await getToolbarFolder();
    if (toolbar) {
      const bookmarks = await getAllBookmarksInFolder(toolbar.id);
      return {
        filtered: false,
        folderName: null,
        bookmarks: bookmarks
      };
    }
    return {
      filtered: false,
      folderName: null,
      bookmarks: []
    };
  }
}

/**
 * Check for workspace changes by reading from storage
 */
async function checkWorkspaceChange() {
  try {
    // Try to get workspace info from storage
    const result = await browser.storage.local.get([
      'zenWorkspace', 
      'activeWorkspace', 
      'workspaceName',
      'bookspaceWorkspace'
    ]);
    
    const workspaceName = result.bookspaceWorkspace || 
                          result.zenWorkspace || 
                          result.activeWorkspace || 
                          result.workspaceName;
    
    if (workspaceName && workspaceName !== currentWorkspaceName) {
      console.log(`Bookspace: Workspace changed from "${currentWorkspaceName}" to "${workspaceName}"`);
      await applyWorkspaceFilter(workspaceName);
    }
  } catch (error) {
    console.debug('Bookspace: Could not read workspace from storage:', error.message);
  }
}

/**
 * Listen for storage changes
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    const workspaceKeys = ['zenWorkspace', 'activeWorkspace', 'workspaceName', 'bookspaceWorkspace'];
    const hasWorkspaceChange = workspaceKeys.some(key => key in changes);
    
    if (hasWorkspaceChange) {
      checkWorkspaceChange();
    }
  }
});

/**
 * Poll for workspace changes periodically
 */
setInterval(checkWorkspaceChange, 2000);

/**
 * Initial check when extension loads
 */
browser.runtime.onStartup.addListener(() => {
  checkWorkspaceChange();
});

browser.runtime.onInstalled.addListener(() => {
  checkWorkspaceChange();
});

// Initial check
checkWorkspaceChange();

/**
 * Listen for messages from popup
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getBookmarks') {
    const workspaceName = message.workspaceName;
    
    getWorkspaceBookmarks(workspaceName).then((result) => {
      sendResponse(result);
    }).catch((error) => {
      sendResponse({ error: error.message });
    });
    
    return true;
  }
  
  if (message.action === 'setWorkspace') {
    const workspaceName = message.workspaceName;
    
    // Store the workspace name and apply filter
    browser.storage.local.set({ bookspaceWorkspace: workspaceName }).then(() => {
      return applyWorkspaceFilter(workspaceName);
    }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true;
  }
  
  if (message.action === 'getCurrentState') {
    browser.storage.local.get([
      'currentWorkspace',
      'hasMatchingFolder',
      'workspaceFolderId',
      'bookmarkCount'
    ]).then((state) => {
      sendResponse(state);
    }).catch((error) => {
      sendResponse({ error: error.message });
    });
    
    return true;
  }
  
  if (message.action === 'openBookmark') {
    const url = message.url;
    browser.tabs.create({ url: url }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true;
  }
  
  if (message.action === 'openAllBookmarks') {
    const workspaceName = message.workspaceName;
    
    getWorkspaceBookmarks(workspaceName).then(async (result) => {
      for (const bookmark of result.bookmarks) {
        if (bookmark.url) {
          await browser.tabs.create({ url: bookmark.url, active: false });
        }
      }
      sendResponse({ success: true, count: result.bookmarks.length });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true;
  }
});

console.log('Bookspace: Extension loaded - filtering bookmarks by workspace');
