# Bookspace

A web extension for Zen Browser that automatically loads bookmarks from a folder matching the workspace name when a workspace is loaded.

## Features

- Automatically detects workspace changes
- Finds bookmark folders matching the workspace name (case-insensitive)
- Opens all bookmarks from the matching folder in new tabs
- Recursively includes bookmarks from subfolders

## How It Works

When a workspace is loaded in Zen Browser, Bookspace:

1. Detects the workspace change (via storage events or polling)
2. Searches for a bookmark folder with a name matching the workspace name
3. Opens all bookmarks from that folder (and subfolders) in new tabs

## Installation

1. Clone this repository
2. Open Zen Browser
3. Go to `about:debugging` (or `zen://debugging`)
4. Click "This Firefox" (or "This Zen Browser")
5. Click "Load Temporary Add-on"
6. Select the `manifest.json` file from this extension

## Usage

1. Create bookmark folders in your bookmarks with names matching your workspace names
2. Add bookmarks to those folders
3. Switch between workspaces in Zen Browser
4. Bookspace will automatically open the bookmarks from the matching folder

## Example

If you have a workspace named "Development", create a bookmark folder also named "Development" and add your development-related bookmarks to it. When you switch to the "Development" workspace, Bookspace will automatically open all bookmarks from that folder.

## Limitations

Since Zen Browser's workspace API is not directly accessible from web extensions, Bookspace uses:

- Storage events (if Zen Browser stores workspace info in `browser.storage`)
- Polling (checks every 2 seconds for workspace changes)
- Tab/window creation events as fallback indicators

If Zen Browser exposes workspace information through a different mechanism, this extension can be updated to use that API.

## Development

The extension uses:
- Manifest V2 (compatible with Firefox/Zen Browser)
- Bookmarks API
- Tabs API
- Storage API

## License

MPL 2.0
