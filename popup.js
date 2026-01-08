/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

document.addEventListener('DOMContentLoaded', () => {
  const workspaceInput = document.getElementById('workspace-name');
  const applyBtn = document.getElementById('apply-btn');
  const statusBar = document.getElementById('status-bar');
  const bookmarksContainer = document.getElementById('bookmarks-container');
  const openAllBtn = document.getElementById('open-all-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  
  let currentWorkspace = '';
  
  /**
   * Get favicon URL for a bookmark
   */
  function getFaviconUrl(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
      return '';
    }
  }
  
  /**
   * Render bookmarks list
   */
  function renderBookmarks(result) {
    if (!result.bookmarks || result.bookmarks.length === 0) {
      bookmarksContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div>${result.filtered ? 
            `No bookmarks in folder "${result.folderName}"` : 
            'No bookmarks found'}</div>
        </div>
      `;
      return;
    }
    
    const list = document.createElement('ul');
    list.className = 'bookmark-list';
    
    for (const bookmark of result.bookmarks) {
      if (!bookmark.url) continue;
      
      const item = document.createElement('li');
      item.className = 'bookmark-item';
      item.dataset.url = bookmark.url;
      
      const favicon = document.createElement('img');
      favicon.className = 'bookmark-favicon';
      favicon.src = getFaviconUrl(bookmark.url);
      favicon.onerror = () => { favicon.style.display = 'none'; };
      
      const info = document.createElement('div');
      info.className = 'bookmark-info';
      
      const title = document.createElement('div');
      title.className = 'bookmark-title';
      title.textContent = bookmark.title || bookmark.url;
      
      const url = document.createElement('div');
      url.className = 'bookmark-url';
      url.textContent = bookmark.url;
      
      info.appendChild(title);
      info.appendChild(url);
      
      item.appendChild(favicon);
      item.appendChild(info);
      
      item.addEventListener('click', () => {
        browser.runtime.sendMessage({
          action: 'openBookmark',
          url: bookmark.url
        });
      });
      
      list.appendChild(item);
    }
    
    bookmarksContainer.innerHTML = '';
    bookmarksContainer.appendChild(list);
  }
  
  /**
   * Update status bar
   */
  function updateStatusBar(result) {
    if (result.filtered) {
      statusBar.className = 'status-bar filtered';
      statusBar.textContent = `📁 Showing ${result.bookmarks.length} bookmark(s) from "${result.folderName}"`;
    } else {
      statusBar.className = 'status-bar all';
      statusBar.textContent = `📚 Showing all ${result.bookmarks.length} bookmark(s) (no matching folder)`;
    }
  }
  
  /**
   * Load bookmarks for workspace
   */
  async function loadBookmarks(workspaceName) {
    if (!workspaceName) {
      statusBar.className = 'status-bar';
      statusBar.textContent = 'Enter a workspace name to filter bookmarks';
      bookmarksContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div>Enter a workspace name above to see filtered bookmarks</div>
        </div>
      `;
      return;
    }
    
    bookmarksContainer.innerHTML = '<div class="loading">Loading bookmarks</div>';
    
    try {
      const result = await browser.runtime.sendMessage({
        action: 'getBookmarks',
        workspaceName: workspaceName
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      updateStatusBar(result);
      renderBookmarks(result);
      
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      statusBar.className = 'status-bar';
      statusBar.textContent = 'Error loading bookmarks';
      bookmarksContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div>Error: ${error.message}</div>
        </div>
      `;
    }
  }
  
  /**
   * Apply workspace filter
   */
  async function applyWorkspace() {
    const workspaceName = workspaceInput.value.trim();
    
    if (!workspaceName) {
      return;
    }
    
    currentWorkspace = workspaceName;
    applyBtn.disabled = true;
    applyBtn.textContent = '...';
    
    try {
      await browser.runtime.sendMessage({
        action: 'setWorkspace',
        workspaceName: workspaceName
      });
      
      await loadBookmarks(workspaceName);
      
    } catch (error) {
      console.error('Error applying workspace:', error);
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply';
    }
  }
  
  /**
   * Open all bookmarks
   */
  async function openAllBookmarks() {
    if (!currentWorkspace) {
      return;
    }
    
    openAllBtn.disabled = true;
    openAllBtn.textContent = 'Opening...';
    
    try {
      const result = await browser.runtime.sendMessage({
        action: 'openAllBookmarks',
        workspaceName: currentWorkspace
      });
      
      if (result.success) {
        openAllBtn.textContent = `Opened ${result.count}!`;
        setTimeout(() => {
          openAllBtn.textContent = 'Open All';
          openAllBtn.disabled = false;
        }, 1500);
      } else {
        throw new Error(result.error || 'Failed to open bookmarks');
      }
      
    } catch (error) {
      console.error('Error opening bookmarks:', error);
      openAllBtn.textContent = 'Error';
      setTimeout(() => {
        openAllBtn.textContent = 'Open All';
        openAllBtn.disabled = false;
      }, 1500);
    }
  }
  
  // Event listeners
  applyBtn.addEventListener('click', applyWorkspace);
  
  workspaceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyWorkspace();
    }
  });
  
  openAllBtn.addEventListener('click', openAllBookmarks);
  
  refreshBtn.addEventListener('click', () => {
    if (currentWorkspace) {
      loadBookmarks(currentWorkspace);
    }
  });
  
  // Initialize: get current state and load bookmarks
  browser.runtime.sendMessage({ action: 'getCurrentState' }).then((state) => {
    if (state && state.currentWorkspace) {
      currentWorkspace = state.currentWorkspace;
      workspaceInput.value = state.currentWorkspace;
      loadBookmarks(state.currentWorkspace);
    } else {
      // Try to get from storage
      browser.storage.local.get(['bookspaceWorkspace']).then((result) => {
        if (result.bookspaceWorkspace) {
          currentWorkspace = result.bookspaceWorkspace;
          workspaceInput.value = result.bookspaceWorkspace;
          loadBookmarks(result.bookspaceWorkspace);
        } else {
          statusBar.className = 'status-bar';
          statusBar.textContent = 'Enter a workspace name to filter bookmarks';
          bookmarksContainer.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <div>Enter a workspace name above to see filtered bookmarks</div>
            </div>
          `;
        }
      });
    }
  }).catch((error) => {
    console.error('Error getting current state:', error);
    statusBar.className = 'status-bar';
    statusBar.textContent = 'Enter a workspace name to filter bookmarks';
  });
});
