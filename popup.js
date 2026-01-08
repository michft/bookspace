/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

document.addEventListener('DOMContentLoaded', async () => {
  const bookspaceNoneBtn = document.getElementById('bookspace-none-btn');
  const bookspaceAllBtn = document.getElementById('bookspace-all-btn');
  const messageDiv = document.getElementById('message');
  const currentWorkspaceDiv = document.getElementById('current-workspace');
  const workspaceListDiv = document.getElementById('workspace-list');
  const debugContentDiv = document.getElementById('debug-content');
  const currentContainerSpan = document.getElementById('current-container');
  const containerListDiv = document.getElementById('container-list');
  const folderListDiv = document.getElementById('folder-list');
  
  function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + (isError ? 'error' : 'success');
    setTimeout(() => {
      messageDiv.className = 'message';
    }, 3000);
  }
  
  async function refreshContainerInfo() {
    try {
      const info = await browser.runtime.sendMessage({ action: 'getContainerInfo' });
      
      // Update current container display
      if (info.currentContainer) {
        currentContainerSpan.textContent = info.currentContainer;
        currentContainerSpan.className = 'info-value';
      } else {
        currentContainerSpan.textContent = 'None (default)';
        currentContainerSpan.className = 'info-value none';
      }
      
      // Update container list
      containerListDiv.innerHTML = '';
      if (info.containers && info.containers.length > 0) {
        for (const container of info.containers) {
          const tag = document.createElement('span');
          tag.className = 'tag' + (container.name === info.currentContainer ? ' current' : '');
          tag.textContent = container.name;
          containerListDiv.appendChild(tag);
        }
      } else {
        containerListDiv.innerHTML = '<span class="info-value none">No containers</span>';
      }
      
      // Update folder list
      folderListDiv.innerHTML = '';
      if (info.workspaceFolders && info.workspaceFolders.length > 0) {
        for (const folder of info.workspaceFolders) {
          const item = document.createElement('div');
          item.className = 'folder-item';
          item.innerHTML = `
            <span class="folder-name">${folder.name}</span>
            <span class="folder-count"><span class="num">${folder.bookmarkCount}</span> bookmarks, <span class="num">${folder.folderCount}</span> folders</span>
          `;
          folderListDiv.appendChild(item);
        }
      } else {
        folderListDiv.innerHTML = '<span class="info-value none">No workspace folders</span>';
      }
      
    } catch (error) {
      console.error('Error getting container info:', error);
      currentContainerSpan.textContent = 'Error';
      currentContainerSpan.className = 'info-value none';
    }
  }
  
  function updateDebugDisplay(state) {
    if (!debugContentDiv) return;
    
    const formatValue = (value) => {
      if (value === null || value === undefined) {
        return '<span class="debug-value null">null</span>';
      }
      if (typeof value === 'boolean') {
        return `<span class="debug-value ${value}">${value}</span>`;
      }
      if (typeof value === 'object' && Array.isArray(value)) {
        return `<span class="debug-value">[${value.length}] ${JSON.stringify(value)}</span>`;
      }
      return `<span class="debug-value">${JSON.stringify(value)}</span>`;
    };
    
    const debugItems = [
      { key: 'isProcessing', value: state.isProcessing !== undefined ? state.isProcessing : 'N/A' },
      { key: 'currentWorkspace', value: state.currentWorkspace },
      { key: 'isOrganized', value: state.isOrganized !== undefined ? state.isOrganized : 'N/A' },
      { key: 'workspaceFolders', value: state.workspaceFolders || [] },
      { key: 'error', value: state.error || null }
    ];
    
    debugContentDiv.innerHTML = debugItems.map(item => 
      `<div class="debug-item">
        <span class="debug-key">${item.key}:</span>
        ${formatValue(item.value)}
      </div>`
    ).join('');
  }
  
  async function refreshState() {
    try {
      const state = await browser.runtime.sendMessage({ action: 'getState' });
      
      // Update debug display
      updateDebugDisplay(state);
      
      // Update current workspace display
      const currentWorkspace = state.currentWorkspace || 'bookspace-none';
      
      // Handle bookspace-error state
      const errorBox = document.getElementById('error-box');
      const errorMessage = document.getElementById('error-message');
      
      if (currentWorkspace === 'bookspace-error') {
        // Show error box
        errorBox.classList.add('show');
        errorMessage.textContent = 'Cannot determine current workspace state. This may be due to: (1) No containers available, (2) Container name does not match any bookspace folder, or (3) Bookspace folder not found. Ensure containers are created and attached to workspace tabs, and that container names match bookspace folder names. Check browser console for details.';
        
        // Disable transition buttons
        bookspaceNoneBtn.disabled = true;
        bookspaceAllBtn.disabled = true;
        
        // Update workspace display
        currentWorkspaceDiv.textContent = 'bookspace-error';
        currentWorkspaceDiv.className = 'status-value';
        currentWorkspaceDiv.style.color = '#f38ba8';
        
        return;
      } else {
        // Hide error box and enable buttons
        errorBox.classList.remove('show');
        bookspaceNoneBtn.disabled = false;
        bookspaceAllBtn.disabled = false;
        currentWorkspaceDiv.style.color = '';
      }
      
      // Normalize 'none' to 'bookspace-none' for display
      const displayWorkspace = (currentWorkspace === 'bookspace-none') ? 'bookspace-none' : currentWorkspace;
      currentWorkspaceDiv.textContent = displayWorkspace;
      currentWorkspaceDiv.className = 'status-value';
      
      // Update button states
      if (currentWorkspace === 'bookspace-none') {
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
      updateDebugDisplay({ error: error.message });
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
    
    // Prevent transitions if in error state
    if (state.currentWorkspace === 'bookspace-error') {
      showMessage('Cannot switch workspace - error state detected. Check browser console.', true);
      return;
    }
    
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
        await refreshContainerInfo();
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
  
  // Initial state load - detect current workspace from toolbar/bookspace structure
  await refreshState();
  await refreshContainerInfo();
});
