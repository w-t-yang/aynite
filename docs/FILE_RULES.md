# Aynite File Handling Rules

This document outlines the official rules for file handling, rendering, and editing within the Aynite IDE.

## 1. Supported File Types

Aynite distinguishes between several categories of files:

| Category | Typical Extensions | Support Level | View Mode | Edit Mode |
| :--- | :--- | :--- | :--- | :--- |
| **Text** | `.txt`, `.js`, `.ts`, `.py`, etc. | Full | Code View | Code Edit |
| **Markdown** | `.md`, `.markdown` | Special | **Rendered (Iframe)** | Code Edit |
| **HTML** | `.html`, `.htm` | Special | **Rendered (Iframe)** | Code Edit |
| **Media** | `.png`, `.jpg`, `.mp4`, `.mp3` | Preview | Rendered Media | N/A |
| **PDF** | `.pdf` | Preview | Rendered PDF | N/A |
| **Unsupported** | `.zip`, `.docx`, `.exe` | Info Only | Metadata Display | N/A |

## 2. File Type Detection

Aynite does **not** rely solely on file extensions for text detection.
- **Accuracy**: The core process reads the first 1024 bytes of any file. If it finds a null byte (`0x00`), it treats the file as **Binary**. Otherwise, it is treated as **Text**.
- **Special Overrides**: Extensions like `.md` and `.html` are used to trigger specific renderers (iframes) in View Mode, but the underlying content is still treated as text for editing.

## 3. View Mode vs. Edit Mode

### View Mode (Read-Only)
- **Rendering**: 
    - Text files use a read-only syntax-highlighted viewer.
    - Markdown and HTML are rendered inside an **isolated Iframe** with theme-consistent styling.
    - Media files are rendered using native HTML5 players or image tags.
- **Cursor**: A **Grey** blinking caret is visible when the editor is focused, allowing for navigation without modification.
- **Keybindings**: Supports viewer-specific navigation (e.g., `J/K` for up/down, `/` for search) as defined in `keybindings.json`.

### Edit Mode
- **Editing**: Full text editing capabilities.
- **Cursor**: A **Primary Color** blinking caret (matching the active theme).
- **Keybindings**: Supports standard editing commands (e.g., `Ctrl+S` to save, `Ctrl+A` for start of line) as defined in `keybindings.json`.

## 4. UI & Aesthetics

### Syntax Highlighting
- Syntax highlighting colors are dynamically aligned with the app's active theme using CSS variables (`--primary`, `--info`, `--success`, etc.).
- This ensures that code remains readable and aesthetically pleasing across different themes (Dark, Nord, Aurora, etc.).

### Cursor Indicator
- The cursor is a critical focus indicator. 
- In **View Mode**, it turns grey to signal "Look but don't touch".
- In **Edit Mode**, it turns to the theme's primary color to signal "Ready to edit".

## 5. Persistence & Workspace

- **Tab Switching**: When switching tabs (e.g., `Ctrl + Tab`), the editor automatically focuses the content and restores the **Cursor Position**.
- **State Storage**: Cursor positions for each open tab are saved in the workspace configuration file located at `~/.aynite/workspaces/[workspace-name].json`.
- **Loading Optimization**: For unsupported file types, content is **not** loaded into memory, preventing performance degradation when clicking on large binary files.

## 6. Unified Architecture

All file views in View Mode (Text, Markdown, HTML, Media, etc.) share a **Unified Iframe Viewer**. This architecture guarantees that the **background color**, **padding**, **width**, and **scrollbars** are identical across every file type, providing a seamless transition when switching between different media.
