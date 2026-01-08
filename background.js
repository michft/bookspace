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
 * Count items in a folder recursively (including subfolders)
 * Returns { bookmarks: count, folders: count, total: count }
 */
async function countItemsInFolder(folderId, includeSubfolders = true) {
  try {
    const children = await getFolderChildren(folderId);
    let bookmarks = 0;
    let folders = 0;
    
    for (const item of children) {
      if (item.type === 'bookmark') {
        bookmarks++;
      } else if (item.type === 'folder') {
        folders++;
        if (includeSubfolders) {
          const subCount = await countItemsInFolder(item.id, true);
          bookmarks += subCount.bookmarks;
          folders += subCount.folders;
        }
      }
    }
    
    return { bookmarks, folders, total: bookmarks + folders };
  } catch (error) {
    console.error('bookspace: Error counting items in folder:', error);
    return { bookmarks: 0, folders: 0, total: 0 };
  }
}

/**
 * Transition logging helpers
 */
function logTransitionStart(functionName, workspaceName) {
  console.debug(`bookspace: [TRANSITION START] ${functionName} -> ${workspaceName}`);
}

function logTransitionPath(pathName) {
  console.debug(`bookspace: [TRANSITION PATH] ${pathName}`);
}

function logTransitionMove(count, source, destination) {
  console.debug(`bookspace: [TRANSITION MOVE] ${count} items: ${source} -> ${destination}`);
}

function logTransitionUpdate(previousWorkspace, currentWorkspace) {
  console.debug(`bookspace: [TRANSITION UPDATE] ${previousWorkspace || 'null'} -> ${currentWorkspace}`);
}

