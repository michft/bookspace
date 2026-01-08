/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

document.addEventListener('DOMContentLoaded', async () => {
  const bookspaceNoneBtn = document.getElementById('bookspace-none-btn');
  const bookspaceAllBtn = document.getElementById('bookspace-all-btn');
  const messageDiv = document.getElementById('message');
  const currentWorkspaceDiv = document.getElementById('current-workspace');
  const workspaceListDiv = document.getElementById('workspace-list');
  
  function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + (isError ? 'error' : 'success');
    setTimeout(() => {
      messageDiv.className = 'message';
    }, 3000);
  }
  
  async function refreshState() {
    try {
      const state = await browser.runtime.sendMessage({ action: 'getState' });
      
      // Update current workspace display
      const currentWorkspace = state.currentWorkspace || 'none';
      // Display 'bookspace-none' in UI but internally it's 'none'
      const displayWorkspace = currentWorkspace === 'none' ? 'bookspace-none' : currentWorkspace;
      currentWorkspaceDiv.textContent = displayWorkspace;
      currentWorkspaceDiv.className = 'status-value';
      
      // Update button states
      if (currentWorkspace === 'none') {
        bookspaceNoneBtn.classList.add('active');
        bookspaceAllBtn.classList.remove('active');
      } else if (currentWorkspace === 'bookspace-all') {
        bookspaceNoneBtn.classList.remove('active');
        bookspaceAllBtn.classList.add('active');
      } else {
        bookspaceNoneBtn.classList.remove('active');
        bookspaceAllBtn.classList.remove('active');
      }
      
      // Update workspace list
      workspaceListDiv.innerHTML = '';
      if (state.workspaceFolders && state.workspaceFolders.length > 0) {
        for (const folder of state.workspaceFolders) {
          const item = document.createElement('span');
          item.className = 'workspace-item' + (folder === currentWorkspace ? ' active' : '');
          item.textContent = folder;
          item.addEventListener('click', () => {
            switchWorkspace(folder);
          });
          workspaceListDiv.appendChild(item);
        }
      }
      
    } catch (error) {
      console.error('Error getting state:', error);
    }
  }
  
  async function switchWorkspace(workspaceName) {
    if (!workspaceName) {
      return;
    }
    
    // Check if already in this workspace - no action needed
    // Normalize "bookspace-none" to "none" for comparison
    const normalizedWorkspaceName = (workspaceName.toLowerCase() === 'bookspace-none') ? 'none' : workspaceName.toLowerCase();
    const state = await browser.runtime.sendMessage({ action: 'getState' });
    if (state.currentWorkspace && state.currentWorkspace.toLowerCase() === normalizedWorkspaceName) {
      return; // Already in this workspace, no action needed
    }
    
    // Disable both buttons while switching
    bookspaceNoneBtn.disabled = true;
    bookspaceAllBtn.disabled = true;
    
    try {
      const response = await browser.runtime.sendMessage({
        action: 'switchWorkspace',
        workspaceName: workspaceName
      });
      
      if (response.success) {
        if (response.count > 0) {
          showMessage(`Switched to "${workspaceName}" - ${response.count} items`);
        } else {
          showMessage(response.message || `Switched to "${workspaceName}"`);
        }
        await refreshState();
      } else {
        showMessage(response.error || response.message || 'Failed to switch', true);
      }
    } catch (error) {
      console.error('Error switching workspace:', error);
      showMessage('Error: ' + error.message, true);
    } finally {
      bookspaceNoneBtn.disabled = false;
      bookspaceAllBtn.disabled = false;
    }
  }
  
  // bookspace-none button (collapse functionality)
  bookspaceNoneBtn.addEventListener('click', async () => {
    await switchWorkspace('bookspace-none');
  });
  
  // bookspace-all button (show all functionality)
  bookspaceAllBtn.addEventListener('click', async () => {
    await switchWorkspace('bookspace-all');
  });
  
  // Initial state load - ensure we're in bookspace-none if no workspace is set
  const initialState = await browser.runtime.sendMessage({ action: 'getState' });
  if (!initialState.currentWorkspace) {
    // Switch to bookspace-none on initial load
    await switchWorkspace('bookspace-none');
  } else {
    await refreshState();
  }
});
