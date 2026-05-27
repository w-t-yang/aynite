# Workspaces & Layout

Workspaces and tiles are how you organize your work in Aynite. A **workspace** is a named collection of folders, AI sessions, and layout configurations. **Tiles** are the rectangular regions in your layout that host views.

---

## Workspaces

### Built-in Workspaces

Aynite ships with 4 default workspaces:

| Workspace | Purpose |
|-----------|---------|
| **Aynite Playbook** | Guides, examples, demo data — your sandbox |
| **Dev** | Your main development workspace (points to your projects) |
| **Market Lens** | Trading commands, stock data, financial analysis |
| **The Quill** | Writing, notes, content creation |

### Creating Workspaces

1. Open the workspace switcher (click the workspace name in the title bar)
2. Click **New Workspace**
3. Enter a name and configure your workspace folders

### Managing Workspaces

- **Switch workspaces** — From the workspace switcher dropdown
- **Add folders** — Workspace settings → Add Folder
- **Delete workspace** — Workspace settings → Delete (switches to the first remaining workspace)
- **Each workspace has its own** — Folder list, open files, AI sessions, layout configuration

### Per-Window Workspaces

With multi-window support, each window can have its own active workspace. This lets you keep your Dev workspace open in one window and your Market Lens workspace in another.

---

## Tiles

Tiles are the building blocks of your workspace layout. Each tile hosts exactly one **view** (an iframe-loaded component like AI Chat, File Browser, or any DataView).

### Tile Shortcuts

| Action | Shortcut |
|--------|----------|
| Split vertically | `Ctrl+-` |
| Split horizontally | `Ctrl+=` |
| Close tile | `Ctrl+Q` |
| Cycle through tiles | `Ctrl+O` |
| Refresh tile content | `Ctrl+R` |

### Splitting Tiles

Split any tile to create a side-by-side or stacked layout:

- **Vertical split** — Divides the tile into left and right panels
- **Horizontal split** — Divides the tile into top and bottom panels

You can keep splitting to create complex layouts — each split creates new tiles you can further divide.

### Loading Views

In any tile, click the tile menu (•••) to:
- **Load a view** — Choose from all available views (AI Chat, File Browser, RSS, DataViews, etc.)
- **Empty tile** — If a tile has no view, click **Load View** to pick one

### Empty Tiles

Empty tiles show a **Load View** button and keyboard shortcut reference:
- `Ctrl+-` Split vertically
- `Ctrl+=` Split horizontally
- `Ctrl+Q` Close tile
- `Ctrl+O` Cycle around tiles
- `Ctrl+R` Refresh tile

---

## Pre-built Layouts

When you create a new workspace, you can start with a pre-built layout:

| Layout | Description |
|--------|-------------|
| **Welcome** | Horizontal split: tree view / file browser / AI chat |
| **Chat Vibe** | Workspace view (35%) / AI browser (65%) |
| **RSS** | Single RSS reader tile |
| **Spotify** | Single Spotify player tile |
| **Whiteboard** | Horizontal split: canvas (50%) / mind map (50%) |
| **Diagrams** | Mermaid diagram view |
| **Empty Layout** | Start from scratch with a single empty tile |

Choose **Empty Layout** if you want to build your layout manually from scratch.

---

## The Playbook Workspace

The **Aynite Playbook** is a special workspace that ships with the app. It contains:
- **Welcome.md** — In-app onboarding guide
- **Demo data** — Sample files for all 8 dataviews
- **Trading showcase** — Stock commands with sample data
- **Writing guides** — Reference material for content creation

You can modify or delete anything in the playbook — it's your sandbox.
