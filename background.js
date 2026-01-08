/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * bookspace Extension
 * 
 * Manages bookmarks by workspace. On load, moves all toolbar bookmarks into a 
 * "bookspace" folder, preserving their structure. Then displays only bookmarks
 * from a folder matching the current workspace name.
 */

const BOOKSPACE_FOLDER_NAME = 'bookspace';
const TOOLBAR_ID = 'toolbar_____';

let isProcessing = false;
let currentWorkspace = null;

/**
 * Get the bookmarks toolbar folder
 */
async function getToolbarFolder() {
  try {
    const results = await browser.bookmarks.get(TOOLBAR_ID);
    return results[0];
  } catch (error) {
    console.error('bookspace: Error getting toolbar folder:', error);
    return null;
  }
}

/**
 * Get children of a folder
 */
async function getFolderChildren(folderId) {
  try {
    return await browser.bookmarks.getChildren(folderId);
  } catch (error) {
    console.error('bookspace: Error getting folder children:', error);
    return [];
  }
}

/**
 * Find the bookspace folder in the toolbar, or create it if it doesn't exist
 */
async function getOrCreateBookspaceFolder() {
  const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
  
  // Look for existing bookspace folder
  const existingFolder = toolbarChildren.find(
    child => child.type === 'folder' && child.title === BOOKSPACE_FOLDER_NAME
  );
  
  if (existingFolder) {
    console.log('bookspace: Found existing bookspace folder');
    return existingFolder;
  }
  
  // Create bookspace folder at the end of the toolbar
  console.log('bookspace: Creating bookspace folder');
  const newFolder = await browser.bookmarks.create({
    parentId: TOOLBAR_ID,
    title: BOOKSPACE_FOLDER_NAME,
    type: 'folder'
  });
  
  return newFolder;
}

/**
 * Find a subfolder by name within a parent folder (case-insensitive)
 */
async function findSubfolder(parentId, folderName) {
  const children = await getFolderChildren(parentId);
  return children.find(
    child => child.type === 'folder' && 
             child.title.toLowerCase() === folderName.toLowerCase()
  );
}

/**
 * Move all bookmarks from toolbar root into bookspace folder
 * This preserves the structure - folders and bookmarks are moved as-is
 */