function logTransitionEnd(success, count) {
  console.debug(`bookspace: [TRANSITION END] success=${success} count=${count}`);
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
  const previousWorkspace = currentWorkspace;
  
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  if (!workspaceName) {
    return { success: false, message: 'No workspace name provided' };
  }
  
  logTransitionStart('switchToWorkspace', workspaceName);
  console.info(`bookspace: [SUMMARY] Transition start: switchToWorkspace from "${previousWorkspace || 'null'}" to "${workspaceName}"`);
  
  // Special case: "none" workspace shows only change bookmarks and bookspace folder
  // Normalize "bookspace-none" to "none"
  if (workspaceName.toLowerCase() === 'none' || workspaceName.toLowerCase() === 'bookspace-none') {
    logTransitionPath('bookspace-none');
    const result = await showNoBookmarks();
    return result;
  }
  
  // Special case: "bookspace-all" workspace shows all bookmarks from bookspace folder
  if (workspaceName.toLowerCase() === 'bookspace-all') {
    logTransitionPath('bookspace-all');
    const result = await showAllBookmarks();
    return result;
  }
  
  logTransitionPath('regular workspace');
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // Count items before moving
    const toolbarCountBefore = await countItemsInFolder(TOOLBAR_ID, false);
    
    // First, if there's a current workspace, move its bookmarks back into their folder
    if (currentWorkspace && currentWorkspace !== workspaceName) {
      // If previous workspace was "bookspace-none", we need to move items back differently
      if (currentWorkspace.toLowerCase() === 'bookspace-none') {
        // Move all toolbar items (except bookspace and change bookmarks) back into bookspace
        const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
        const itemsToMove = toolbarChildren.filter(
          item => item.id !== bookspaceFolder.id && 
                  !(item.type === 'bookmark' && item.title === 'change bookmarks')
        );
        
        for (const item of itemsToMove) {
          try {
            await browser.bookmarks.move(item.id, {
              parentId: bookspaceFolder.id
            });
          } catch (error) {
            console.error(`bookspace: Error moving "${item.title}" back:`, error);
          }
        }
        
        const bookspaceCountAfter = await countItemsInFolder(bookspaceFolder.id, true);
        logTransitionMove(itemsToMove.length, 'toolbar', 'bookspace');
        console.info(`bookspace: [SUMMARY] Moved back ${itemsToMove.length} items to bookspace`);
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
          // Note: Nested subfolders are automatically preserved when moving folders
          for (const item of itemsToMoveBack) {
            try {
              await browser.bookmarks.move(item.id, {
                parentId: previousWorkspaceFolder.id
              });
            } catch (error) {
              console.error(`bookspace: Error moving "${item.title}" back:`, error);
            }
          }
          
          const workspaceCountAfter = await countItemsInFolder(previousWorkspaceFolder.id, true);
          logTransitionMove(itemsToMoveBack.length, 'toolbar', `workspace:${currentWorkspace}`);
          console.info(`bookspace: [SUMMARY] Moved back ${itemsToMoveBack.length} items to workspace "${currentWorkspace}"`);
        }
      }
    } else {
      // No previous workspace, just move any loose items back into bookspace root
      const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
      const itemsToMove = toolbarChildren.filter(
        item => item.id !== bookspaceFolder.id && 
                !(item.type === 'bookmark' && item.title === 'change bookmarks')
      );
      
      for (const item of itemsToMove) {
        try {
          await browser.bookmarks.move(item.id, {
            parentId: bookspaceFolder.id
          });
        } catch (error) {
          console.error(`bookspace: Error moving "${item.title}" back:`, error);
        }
      }
      
      if (itemsToMove.length > 0) {
        const bookspaceCountAfter = await countItemsInFolder(bookspaceFolder.id, true);
        logTransitionMove(itemsToMove.length, 'toolbar', 'bookspace');
        console.info(`bookspace: [SUMMARY] Moved back ${itemsToMove.length} items to bookspace`);
      }
    }
    
    // Find the new workspace folder inside bookspace
    const workspaceFolder = await findSubfolder(bookspaceFolder.id, workspaceName);
    
    if (!workspaceFolder) {
      currentWorkspace = workspaceName;
      logTransitionUpdate(previousWorkspace, workspaceName);
      logTransitionEnd(true, 0);
      console.info(`bookspace: [SUMMARY] Transition complete: 0 items moved, success=true, workspace="${workspaceName}"`);
      isProcessing = false;
      return { 
        success: true, 
        message: `No folder "${workspaceName}" found - toolbar is empty`,
        count: 0 
      };
    }
    
    // Count items in workspace folder before moving
    const workspaceCountBefore = await countItemsInFolder(workspaceFolder.id, true);
    
    // Move all items from new workspace folder to toolbar root
    // Note: When moving folders, all nested subfolders and their contents are automatically
    // preserved - the browser bookmarks API maintains the entire folder structure
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
      } catch (error) {
        console.error(`bookspace: Error displaying "${item.title}":`, error);
      }
    }
    
    const toolbarCountAfter = await countItemsInFolder(TOOLBAR_ID, false);
    logTransitionMove(displayedCount, `workspace:${workspaceName}`, 'toolbar');
    console.info(`bookspace: [SUMMARY] Displayed ${displayedCount} items from workspace "${workspaceName}"`);
    
    currentWorkspace = workspaceName;
    // Ensure "change bookmarks" stays first
    await ensureChangeBookmarksFirst();
    logTransitionUpdate(previousWorkspace, workspaceName);
    logTransitionEnd(true, displayedCount);
    console.info(`bookspace: [SUMMARY] Transition complete: ${displayedCount} items displayed, success=true, workspace="${workspaceName}"`);
    isProcessing = false;
    return { success: true, count: displayedCount };
    
  } catch (error) {
    console.error('bookspace: Error switching workspace:', error);
    logTransitionEnd(false, 0);
    console.info(`bookspace: [SUMMARY] Transition failed: success=false, error="${error.message}"`);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Show no bookmarks - all bookmarks are in the bookspace folder, only change bookmarks and bookspace folder visible
 */
async function showNoBookmarks() {
  const previousWorkspace = currentWorkspace;
  const workspaceName = 'bookspace-none';
  
  // Do nothing if still updating (lock)
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  // Do nothing if already in bookspace-none
  if (currentWorkspace && currentWorkspace.toLowerCase() === 'bookspace-none') {
    console.log('bookspace: Already in bookspace-none, no action needed');
    return { success: true, message: 'Already in bookspace-none' };
  }
  
  logTransitionStart('showNoBookmarks', workspaceName);
  console.info(`bookspace: [SUMMARY] Transition start: showNoBookmarks from "${previousWorkspace || 'null'}" to "${workspaceName}"`);
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // Count items before moving
    const toolbarCountBefore = await countItemsInFolder(TOOLBAR_ID, false);
    
    // First, if there's a current workspace, move its bookmarks back into their folder
    if (currentWorkspace && currentWorkspace.toLowerCase() !== 'bookspace-none') {
      // If previous workspace was "bookspace-all", items are at toolbar root - move them to bookspace folder
      if (currentWorkspace.toLowerCase() === 'bookspace-all') {
        logTransitionPath('from bookspace-all');
        
        // Get all items currently in toolbar (except bookspace folder and change bookmarks)
        const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
        const itemsToMove = toolbarChildren.filter(
          item => item.id !== bookspaceFolder.id && 
                  !(item.type === 'bookmark' && item.title === 'change bookmarks')
        );
        
        // Move all items from toolbar root to bookspace folder
        // Note: Nested subfolders are automatically preserved when moving folders
        for (const item of itemsToMove) {
          try {
            await browser.bookmarks.move(item.id, {
              parentId: bookspaceFolder.id
            });
          } catch (error) {
            console.error(`bookspace: Error moving "${item.title}":`, error);
          }
        }
        
        const bookspaceCountAfter = await countItemsInFolder(bookspaceFolder.id, true);
        logTransitionMove(itemsToMove.length, 'toolbar', 'bookspace');
        console.info(`bookspace: [SUMMARY] Moved ${itemsToMove.length} items from toolbar to bookspace`);
      } else {
        logTransitionPath('from regular workspace');
        
        // Move items back to their workspace folder
        const previousWorkspaceFolder = await findSubfolder(bookspaceFolder.id, currentWorkspace);
        
        if (previousWorkspaceFolder) {
          // Get all items currently in toolbar (except bookspace folder and change bookmarks)
          const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
          const itemsToMoveBack = toolbarChildren.filter(
            item => item.id !== bookspaceFolder.id && 
                    !(item.type === 'bookmark' && item.title === 'change bookmarks')
          );
          
          // Move them back into the previous workspace folder
          // Note: Nested subfolders are automatically preserved when moving folders
          for (const item of itemsToMoveBack) {
            try {
              await browser.bookmarks.move(item.id, {
                parentId: previousWorkspaceFolder.id
              });
            } catch (error) {
              console.error(`bookspace: Error moving "${item.title}" back:`, error);
            }
          }
          
          const workspaceCountAfter = await countItemsInFolder(previousWorkspaceFolder.id, true);
          logTransitionMove(itemsToMoveBack.length, 'toolbar', `workspace:${currentWorkspace}`);
          console.info(`bookspace: [SUMMARY] Moved ${itemsToMoveBack.length} items to workspace "${currentWorkspace}"`);
        }
      }
    }
    
    // Ensure bookspace folder is visible in toolbar (at index 1, after change bookmarks)
    const toolbarChildrenAfter = await getFolderChildren(TOOLBAR_ID);
    const bookspaceInToolbar = toolbarChildrenAfter.find(item => item.id === bookspaceFolder.id);
    
    if (!bookspaceInToolbar) {
      // Move bookspace folder to toolbar at index 1
      await browser.bookmarks.move(bookspaceFolder.id, {
        parentId: TOOLBAR_ID,
        index: 1
      });
      console.log('bookspace: Moved bookspace folder to toolbar');
    } else {
      // Ensure it's at index 1
      const currentIndex = toolbarChildrenAfter.findIndex(item => item.id === bookspaceFolder.id);
      if (currentIndex !== 1) {
        await browser.bookmarks.move(bookspaceFolder.id, {
          index: 1
        });
      }
    }
    
    // Update the workspace state to bookspace-none
    currentWorkspace = 'bookspace-none';
    // Ensure "change bookmarks" stays first
    await ensureChangeBookmarksFirst();
    
    const toolbarCountAfter = await countItemsInFolder(TOOLBAR_ID, false);
    logTransitionUpdate(previousWorkspace, workspaceName);
    logTransitionEnd(true, 0);
    console.info(`bookspace: [SUMMARY] Transition complete: 0 items displayed, success=true, workspace="${workspaceName}"`);
    isProcessing = false;
    return { success: true, count: 0, message: 'Showing change bookmarks and bookspace folder only' };
    
  } catch (error) {
    console.error('bookspace: Error showing none workspace:', error);
    logTransitionEnd(false, 0);
    console.info(`bookspace: [SUMMARY] Transition failed: success=false, error="${error.message}"`);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Show all bookmarks (move everything from bookspace to toolbar, maintaining relative positions)
 */
async function showAllBookmarks() {
  const previousWorkspace = currentWorkspace;
  const workspaceName = 'bookspace-all';
  
  if (isProcessing) {
    console.log('bookspace: Already processing, skipping...');
    return { success: false, message: 'Already processing' };
  }
  
  logTransitionStart('showAllBookmarks', workspaceName);
  console.info(`bookspace: [SUMMARY] Transition start: showAllBookmarks from "${previousWorkspace || 'null'}" to "${workspaceName}"`);
  isProcessing = true;
  
  try {
    const bookspaceFolder = await getOrCreateBookspaceFolder();
    
    // Count items before moving
    const toolbarCountBefore = await countItemsInFolder(TOOLBAR_ID, false);
    const bookspaceCountBefore = await countItemsInFolder(bookspaceFolder.id, true);
    
    // First, if there's a current workspace, move its bookmarks back into their folder
    if (currentWorkspace) {
      if (currentWorkspace.toLowerCase() === 'bookspace-none') {
        logTransitionPath('from bookspace-none');
      } else {
        logTransitionPath('from regular workspace');
      }
      
      const previousWorkspaceFolder = await findSubfolder(bookspaceFolder.id, currentWorkspace);
      
      if (previousWorkspaceFolder) {
        const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
        const itemsToMoveBack = toolbarChildren.filter(
          item => item.id !== bookspaceFolder.id && 
                  !(item.type === 'bookmark' && item.title === 'change bookmarks')
        );
        
        // Note: Nested subfolders are automatically preserved when moving folders
        for (const item of itemsToMoveBack) {
          try {
            await browser.bookmarks.move(item.id, {
              parentId: previousWorkspaceFolder.id
            });
          } catch (error) {
            console.error(`bookspace: Error moving "${item.title}" back:`, error);
          }
        }
        
        const workspaceCountAfter = await countItemsInFolder(previousWorkspaceFolder.id, true);
        logTransitionMove(itemsToMoveBack.length, 'toolbar', `workspace:${currentWorkspace}`);
        console.info(`bookspace: [SUMMARY] Moved back ${itemsToMoveBack.length} items to workspace "${currentWorkspace}"`);
      }
    } else {
      logTransitionPath('from no workspace');
      
      // No current workspace, but move any loose items back into bookspace
      const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
      const itemsToMove = toolbarChildren.filter(
        item => item.id !== bookspaceFolder.id && 
                !(item.type === 'bookmark' && item.title === 'change bookmarks')
      );
      
      for (const item of itemsToMove) {
        try {
          await browser.bookmarks.move(item.id, {
            parentId: bookspaceFolder.id
          });
        } catch (error) {
          console.error(`bookspace: Error moving "${item.title}" back:`, error);
        }
      }
      
      if (itemsToMove.length > 0) {
        const bookspaceCountAfter = await countItemsInFolder(bookspaceFolder.id, true);
        logTransitionMove(itemsToMove.length, 'toolbar', 'bookspace');
        console.info(`bookspace: [SUMMARY] Moved back ${itemsToMove.length} items to bookspace`);
      }
    }
    
    // Now move all bookspace children to toolbar, maintaining their relative positions
    // Note: When moving folders, all nested subfolders and their contents are automatically
    // preserved - the browser bookmarks API maintains the entire folder structure
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
      } catch (error) {
        console.error(`bookspace: Error moving "${item.title}":`, error);
      }
    }
    
    const toolbarCountAfter = await countItemsInFolder(TOOLBAR_ID, false);
    logTransitionMove(count, 'bookspace', 'toolbar');
    console.info(`bookspace: [SUMMARY] Displayed ${count} items from bookspace to toolbar`);
    
    currentWorkspace = 'bookspace-all';
    // Ensure "change bookmarks" stays first
    await ensureChangeBookmarksFirst();
    logTransitionUpdate(previousWorkspace, workspaceName);
    logTransitionEnd(true, count);
    console.info(`bookspace: [SUMMARY] Transition complete: ${count} items displayed, success=true, workspace="${workspaceName}"`);
    isProcessing = false;
    return { success: true, count };
    
  } catch (error) {
    console.error('bookspace: Error showing all bookmarks:', error);
    logTransitionEnd(false, 0);
    console.info(`bookspace: [SUMMARY] Transition failed: success=false, error="${error.message}"`);
    isProcessing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Get toolbar items (excluding change bookmarks and bookspace folder)
 */
async function getToolbarItems(bookspaceFolder) {
  const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
  return toolbarChildren.filter(
    item => item.id !== bookspaceFolder?.id && 
            !(item.type === 'bookmark' && item.title === 'change bookmarks')
  );
}

/**
 * Get items in bookspace folder
 */
async function getBookspaceItems(bookspaceFolder) {
  if (!bookspaceFolder) {
    return [];
  }
  return await getFolderChildren(bookspaceFolder.id);
}

/**
 * Get empty folders in bookspace (folders with no children)
 */
async function getEmptyFoldersInBookspace(bookspaceFolder) {
  if (!bookspaceFolder) {
    return [];
  }
  
  const bookspaceItems = await getBookspaceItems(bookspaceFolder);
  const folders = bookspaceItems.filter(item => item.type === 'folder');
  const emptyFolders = [];
  
  for (const folder of folders) {
    const children = await getFolderChildren(folder.id);
    if (children.length === 0) {
      emptyFolders.push(folder);
    }
  }
  
  return emptyFolders;
}

/**
 * Detect current workspace by examining toolbar and bookspace folder structure
 */
async function detectCurrentWorkspace() {
  try {
    const bookspaceFolder = await findSubfolder(TOOLBAR_ID, BOOKSPACE_FOLDER_NAME);
    
    if (!bookspaceFolder) {
      console.error('bookspace: Cannot detect workspace - bookspace folder not found');
      return 'bookspace-error';
    }
    
    const toolbarItems = await getToolbarItems(bookspaceFolder);
    const bookspaceItems = await getBookspaceItems(bookspaceFolder);
    
    // Case 1: bookspace-none - Only change bookmarks and bookspace folder in toolbar
    if (toolbarItems.length === 0) {
      console.info('bookspace: [DETECTION] Detected workspace: bookspace-none (toolbar empty except change bookmarks and bookspace)');
      return 'bookspace-none';
    }
    
    // Case 2: bookspace-all - Bookspace folder is empty AND toolbar has items
    if (bookspaceItems.length === 0 && toolbarItems.length > 0) {
      console.info('bookspace: [DETECTION] Detected workspace: bookspace-all (bookspace empty, toolbar has items)');
      return 'bookspace-all';
    }
    
    // Case 3: Regular workspace - Some items in toolbar AND some items in bookspace AND exactly ONE empty folder
    if (toolbarItems.length > 0 && bookspaceItems.length > 0) {
      const emptyFolders = await getEmptyFoldersInBookspace(bookspaceFolder);
      
      if (emptyFolders.length === 1) {
        const workspaceName = emptyFolders[0].title;
        console.info(`bookspace: [DETECTION] Detected workspace: "${workspaceName}" (single empty folder in bookspace)`);
        return workspaceName;
      }
    }
    
    // Case 4: Indeterminate state - log error with details
    const emptyFolders = await getEmptyFoldersInBookspace(bookspaceFolder);
    console.error('bookspace: [DETECTION] Cannot determine workspace - indeterminate state', {
      toolbarItemCount: toolbarItems.length,
      bookspaceItemCount: bookspaceItems.length,
      emptyFolderCount: emptyFolders.length,
      emptyFolderNames: emptyFolders.map(f => f.title)
    });
    
    return 'bookspace-error';
  } catch (error) {
    console.error('bookspace: Error detecting workspace:', error);
    return 'bookspace-error';
  }
}

/**
 * Get current state
 */
async function getCurrentState() {
  try {
    const bookspaceFolder = await findSubfolder(TOOLBAR_ID, BOOKSPACE_FOLDER_NAME);
    const isOrganized = !!bookspaceFolder;
    
    // If currentWorkspace is null, try to detect it
    let detectedWorkspace = currentWorkspace;
    if (!detectedWorkspace) {
      detectedWorkspace = await detectCurrentWorkspace();
      if (detectedWorkspace) {
        currentWorkspace = detectedWorkspace;
      }
    }
    
    let workspaceFolders = [];
    
    // If in bookspace-all mode, workspace folders are at toolbar root level
    if (detectedWorkspace && detectedWorkspace.toLowerCase() === 'bookspace-all') {
      const toolbarChildren = await getFolderChildren(TOOLBAR_ID);
      // Get all folders from toolbar root (excluding bookspace folder and change bookmarks)
      workspaceFolders = toolbarChildren
        .filter(c => c.type === 'folder' && 
                     c.id !== bookspaceFolder?.id &&
                     !(c.type === 'bookmark' && c.title === 'change bookmarks'))
        .map(c => c.title);
    } else if (bookspaceFolder) {
      // Otherwise, workspace folders are top-level folders inside the bookspace folder
      // Only direct children of bookspace are workspaces, not nested subfolders
      const children = await getFolderChildren(bookspaceFolder.id);
      workspaceFolders = children
        .filter(c => c.type === 'folder')
        .map(c => c.title);
    }
    
    return {
      isOrganized,
      currentWorkspace: detectedWorkspace,
      workspaceFolders,
      isProcessing
    };
  } catch (error) {
    console.error('bookspace: Error getting current state:', error);
    return {
      isOrganized: false,
      currentWorkspace: null,
      workspaceFolders: [],
      isProcessing: false,
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
