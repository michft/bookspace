# Bookspace

A web extension for Zen Browser that automatically updates bookmarks in a folder matching the workspace name when a workspace is loaded. The bookmark folder is synced with the currently open tabs in the workspace.

## Features

- **Automatic bookmark folder sync**: When a workspace changes, the bookmark folder matching the workspace name is updated to reflect currently open tabs
- **Automatic workspace detection**: Monitors for workspace changes via storage events and polling
- **Manual controls**: Browser action popup for manual bookmark loading and folder updates
- **Smart folder management**: Creates bookmark folders automatically if they don't exist
- **Bookmark synchronization**: Adds new tabs as bookmarks, removes closed tabs, and updates titles

## How It Works

When a workspace is loaded in Zen Browser, Bookspace:

1. Detects the workspace change (via storage events or polling)
2. Finds or creates a bookmark folder with a name matching the workspace name
3. Updates the folder to match currently open tabs:
   - Adds bookmarks for new tabs
   - Removes bookmarks for closed tabs
   - Updates bookmark titles if they changed

## Installation

1. Clone this repository
2. Open Zen Browser
3. Go to `about:debugging` (or `zen://debugging`)
4. Click "This Firefox" (or "This Zen Browser")
5. Click "Load Temporary Add-on"
6. Select the `manifest.json` file from this extension

## Usage

### Automatic Mode

1. Create bookmark folders in your bookmarks with names matching your workspace names
2. Add bookmarks to those folders
3. Switch between workspaces in Zen Browser
4. Bookspace will automatically attempt to detect workspace changes and open the bookmarks from the matching folder

### Manual Mode

1. Click the Bookspace icon in the toolbar
2. Enter the workspace name in the popup
3. Choose an action:
   - **Load Bookmarks**: Opens all bookmarks from the folder matching the workspace name in new tabs
   - **Update Bookmarks Folder**: Syncs the folder with currently open tabs (adds new, removes closed, updates titles)

**Note:** Since Zen Browser's workspace API is not directly accessible from web extensions, automatic detection may not always work. Use the manual mode for reliable operation.

## Example

If you have a workspace named "Development":

1. Switch to the "Development" workspace
2. Open the tabs you want to bookmark
3. Bookspace will automatically create a "Development" bookmark folder (if it doesn't exist) and update it with your current tabs
4. When you switch back to "Development" later, you can use "Load Bookmarks" to reopen all those tabs

Alternatively, you can manually create a "Development" bookmark folder and add bookmarks to it. When you switch to the workspace, Bookspace will sync the folder with your current tabs.

## Limitations

Since Zen Browser's workspace API is not directly accessible from web extensions, Bookspace uses:

- Storage events (if Zen Browser stores workspace info in `browser.storage`)
- Polling (checks every 2 seconds for workspace changes)
- Tab/window creation events as fallback indicators

**For best results, use the manual mode via the browser action popup.**

If Zen Browser exposes workspace information through a different mechanism, this extension can be updated to use that API.

## Development

The extension uses:
- Manifest V2 (compatible with Firefox/Zen Browser)
- Bookmarks API
- Tabs API
- Storage API

## License

This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 
International License (CC BY-NC 4.0).

To view a copy of this license, visit 
http://creativecommons.org/licenses/by-nc/4.0/ or see the [LICENSE](LICENSE) file.

**Summary:**
- ✅ You can share and adapt this work
- ✅ You must give appropriate credit
- ❌ You cannot use this work for commercial purposes
