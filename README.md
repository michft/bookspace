# Bookspace

$${\color{red}
#⚠️ **WARNING: This is ALPHA Software, version 0.0.1** ⚠️

#**Things will be broken. This is NOT ready for production use yet.**
}$$


A web extension for Zen Browser that organizes bookmarks by workspace using folders.

## How It Works

1. **On first load**: All bookmarks in the toolbar are moved into a `bookspace` folder
2. **Create workspace folders**: Inside `bookspace`, create folders matching your workspace names
3. **Attach containers to workspaces**: Create Firefox containers and attach them to workspace tabs (see Container Setup below)
4. **Automatic workspace detection**: The extension detects the current workspace by matching the active tab's container name to a bookspace folder
5. **Manual workspace switching**: You can also manually switch workspaces via the popup

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

When you switch to "Development" workspace (or when a tab with a "Development" container becomes active):
```
Bookmarks Toolbar/
├── GitHub
├── Stack Overflow
├── MDN Docs
└── bookspace/
    └── Personal/
        └── YouTube
```

## Container Setup

**Important**: To enable automatic workspace detection, you must attach Firefox containers to your workspace tabs. The extension matches container names to bookspace folder names.

### Creating and Using Containers

1. **Create containers** in Firefox:
   - Click the container icon in the address bar (or use the Multi-Account Containers extension)
   - Select "Manage Containers" or "New Container"
   - Create containers with names matching your workspace folder names (e.g., "Development", "Personal")

2. **Attach containers to tabs**:
   - When opening a new tab, select a container from the container menu
   - Or right-click a link and select "Open Link in Container" → choose your container
   - The container name must exactly match a folder name inside the `bookspace` folder

3. **Container name matching**:
   - Container names are matched to bookspace folder names (case-insensitive)
   - If a container name matches a folder, that workspace is automatically activated
   - If no container is assigned (default container), the extension defaults to `bookspace-none` mode
   - If a container name doesn't match any folder, it also defaults to `bookspace-none` mode

### Example

If you have a bookspace folder structure:
```
bookspace/
├── Development/
└── Personal/
```

You should create containers named:
- "Development" (matches the Development folder)
- "Personal" (matches the Personal folder)

When you open a tab in the "Development" container, the extension will automatically show bookmarks from the `bookspace/Development/` folder.

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
5. **Create Firefox containers** with names matching your workspace folder names (see Container Setup above)
6. **Attach containers to tabs** when working in different workspaces

### Switching Workspaces

**Automatic (Container-based)**:
- When you open a tab with a container attached, the extension automatically detects the workspace
- The container name must match a bookspace folder name
- The toolbar updates automatically to show bookmarks from the matching workspace

**Manual**:
1. Click the Bookspace icon in the toolbar
2. Either:
   - Click a workspace name from the list, or
   - Click "bookspace-none" or "bookspace-all" buttons
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
- Contextual Identities API (for container detection)

## License

This work is licensed under the Creative Commons Attribution-NonCommercial 4.0 
International License (CC BY-NC 4.0).

To view a copy of this license, visit 
http://creativecommons.org/licenses/by-nc/4.0/ or see the [LICENSE](LICENSE) file.

**Summary:**
- ✅ You can share and adapt this work
- ✅ You must give appropriate credit
- ❌ You cannot use this work for commercial purposes
