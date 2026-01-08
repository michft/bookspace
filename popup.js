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
  const apiDebugContentDiv = document.getElementById('api-debug-content');
  
  function showMessage(text, isError = false) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + (isError ? 'error' : 'success');
    setTimeout(() => {
      messageDiv.className = 'message';
    }, 3000);
  }
  
  async function checkApiAvailability() {
    if (!apiDebugContentDiv) return;
    
    const checks = [];
    
    // Check browser object
    checks.push({
      name: 'browser',
      available: typeof browser !== 'undefined',
      value: typeof browser
    });
    
    // Check browser.tabs
    checks.push({
      name: 'browser.tabs',
      available: typeof browser !== 'undefined' && typeof browser.tabs !== 'undefined',
      value: typeof browser?.tabs
    });
    
    // Check browser.tabs.query
    checks.push({
      name: 'browser.tabs.query',
      available: typeof browser !== 'undefined' && typeof browser.tabs?.query === 'function',
      value: typeof browser?.tabs?.query
    });
    
    // Check browser.contextualIdentities
    checks.push({
      name: 'browser.contextualIdentities',
      available: typeof browser !== 'undefined' && typeof browser.contextualIdentities !== 'undefined',
      value: typeof browser?.contextualIdentities
    });
    
    // Check browser.contextualIdentities.get
    checks.push({
      name: 'browser.contextualIdentities.get',
      available: typeof browser !== 'undefined' && typeof browser.contextualIdentities?.get === 'function',
      value: typeof browser?.contextualIdentities?.get
    });
    
    // Check browser.contextualIdentities.query
    checks.push({
      name: 'browser.contextualIdentities.query',
      available: typeof browser !== 'undefined' && typeof browser.contextualIdentities?.query === 'function',
      value: typeof browser?.contextualIdentities?.query
    });
    
    // Try to get active tab info
    let tabInfo = { error: null, cookieStoreId: null };
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        tabInfo.cookieStoreId = tabs[0].cookieStoreId || 'undefined';
        tabInfo.tabId = tabs[0].id;
      } else {
        tabInfo.error = 'No active tab found';
      }
    } catch (e) {
      tabInfo.error = e.message;
    }
    
    // Try to query contextualIdentities
    let contextualIdentitiesInfo = { error: null, count: 0 };
    try {
      const containers = await browser.contextualIdentities.query({});
      contextualIdentitiesInfo.count = containers.length;
      contextualIdentitiesInfo.names = containers.map(c => c.name);
    } catch (e) {
      contextualIdentitiesInfo.error = e.message;
    }
    
    // Try to get container for current tab
    let containerGetInfo = { error: null, name: null };
    if (tabInfo.cookieStoreId && tabInfo.cookieStoreId !== 'undefined') {
      try {
        const container = await browser.contextualIdentities.get(tabInfo.cookieStoreId);
        containerGetInfo.name = container?.name || 'unknown';
        containerGetInfo.color = container?.color;
      } catch (e) {
        containerGetInfo.error = e.message;
      }
    } else {
      containerGetInfo.error = 'No cookieStoreId (default container)';
    }
    
    // Render debug output
    const formatCheck = (check) => {
      const status = check.available 
        ? '<span class="debug-value true">✓</span>' 
        : '<span class="debug-value false">✗</span>';
      return `<div class="debug-item">${status} <span class="debug-key">${check.name}:</span> <span class="debug-value">${check.value}</span></div>`;
    };
    
    const formatResult = (label, result) => {
      if (result.error) {
        return `<div class="debug-item"><span class="debug-key">${label}:</span> <span class="debug-value false">${result.error}</span></div>`;
      }
      return `<div class="debug-item"><span class="debug-key">${label}:</span> <span class="debug-value true">${JSON.stringify(result)}</span></div>`;
    };
    
    apiDebugContentDiv.innerHTML = `
      <div style="margin-bottom: 8px; color: #f5c2e7;">API Checks:</div>
      ${checks.map(formatCheck).join('')}
      <div style="margin: 8px 0; color: #f5c2e7;">Live Tests:</div>
      ${formatResult('tabs.query result', tabInfo)}
      ${formatResult('contextualIdentities.query', contextualIdentitiesInfo)}
      ${formatResult('contextualIdentities.get', containerGetInfo)}
    `;
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
  await checkApiAvailability();
});
