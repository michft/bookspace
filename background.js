/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Bookspace Extension
 * 
 * Loads bookmarks from a folder matching the workspace name when a workspace is loaded.
 * Since we can't directly access zen-browser's internal workspace API, we use
 * storage events and polling to detect workspace changes.
 */

// Store the last known workspace name
let lastWorkspaceName = null;
let isProcessing = false;

/**
 * Find a bookmark folder by name (case-insensitive)
 */
async function findBookmarkFolder(folderName) {
  try {
    const bookmarks = await browser.bookmarks.getTree();
    
    function searchFolders(nodes) {
      for (const node of nodes) {
        if (node.type === 'folder' && 
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
 * Get all bookmark URLs from a folder recursively
 */
async function getBookmarkUrls(folder) {
  const urls = [];
  
  if (!folder || !folder.children) {
    return urls;
  }
  
  for (const child of folder.children) {
    if (child.type === 'bookmark' && child.url) {
      urls.push(child.url);
    } else if (child.type === 'folder') {
      // Recursively get bookmarks from subfolders
      const subUrls = await getBookmarkUrls(child);
      urls.push(...subUrls);
    }
  }
  
  return urls;
}

/**
 * Open bookmarks from a folder in new tabs
 */
async function openBookmarksFromFolder(folderName) {
  if (isProcessing) {
    console.log('Bookspace: Already processing, skipping...');
    return;
  }
  
  isProcessing = true;
  
  try {
    const folder = await findBookmarkFolder(folderName);
    
    if (!folder) {
      console.log(`Bookspace: No bookmark folder found matching "${folderName}"`);
      isProcessing = false;
      return { success: false, count: 0 };
    }
    
    const urls = await getBookmarkUrls(folder);
    
    if (urls.length === 0) {
      console.log(`Bookspace: Folder "${folderName}" contains no bookmarks`);
      isProcessing = false;
      return { success: true, count: 0 };
    }
    
    console.log(`Bookspace: Opening ${urls.length} bookmarks from folder "${folderName}"`);
    
    // Open all bookmarks in new tabs
    for (const url of urls) {
      try {
        await browser.tabs.create({ url: url, active: false });
      } catch (error) {
        console.error(`Bookspace: Error opening bookmark ${url}:`, error);
      }
    }
    
    // Activate the first tab
    if (urls.length > 0) {
      const tabs = await browser.tabs.query({});
      const newTabs = tabs.filter(tab => urls.includes(tab.url));
      if (newTabs.length > 0) {
        await browser.tabs.update(newTabs[0].id, { active: true });
      }
    }
    
    isProcessing = false;
    return { success: true, count: urls.length };
    
  } catch (error) {
    console.error('Bookspace: Error opening bookmarks:', error);
    isProcessing = false;
    throw error;
  }
}

/**
 * Check for workspace changes by reading from storage
 * Zen-browser might store workspace info in browser.storage
 */
async function checkWorkspaceChange() {
  try {
    // Try to get workspace info from storage
    // Zen-browser might store this in local storage
    const result = await browser.storage.local.get(['zenWorkspace', 'activeWorkspace', 'workspaceName']);
    
    const workspaceName = result.zenWorkspace || result.activeWorkspace || result.workspaceName;
    
    if (workspaceName && workspaceName !== lastWorkspaceName) {
      console.log(`Bookspace: Workspace changed from "${lastWorkspaceName}" to "${workspaceName}"`);
      lastWorkspaceName = workspaceName;
      
      // Load bookmarks for the new workspace
      await openBookmarksFromFolder(workspaceName).catch(err => {
        console.error('Bookspace: Error loading bookmarks for workspace:', err);
      });
    }
  } catch (error) {
    // Storage might not be available or workspace info might not be stored there
    // This is expected if zen-browser doesn't expose workspace info via storage
    console.debug('Bookspace: Could not read workspace from storage:', error.message);
  }
}

/**
 * Listen for storage changes (in case zen-browser updates workspace info in storage)
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Check if workspace-related keys changed
    const workspaceKeys = ['zenWorkspace', 'activeWorkspace', 'workspaceName'];
    const hasWorkspaceChange = workspaceKeys.some(key => key in changes);
    
    if (hasWorkspaceChange) {
      checkWorkspaceChange();
    }
  }
});

/**
 * Listen for tab/window changes as a fallback mechanism
 * When a new window is created or tabs change significantly, it might indicate a workspace change
 */
let lastTabCount = 0;
browser.tabs.onCreated.addListener(async (tab) => {
  // Check workspace change when tabs are created
  await checkWorkspaceChange();
});

browser.windows.onCreated.addListener(async (window) => {
  // Check workspace change when new windows are created
  await checkWorkspaceChange();
});

/**
 * Poll for workspace changes periodically as a fallback
 * This is less efficient but necessary if zen-browser doesn't expose workspace info via storage
 */
setInterval(checkWorkspaceChange, 2000); // Check every 2 seconds

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

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'loadBookmarks') {
    const workspaceName = message.workspaceName;
    
    openBookmarksFromFolder(workspaceName).then(async () => {
      try {
        const folder = await findBookmarkFolder(workspaceName);
        if (folder) {
          const urls = await getBookmarkUrls(folder);
          sendResponse({ success: true, count: urls.length });
        } else {
          sendResponse({ success: false, error: `No folder found matching "${workspaceName}"` });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
});

console.log('Bookspace: Extension loaded and monitoring for workspace changes');
