# Bookspace

A web extension for Zen Browser that loads bookmarks from a folder matching the workspace name.

## Important: Zen Browser's Native Workspace Bookmarks

**Zen Browser already has built-in workspace-specific bookmarks!** You can assign bookmarks to specific workspaces using the bookmark editor, and the toolbar will automatically show only bookmarks for the current workspace.

This extension provides an **alternative approach** using bookmark folders named after workspaces, which can be useful if you prefer organizing bookmarks by folder rather than using Zen's native workspace assignment.

## Features

- Manual bookmark loading via browser action popup
- Finds bookmark folders matching the workspace name (case-insensitive)
- Opens all bookmarks from the matching folder in new tabs
- Recursively includes bookmarks from subfolders

## Limitation

**Web extensions cannot modify the native bookmarks toolbar display.** The toolbar is controlled by browser internals that extensions cannot access. This extension opens bookmarks in new tabs rather than filtering the toolbar.

## How It Works

1. You enter a workspace name in the popup
2. The extension searches for a bookmark folder with that name
3. All bookmarks from that folder are opened in new tabs

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
3. Click "Load Bookmarks" to open all bookmarks from the matching folder

**Note:** Since Zen Browser's workspace API is not directly accessible from web extensions, automatic detection may not always work. Use the manual mode for reliable bookmark loading.

## Example

If you have a workspace named "Development", create a bookmark folder also named "Development" and add your development-related bookmarks to it. When you switch to the "Development" workspace, Bookspace will automatically open all bookmarks from that folder.

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
