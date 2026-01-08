/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

document.addEventListener('DOMContentLoaded', async () => {
  const workspaceInput = document.getElementById('workspace-name');
  const switchBtn = document.getElementById('switch-btn');
  const showAllBtn = document.getElementById('show-all-btn');
  const organizeBtn = document.getElementById('organize-btn');
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
      if (state.currentWorkspace) {
        currentWorkspaceDiv.textContent = state.currentWorkspace;
        currentWorkspaceDiv.className = 'status-value';
      } else {
        if (state.isOrganized) {
          currentWorkspaceDiv.textContent = 'none';
          currentWorkspaceDiv.className = 'status-value';
        } else {
          currentWorkspaceDiv.textContent = 'Not organized';
          currentWorkspaceDiv.className = 'status-value inactive';
        }
      }
      
      // Update workspace list
      workspaceListDiv.innerHTML = '';
      if (state.workspaceFolders && state.workspaceFolders.length > 0) {
        for (const folder of state.workspaceFolders) {
          const item = document.createElement('span');
          item.className = 'workspace-item' + (folder === state.currentWorkspace ? ' active' : '');
          item.textContent = folder;
          item.addEventListener('click', () => {
            workspaceInput.value = folder;
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
      showMessage('Please enter a workspace name', true);
      return;
    }
    
    switchBtn.disabled = true;
    switchBtn.textContent = 'Switching...';
    
    try {
      const response = await browser.runtime.sendMessage({
        action: 'switchWorkspace',
        workspaceName: workspaceName
      });
      
      if (response.success) {
        if (response.count > 0) {
          showMessage(`Switched to "${workspaceName}" - ${response.count} items`);
        } else {
          showMessage(response.message || `No bookmarks in "${workspaceName}"`);
        }
        await refreshState();
      } else {
        showMessage(response.error || response.message || 'Failed to switch', true);
      }
    } catch (error) {
      console.error('Error switching workspace:', error);
      showMessage('Error: ' + error.message, true);
    } finally {
      switchBtn.disabled = false;
      switchBtn.textContent = 'Switch';
    }
  }
  
  switchBtn.addEventListener('click', () => {
    switchWorkspace(workspaceInput.value.trim());
  });
  
  workspaceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      switchWorkspace(workspaceInput.value.trim());
    }
  });
  
  showAllBtn.addEventListener('click', async () => {
    showAllBtn.disabled = true;
    showAllBtn.textContent = 'Loading...';
    
    try {
      const response = await browser.runtime.sendMessage({ action: 'showAll' });
      
      if (response.success) {
        showMessage(`Showing all ${response.count} items (original layout)`);
        await refreshState();
      } else {
        showMessage(response.error || 'Failed to show all', true);
      }
    } catch (error) {
      console.error('Error showing all:', error);
      showMessage('Error: ' + error.message, true);
    } finally {
      showAllBtn.disabled = false;
      showAllBtn.textContent = 'Show All';
    }
  });
  
  organizeBtn.addEventListener('click', async () => {
    organizeBtn.disabled = true;
    organizeBtn.textContent = 'Organizing...';
    
    try {
      const response = await browser.runtime.sendMessage({ action: 'organize' });
      
      if (response.success) {
        showMessage(`Organized ${response.movedCount} items into bookspace`);
        await refreshState();
      } else {
        showMessage(response.error || response.message || 'Failed to organize', true);
      }
    } catch (error) {
      console.error('Error organizing:', error);
      showMessage('Error: ' + error.message, true);
    } finally {
      organizeBtn.disabled = false;
      organizeBtn.textContent = 'Collapse Bookmarks';
    }
  });
  
  // Initial state load
  await refreshState();
});
