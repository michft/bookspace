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
  
  // Create bookspace folder after "change bookmarks" (at index 1)
  console.log('bookspace: Creating bookspace folder');
  const newFolder = await browser.bookmarks.create({
    parentId: TOOLBAR_ID,
    title: BOOKSPACE_FOLDER_NAME,
    type: 'folder',
    index: 1 // After "change bookmarks" (index 0)
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
    
    // Ensure "change bookmarks" stays first
    await ensureChangeBookmarksFirst();
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
 * Special case: "none" workspace shows all bookmarks in original layout
 */
async function switchToWorkspace(workspaceName) {
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  if (!workspaceName) {
    return { success: false, message: 'No workspace name provided' };
  }
  
  // Special case: "none" or "bookspace-none" workspace shows only change bookmarks and bookspace folder
  if (workspaceName.toLowerCase() === 'none' || workspaceName.toLowerCase() === 'bookspace-none') {
    return await showNoneWorkspace();
  }
  
  // Special case: "bookspace-all" workspace shows all bookmarks from bookspace folder
  if (workspaceName.toLowerCase() === 'bookspace-all') {
    return await showAllBookmarks();
  }
  
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // First, if there's a current workspace, move its bookmarks back into their folder
    if (currentWorkspace && currentWorkspace !== workspaceName) {
      // If previous workspace was "none" or "bookspace-none", we need to move items back differently
      if (currentWorkspace.toLowerCase() === 'none' || currentWorkspace.toLowerCase() === 'bookspace-none') {
        // Move all toolbar items (except bookspace and change bookmarks) back into bookspace
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
      } else {
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
    // Start at index 1 (after "change bookmarks" which is at index 0)
    const workspaceChildren = await getFolderChildren(workspaceFolder.id);
    let displayedCount = 0;
    
    for (const item of workspaceChildren) {
      try {
        await browser.bookmarks.move(item.id, {
          parentId: TOOLBAR_ID,
          index: displayedCount + 1 // Place after "change bookmarks" (index 0)
        });
        displayedCount++;
        console.log(`bookspace: Displayed "${item.title}" in toolbar`);
      } catch (error) {
        console.error(`bookspace: Error displaying "${item.title}":`, error);
      }
    }
    
    currentWorkspace = workspaceName;
    // Ensure "change bookmarks" stays first
    await ensureChangeBookmarksFirst();
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
 * Show "none" workspace - only change bookmarks and bookspace folder visible
 */
async function showNoneWorkspace() {
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // First, if there's a current workspace, move its bookmarks back into their folder
    if (currentWorkspace && currentWorkspace.toLowerCase() !== 'none' && currentWorkspace.toLowerCase() !== 'bookspace-none') {
      if (currentWorkspace.toLowerCase() === 'none' || currentWorkspace.toLowerCase() === 'bookspace-none') {
        // Already in none mode, nothing to do
      } else {
        const previousWorkspaceFolder = await findSubfolder(bookspaceFolder.id, currentWorkspace);
        
        if (previousWorkspaceFolder) {
          const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
          const itemsToMoveBack = toolbarChildren.filter(
            item => item.id !== bookspaceFolder.id && 
                    !(item.type === 'bookmark' && item.title === 'change bookmarks')
          );
          
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
      }
    } else {
      // Move any loose items back into bookspace
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
    
    // Ensure bookspace folder is visible in toolbar (at index 1, after change bookmarks)
    const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
    const bookspaceInToolbar = toolbarChildren.find(item => item.id === bookspaceFolder.id);
    
    if (!bookspaceInToolbar) {
      // Move bookspace folder to toolbar at index 1
      await browser.bookmarks.move(bookspaceFolder.id, {
        parentId: TOOLBAR_ID,
        index: 1
      });
      console.log('bookspace: Moved bookspace folder to toolbar');
    } else {
      // Ensure it's at index 1
      const currentIndex = toolbarChildren.findIndex(item => item.id === bookspaceFolder.id);
      if (currentIndex !== 1) {
        await browser.bookmarks.move(bookspaceFolder.id, {
          index: 1
        });
      }
    }
    
    currentWorkspace = 'bookspace-none';
    // Ensure "change bookmarks" stays first
    await ensureChangeBookmarksFirst();
    console.log('bookspace: Switched to "bookspace-none" workspace - showing only change bookmarks and bookspace folder');
    isProcessing = false;
    return { success: true, count: 0, message: 'Showing change bookmarks and bookspace folder only' };
    
  } catch (error) {
    console.error('bookspace: Error showing none workspace:', error);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Show all bookmarks (move everything from bookspace to toolbar, maintaining relative positions)
 */
async function showAllBookmarks() {
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // First, if there's a current workspace, move its bookmarks back into their folder
    if (currentWorkspace) {
      const previousWorkspaceFolder = await findSubfolder(bookspaceFolder.id, currentWorkspace);
      
      if (previousWorkspaceFolder) {
        const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
        const itemsToMoveBack = toolbarChildren.filter(
          item => item.id !== bookspaceFolder.id && 
                  !(item.type === 'bookmark' && item.title === 'change bookmarks')
        );
        
        for (const item of itemsToMoveBack) {
          try {
            await browser.bookmarks.move(item.id, {
              parentId: previousWorkspaceFolder.id
            });
          } catch (error) {
            console.error(`bookspace: Error moving "${item.title}" back:`, error);
          }
        }
      }
    } else {
      // No current workspace, but move any loose items back into bookspace
      const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
      for (const item of toolbarChildren) {
        if (item.id === bookspaceFolder.id) continue;
        if (item.type === 'bookmark' && item.title === 'change bookmarks') continue;
        
        try {
          await browser.bookmarks.move(item.id, {
            parentId: bookspaceFolder.id
          });
        } catch (error) {
          console.error(`bookspace: Error moving "${item.title}" back:`, error);
        }
      }
    }
    
    // Now move all bookspace children to toolbar, maintaining their relative positions
    // Start at index 1 (after "change bookmarks" which is at index 0)
    const bookspaceChildren = await getFolderChildren(bookspaceFolder.id);
    let count = 0;
    
    for (const item of bookspaceChildren) {
      try {
        await browser.bookmarks.move(item.id, {
          parentId: TOOLBAR_ID,
          index: count + 1 // Place after "change bookmarks" (index 0)
        });
        count++;
        console.log(`bookspace: Displayed "${item.title}" in toolbar (${item.type})`);
      } catch (error) {
        console.error(`bookspace: Error moving "${item.title}":`, error);
      }
    }
    
    currentWorkspace = 'bookspace-all';
    // Ensure "change bookmarks" stays first
    await ensureChangeBookmarksFirst();
    console.log(`bookspace: Showing all ${count} items from bookspace (maintaining positions) - workspace: bookspace-all`);
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
    
    // If in bookspace-all mode, workspace folders are at toolbar root level
    if (currentWorkspace && currentWorkspace.toLowerCase() === 'bookspace-all') {
      const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
      // Get all folders from toolbar root (excluding bookspace folder and change bookmarks)
      workspaceFolders = toolbarChildren
        .filter(c => c.type === 'folder' && 
                     c.id !== bookspaceFolder?.id &&
                     !(c.type === 'bookmark' && c.title === 'change bookmarks'))
        .map(c => c.title);
    } else if (bookspaceFolder) {
      // Otherwise, workspace folders are inside the bookspace folder
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
 * Ensure "change bookmarks" bookmark is at index 0
 */
async function ensureChangeBookmarksFirst() {
  try {
    const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
    const changeBookmarks = toolbarChildren.find(
      child => child.type === 'bookmark' && child.title === 'change bookmarks'
    );
    
    if (changeBookmarks) {
      // Check if it's already at index 0
      const currentIndex = toolbarChildren.findIndex(c => c.id === changeBookmarks.id);
      if (currentIndex !== 0) {
        await browser.bookmarks.move(changeBookmarks.id, {
          index: 0
        });
        console.log('bookspace: Moved "change bookmarks" to position 0');
      }
    }
  } catch (error) {
    console.error('bookspace: Error ensuring change bookmarks is first:', error);
  }
}

/**
 * Create or update the "change bookmarks" bookmark that links to popup.html
 * Always places it at index 0 (first position)
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
      // Ensure it's at index 0
      await ensureChangeBookmarksFirst();
      return existingBookmark;
    }
    
    // Create new bookmark at index 0
    const bookmark = await browser.bookmarks.create({
      parentId: TOOLBAR_ID,
      title: 'change bookmarks',
      url: popupUrl,
      index: 0
    });
    
    console.log('bookspace: Created "change bookmarks" bookmark at position 0');
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
