/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

document.addEventListener('DOMContentLoaded', () => {
  const workspaceInput = document.getElementById('workspace-name');
  const loadButton = document.getElementById('load-bookmarks');
  const statusDiv = document.getElementById('status');
  
  // Try to get the current workspace name from storage
  browser.storage.local.get(['zenWorkspace', 'activeWorkspace', 'workspaceName']).then((result) => {
    const workspaceName = result.zenWorkspace || result.activeWorkspace || result.workspaceName;
    if (workspaceName) {
      workspaceInput.value = workspaceName;
    }
  });
  
  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(() => {
      statusDiv.className = 'status';
      statusDiv.textContent = '';
    }, 3000);
  }
  
  const updateButton = document.getElementById('update-bookmarks');
  
  loadButton.addEventListener('click', async () => {
    const workspaceName = workspaceInput.value.trim();
    
    if (!workspaceName) {
      showStatus('Please enter a workspace name', true);
      return;
    }
    
    loadButton.disabled = true;
    loadButton.textContent = 'Loading...';
    
    try {
      // Send message to background script to load bookmarks
      const response = await browser.runtime.sendMessage({
        action: 'loadBookmarks',
        workspaceName: workspaceName
      });
      
      if (response.success) {
        if (response.count > 0) {
          showStatus(`Opened ${response.count} bookmark(s) from "${workspaceName}"`);
        } else {
          showStatus(`No bookmarks found in folder "${workspaceName}"`, true);
        }
      } else {
        showStatus(response.error || 'Failed to load bookmarks', true);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      showStatus('Error: ' + error.message, true);
    } finally {
      loadButton.disabled = false;
      loadButton.textContent = 'Load Bookmarks';
    }
  });
  
  updateButton.addEventListener('click', async () => {
    const workspaceName = workspaceInput.value.trim();
    
    if (!workspaceName) {
      showStatus('Please enter a workspace name', true);
      return;
    }
    
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    
    try {
      // Send message to background script to update bookmarks
      const response = await browser.runtime.sendMessage({
        action: 'updateBookmarks',
        workspaceName: workspaceName
      });
      
      if (response.success) {
        if (response.added !== undefined) {
          showStatus(`Updated folder "${workspaceName}": ${response.count} bookmarks (added ${response.added} new)`);
        } else {
          showStatus(`Updated folder "${workspaceName}" with ${response.count} bookmark(s)`);
        }
      } else {
        showStatus(response.error || 'Failed to update bookmarks', true);
      }
    } catch (error) {
      console.error('Error updating bookmarks:', error);
      showStatus('Error: ' + error.message, true);
    } finally {
      updateButton.disabled = false;
      updateButton.textContent = 'Update Bookmarks Folder';
    }
  });
  
  // Allow Enter key to trigger load
  workspaceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadButton.click();
    }
  });
});
