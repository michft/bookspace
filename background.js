/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Bookspace Extension
 * 
 * Updates bookmarks in a folder matching the workspace name when a workspace is loaded.
 * The folder is synced with the currently open tabs in the workspace.
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
 * Get all bookmark URLs from a folder (non-recursive, only direct children)
 */
async function getBookmarkUrls(folder) {
  const urls = [];
  
  if (!folder || !folder.children) {
    return urls;
  }
  
  for (const child of folder.children) {
    if (child.type === 'bookmark' && child.url) {
      urls.push(child.url);
    }
  }
  
  return urls;
}

/**
 * Get all bookmarks from a folder (returns bookmark objects)
 */
async function getBookmarksInFolder(folder) {
  const bookmarks = [];
  
  if (!folder || !folder.children) {
    return bookmarks;
  }
  
  for (const child of folder.children) {
    if (child.type === 'bookmark') {
      bookmarks.push(child);
    }
  }
  
  return bookmarks;
}

/**
 * Create or get bookmark folder by name
 */
async function getOrCreateBookmarkFolder(folderName) {
  // First try to find existing folder
  let folder = await findBookmarkFolder(folderName);
  
  if (folder) {
    return folder;
  }
  
  // If not found, create it in the bookmarks toolbar
  try {
    const toolbar = await browser.bookmarks.get('toolbar_____');
    const newFolder = await browser.bookmarks.create({
      parentId: toolbar[0].id,
      title: folderName,
      type: 'folder'
    });
    
    console.log(`Bookspace: Created bookmark folder "${folderName}"`);
    return newFolder;
  } catch (error) {
    console.error('Bookspace: Error creating bookmark folder:', error);
    // Fallback: try to create in "Other Bookmarks"
    try {
      const otherBookmarks = await browser.bookmarks.get('unfiled_____');
      const newFolder = await browser.bookmarks.create({
        parentId: otherBookmarks[0].id,
        title: folderName,
        type: 'folder'
      });
      return newFolder;
    } catch (fallbackError) {
      console.error('Bookspace: Error creating folder in fallback location:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Update bookmarks in a folder to match current tabs
 */
async function updateBookmarksFolder(folderName) {
  if (isProcessing) {
    console.log('Bookspace: Already processing, skipping...');
    return;
  }
  
  isProcessing = true;
  
  try {
    // Get all current tabs
    const tabs = await browser.tabs.query({});
    
    if (tabs.length === 0) {
      console.log('Bookspace: No tabs to bookmark');
      isProcessing = false;
      return { success: true, count: 0 };
    }
    
    // Get or create the folder
    const folder = await getOrCreateBookmarkFolder(folderName);
    
    // Get existing bookmarks in the folder
    const existingBookmarks = await getBookmarksInFolder(folder);
    const existingUrls = new Set(existingBookmarks.map(b => b.url));
    
    // Get URLs from current tabs (filter out special pages)
    const tabUrls = tabs
      .filter(tab => tab.url && 
        !tab.url.startsWith('about:') && 
        !tab.url.startsWith('moz-extension:') &&
        !tab.url.startsWith('chrome:') &&
        !tab.url.startsWith('zen:'))
      .map(tab => ({
        url: tab.url,
        title: tab.title || tab.url
      }));
    
    const currentUrls = new Set(tabUrls.map(t => t.url));
    
    // Remove bookmarks that are no longer in current tabs
    for (const bookmark of existingBookmarks) {
      if (!currentUrls.has(bookmark.url)) {
        try {
          await browser.bookmarks.remove(bookmark.id);
          console.log(`Bookspace: Removed bookmark "${bookmark.title}"`);
        } catch (error) {
          console.error(`Bookspace: Error removing bookmark:`, error);
        }
      }
    }
    
    // Add new bookmarks for tabs that aren't bookmarked yet
    let addedCount = 0;
    for (const tab of tabUrls) {
      if (!existingUrls.has(tab.url)) {
        try {
          await browser.bookmarks.create({
            parentId: folder.id,
            title: tab.title,
            url: tab.url
          });
          addedCount++;
          console.log(`Bookspace: Added bookmark "${tab.title}"`);
        } catch (error) {
          console.error(`Bookspace: Error creating bookmark for ${tab.url}:`, error);
        }
      }
    }
    
    // Update existing bookmarks if titles changed
    for (const tab of tabUrls) {
      const existingBookmark = existingBookmarks.find(b => b.url === tab.url);
      if (existingBookmark && existingBookmark.title !== tab.title) {
        try {
          await browser.bookmarks.update(existingBookmark.id, {
            title: tab.title
          });
          console.log(`Bookspace: Updated bookmark title for "${tab.url}"`);
        } catch (error) {
          console.error(`Bookspace: Error updating bookmark:`, error);
        }
      }
    }
    
    console.log(`Bookspace: Updated folder "${folderName}" with ${tabUrls.length} bookmarks (added ${addedCount} new)`);
    isProcessing = false;
    return { success: true, count: tabUrls.length, added: addedCount };
    
  } catch (error) {
    console.error('Bookspace: Error updating bookmarks folder:', error);
    isProcessing = false;
    throw error;
  }
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
      
      // Update bookmarks folder to match current tabs
      await updateBookmarksFolder(workspaceName).catch(err => {
        console.error('Bookspace: Error updating bookmarks for workspace:', err);
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
    
    // Open bookmarks from folder
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
  
  if (message.action === 'updateBookmarks') {
    const workspaceName = message.workspaceName;
    
    // Update bookmarks folder to match current tabs
    updateBookmarksFolder(workspaceName).then((result) => {
      sendResponse(result);
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
});

console.log('Bookspace: Extension loaded and monitoring for workspace changes');