async function organizeBookmarksIntoBookspace() {
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
    
    let movedCount = 0;
    
    // Move all items except the bookspace folder itself and the "change bookmarks" bookmark
    for (const item of toolbarChildren) {
      if (item.id === bookspaceFolder.id) {
        continue; // Skip the bookspace folder itself
      }
      if (item.type === 'bookmark' && item.title === 'change bookmarks') {
        continue; // Skip the change bookmarks bookmark
      }
      
      try {
        await browser.bookmarks.move(item.id, {
          parentId: bookspaceFolder.id
        });
        movedCount++;
        console.log(`bookspace: Moved "${item.title}" into bookspace folder`);
      } catch (error) {
        console.error(`bookspace: Error moving "${item.title}":`, error);
      }
    }
    
    console.log(`bookspace: Organized ${movedCount} items into bookspace folder`);
    isProcessing = false;
    return { success: true, movedCount };
    
  } catch (error) {
    console.error('bookspace: Error organizing bookmarks:', error);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Display bookmarks from a specific workspace folder
 * Moves bookmarks from bookspace/{workspaceName} to toolbar root
 * and moves previous workspace's bookmarks back into their folder
 */
async function switchToWorkspace(workspaceName) {
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  if (!workspaceName) {
    return { success: false, message: 'No workspace name provided' };
  }
  
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // First, if there's a current workspace, move its bookmarks back into their folder
    if (currentWorkspace && currentWorkspace !== workspaceName) {
      const previousWorkspaceFolder = await findSubfolder(bookspaceFolder.id, currentWorkspace);
      
      if (previousWorkspaceFolder) {
        // Get all items currently in toolbar (except bookspace folder and change bookmarks)
        const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
        const itemsToMoveBack = toolbarChildren.filter(
          item => item.id !== bookspaceFolder.id && 
                  !(item.type === 'bookmark' && item.title === 'change bookmarks')
        );
        
        // Move them back into the previous workspace folder
        for (const item of itemsToMoveBack) {
          try {
            await browser.bookmarks.move(item.id, {
              parentId: previousWorkspaceFolder.id
            });
            console.log(`bookspace: Moved "${item.title}" back into "${currentWorkspace}" folder`);
          } catch (error) {
            console.error(`bookspace: Error moving "${item.title}" back:`, error);
          }
        }
      }
    } else {
      // No previous workspace, just move any loose items back into bookspace root
      const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
      for (const item of toolbarChildren) {
        if (item.id === bookspaceFolder.id) continue;
        if (item.type === 'bookmark' && item.title === 'change bookmarks') continue;
        
        try {
          await browser.bookmarks.move(item.id, {
            parentId: bookspaceFolder.id
          });
          console.log(`bookspace: Moved "${item.title}" back into bookspace`);
        } catch (error) {
          console.error(`bookspace: Error moving "${item.title}" back:`, error);
        }
      }
    }
    
    // Find the new workspace folder inside bookspace
    const workspaceFolder = await findSubfolder(bookspaceFolder.id, workspaceName);
    
    if (!workspaceFolder) {
      console.log(`bookspace: No folder found for workspace "${workspaceName}"`);
      isProcessing = false;
      currentWorkspace = workspaceName;
      return { 
        success: true, 
        message: `No folder "${workspaceName}" found - toolbar is empty`,
        count: 0 
      };
    }
    
    // Move all items from new workspace folder to toolbar root
    const workspaceChildren = await getFolderChildren(workspaceFolder.id);
    let displayedCount = 0;
    
    for (const item of workspaceChildren) {
      try {
        await browser.bookmarks.move(item.id, {
          parentId: TOOLBAR_ID,
          index: displayedCount // Place before bookspace folder
        });
        displayedCount++;
        console.log(`bookspace: Displayed "${item.title}" in toolbar`);
      } catch (error) {
        console.error(`bookspace: Error displaying "${item.title}":`, error);
      }
    }
    
    currentWorkspace = workspaceName;
    console.log(`bookspace: Switched to workspace "${workspaceName}" - displaying ${displayedCount} items`);
    isProcessing = false;
    return { success: true, count: displayedCount };
    
  } catch (error) {
    console.error('bookspace: Error switching workspace:', error);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Show all bookmarks (move everything from bookspace subfolders to toolbar)
 */
async function showAllBookmarks() {
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // First, move any loose items in toolbar back into bookspace (except change bookmarks)
    const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
    for (const item of toolbarChildren) {
      if (item.id === bookspaceFolder.id) continue;
      if (item.type === 'bookmark' && item.title === 'change bookmarks') continue;
      
      await browser.bookmarks.move(item.id, {
        parentId: bookspaceFolder.id
      });
    }
    
    // Now move all bookspace children to toolbar
    const bookspaceChildren = await getFolderChildren(bookspaceFolder.id);
    let count = 0;
    
    for (const item of bookspaceChildren) {
      try {
        await browser.bookmarks.move(item.id, {
          parentId: TOOLBAR_ID,
          index: count
        });
        count++;
      } catch (error) {
        console.error(`bookspace: Error moving "${item.title}":`, error);
      }
    }
    
    // Remove the now-empty bookspace folder
    try {
      await browser.bookmarks.remove(bookspaceFolder.id);
      console.log('bookspace: Removed empty bookspace folder');
    } catch (error) {
      // Folder might not be empty, that's okay
      console.log('bookspace: bookspace folder not removed (may not be empty)');
    }
    
    currentWorkspace = null;
    console.log(`bookspace: Showing all ${count} bookmarks`);
    isProcessing = false;
    return { success: true, count };
    
  } catch (error) {
    console.error('bookspace: Error showing all bookmarks:', error);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Get current state
 */
async function getCurrentState() {
  try {
    const bookspaceFolder = await findSubfolder(TOOLBAR_ID, BOOKSPACE_FOLDER_NAME);
    const isOrganized = !!bookspaceFolder;
    
    let workspaceFolders = [];
    if (bookspaceFolder) {
      const children = await getFolderChildren(bookspaceFolder.id);
      workspaceFolders = children
        .filter(c => c.type === 'folder')
        .map(c => c.title);
    }
    
    return {
      isOrganized,
      currentWorkspace,
      workspaceFolders
    };
  } catch (error) {
    console.error('bookspace: Error getting current state:', error);
    return {
      isOrganized: false,
      currentWorkspace: null,
      workspaceFolders: [],
      error: error.message
    };
  }
}

/**
 * Create or update the "change bookmarks" bookmark that links to popup.html
 */
async function createChangeBookmarksBookmark() {
  try {
    const popupUrl = browser.runtime.getURL('popup.html');
    const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
    
    // Look for existing "change bookmarks" bookmark
    const existingBookmark = toolbarChildren.find(
      child => child.type === 'bookmark' && 
               child.title === 'change bookmarks'
    );
    
    if (existingBookmark) {
      // Update the URL in case extension ID changed
      if (existingBookmark.url !== popupUrl) {
        await browser.bookmarks.update(existingBookmark.id, {
          url: popupUrl
        });
        console.log('bookspace: Updated "change bookmarks" bookmark URL');
      }
      return existingBookmark;
    }
    
    // Create new bookmark
    const bookmark = await browser.bookmarks.create({
      parentId: TOOLBAR_ID,
      title: 'change bookmarks',
      url: popupUrl
    });
    
    console.log('bookspace: Created "change bookmarks" bookmark');
    return bookmark;
    
  } catch (error) {
    console.error('bookspace: Error creating change bookmarks bookmark:', error);
  }
}

// Initialize on extension load
browser.runtime.onInstalled.addListener(async () => {
  console.log('bookspace: Extension installed, organizing bookmarks...');
  await organizeBookmarksIntoBookspace();
  await createChangeBookmarksBookmark();
});

browser.runtime.onStartup.addListener(async () => {
  console.log('bookspace: Browser started, checking bookmark organization...');
  // Check if already organized
  const state = await getCurrentState();
  if (!state.isOrganized) {
    await organizeBookmarksIntoBookspace();
  }
  // Ensure the change bookmarks bookmark exists
  await createChangeBookmarksBookmark();
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'organize') {
    organizeBookmarksIntoBookspace().then(sendResponse);
    return true;
  }
  
  if (message.action === 'switchWorkspace') {
    switchToWorkspace(message.workspaceName).then(sendResponse);
    return true;
  }
  
  if (message.action === 'showAll') {
    showAllBookmarks().then(sendResponse);
    return true;
  }
  
  if (message.action === 'getState') {
    getCurrentState().then(sendResponse);
    return true;
  }
});

console.log('bookspace: Extension loaded');
