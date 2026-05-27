# Working with Files

The file browser is your main workspace for viewing, editing, and managing files. It's split into two parts: a **file tree** on the left (or accessible via the Tree View tile) and a **file content area** on the right.

---

## Opening Files

- **Click** any file in the tree view to open it in a tab
- **`Ctrl+Tab`** — Fuzzy-find any file in your workspace and jump to it instantly
- Files open in tabs — you can have multiple files open at once

### Tab Actions

| Action | How |
|--------|-----|
| Close a tab | Click the ✕ on the tab or press `Ctrl+W` |
| Close all tabs | Right-click a tab → Close All |
| Reorder tabs | Drag a tab left or right |
| Switch tabs | Click a tab, or use `Ctrl+Tab` / `Ctrl+Shift+Tab` |

---

## Three Viewing Modes

Aynite automatically selects the best mode for each file type, but you can always switch manually.

### FileView Mode (Default for media)

Specialized renderers for specific file types, activated automatically:

| File Type | Viewer | What You See |
|-----------|--------|--------------|
| `.md`, `.markdown` | Markdown | Rendered markdown with headings, code blocks, images |
| `.pdf` | PDF | Full PDF rendering with zoom, fit-to-height |
| `.png`, `.jpg`, `.gif`, `.svg` | Image | Image with zoom controls |
| `.mp3`, `.wav`, `.flac` | Audio | Audio player with controls |
| `.mp4`, `.webm`, `.mov` | Video | Video player with streaming |
| `.html`, `.htm` | HTML | Rendered webpage in an iframe |

### View Mode

Shows the raw file content as read-only text with syntax highlighting. Useful for code files or when you want to see the source.

### Edit Mode

Opens the file in a writable text editor with syntax highlighting. Only available for text-based files.

**To switch modes:** Use the buttons at the bottom of the file content area:
- Click the file type icon (e.g., 🌐 for HTML) for FileView
- Click **View** for read-only text
- Click **Edit** (pencil icon) for editing

> 💡 If a file has git changes, the diff view takes priority. Switch back using the mode buttons.

---

## Editing Files

1. Open a text file
2. Click **Edit** (or press `Ctrl+E`)
3. Make your changes
4. Press **`Ctrl+S`** to save
5. A dirty indicator (dot) appears on the tab when there are unsaved changes

---

## Searching Within a File

1. **`Ctrl+F`** — Open the search bar (only in edit or view mode)
2. Type your query — matches are highlighted in yellow
3. **`Ctrl+N`** — Jump to the next match
4. **`Ctrl+P`** — Jump to the previous match
5. The search bar shows match count (e.g., "3 of 12 matches")
6. Click the **✕** or press **`Escape`** to close the search bar

---

## Git Diff View

When a file has git changes, it shows a side-by-side diff view instead of the regular content. See the [Git Integration guide](GIT_INTEGRATION.md) for details.

---

## File Tree (Tree View)

The tree view shows your workspace folders as an expandable file tree.

- **Click** to expand/collapse folders
- **Click a file** to open it in the file browser
- **Right-click** a folder for options: New File, New Folder, Rename, Delete, Refresh
- **Git status badges** show next to files — `M` (modified), `A` (added), `U` (untracked), `D` (deleted), `R` (renamed)

### Git Diff Mode

Toggle **Changes Only** in the tree view header to show only files with git changes. This turns the tree into a git diff panel showing changed files grouped by folder, with add/delete line counts for each file.
