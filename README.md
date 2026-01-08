# Bookspace

A web extension for Zen Browser that organizes bookmarks by workspace using folders.

## How It Works

1. **On first load**: All bookmarks in the toolbar are moved into a `bookspace` folder
2. **Create workspace folders**: Inside `bookspace`, create folders matching your workspace names
3. **Switch workspaces**: Select a workspace to show only those bookmarks in the toolbar

### Example Structure

Before Bookspace:
```
Bookmarks Toolbar/
├── GitHub
├── Stack Overflow
├── MDN Docs
└── YouTube
```

After bookspace organizes:
```
Bookmarks Toolbar/
└── bookspace/
    ├── GitHub
    ├── Stack Overflow
    ├── MDN Docs
    └── YouTube
```

You then organize into workspace folders:
```
Bookmarks Toolbar/
└── bookspace/
    ├── Development/
    │   ├── GitHub
    │   ├── Stack Overflow
    │   └── MDN Docs
    └── Personal/
        └── YouTube
```

When you switch to "Development" workspace:
```
Bookmarks Toolbar/
├── GitHub
├── Stack Overflow
├── MDN Docs
└── bookspace/
    └── Personal/
        └── YouTube
```

## Features

- **Automatic organization**: Moves all toolbar bookmarks into a `bookspace` folder on install
- **Workspace switching**: Shows only bookmarks from the selected workspace folder
- **Preserves structure**: Folders and bookmarks maintain their hierarchy
- **Quick workspace buttons**: Click workspace names in the popup to switch instantly
- **Show all**: Option to display all bookmarks at once

## Installation

1. Clone this repository
2. Open Zen Browser
3. Go to `about:debugging`
4. Click "This Firefox" (or "This Zen Browser")
5. Click "Load Temporary Add-on"
6. Select the `manifest.json` file from this extension

## Usage

### Initial Setup

1. Install the extension - it will automatically move all toolbar bookmarks into a `bookspace` folder
2. Open the Bookmarks Manager and navigate to `Bookmarks Toolbar/bookspace`
3. Create folders for each workspace (e.g., "Development", "Research", "Personal")
4. Drag bookmarks into the appropriate workspace folders

### Switching Workspaces

1. Click the Bookspace icon in the toolbar
2. Either:
   - Click a workspace name from the list, or
   - Type a workspace name and click "Switch"
3. The toolbar will update to show only bookmarks from that workspace

### Other Actions

- **Show All**: Moves all bookmarks back to the toolbar (removes bookspace organization)
- **Re-organize**: Moves any loose toolbar bookmarks back into the bookspace folder

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
