# Bookspace

A web extension for Zen Browser that filters bookmarks display based on the current workspace. When a workspace is active, only bookmarks from a folder matching the workspace name are displayed. If no matching folder exists, all bookmarks are shown.

## Features

- **Workspace-based bookmark filtering**: Only shows bookmarks from a folder matching the workspace name
- **Fallback to all bookmarks**: If no matching folder exists, displays all bookmarks
- **Custom bookmark viewer**: Beautiful popup UI showing filtered bookmarks
- **Quick actions**: Open individual bookmarks or all at once
- **Automatic workspace detection**: Monitors for workspace changes via storage events

## How It Works

When you switch to a workspace in Zen Browser, Bookspace:

1. Checks if there's a bookmark folder with a name matching the workspace
2. **If a matching folder exists**: Only displays bookmarks from that folder
3. **If no matching folder exists**: Displays all bookmarks

## Installation

1. Clone this repository
2. Open Zen Browser
3. Go to `about:debugging` (or `zen://debugging`)
4. Click "This Firefox" (or "This Zen Browser")
5. Click "Load Temporary Add-on"
6. Select the `manifest.json` file from this extension

## Usage

### Setup

1. Create bookmark folders in your bookmarks with names matching your workspace names
2. Add bookmarks to those folders
3. The folder can be anywhere in your bookmarks (toolbar, menu, other bookmarks)

### Using the Extension

1. Click the Bookspace icon in the toolbar
2. Enter your workspace name (e.g., "Development", "Research", "Personal")
3. Click "Apply" to filter bookmarks
4. The popup shows:
   - **Green status**: Showing bookmarks from the matching folder
   - **Yellow status**: No matching folder found, showing all bookmarks
5. Click any bookmark to open it, or "Open All" to open all displayed bookmarks

**Note:** Since Zen Browser's workspace API is not directly accessible from web extensions, you need to manually enter the workspace name. The extension remembers your last workspace.

## Example

1. Create a bookmark folder called "Development" in your bookmarks
2. Add your development-related bookmarks to that folder (GitHub, Stack Overflow, docs, etc.)
3. Create another folder called "Research" with research-related bookmarks
4. Open Bookspace popup and type "Development" → only Development bookmarks shown
5. Type "Research" → only Research bookmarks shown
6. Type a name with no matching folder → all bookmarks shown

## Limitations

Since Zen Browser's workspace API is not directly accessible from web extensions:

- You need to manually enter the workspace name in the popup
- The extension remembers your last entered workspace
- Automatic workspace detection is attempted but may not work reliably

If Zen Browser exposes workspace information through a different mechanism in the future, this extension can be updated to use that API.

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
