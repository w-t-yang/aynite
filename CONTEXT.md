# Aynite

An AI-native workspace that gives AI agents direct access to files, git, media feeds, and data visualizations through a tiled window manager — an operating system for your AI agent.

## Language

### Core Concepts

**Aynite** (proper noun):
The Electron desktop application AND the default AI agent. The branding is deliberately unified: "Aynite runs Aynite the agent for Aynite the user."
*Avoid*: The app, the client

**Workspace**:
A named collection of folders, AI sessions, and layout configurations. Users can have multiple workspaces (e.g., "Dev", "Aynite Playbook", "Market Lens", "The Quill"), each with its own set of workspace folders and state.
*Avoid*: Project, project directory

**Tile**:
A rectangular region in the layout that hosts exactly one **view** (iframe). Tiles can be split vertically or horizontally to create composite layouts.
*Avoid*: Panel, pane, tab

**View**:
An iframe-loaded user interface component. Views are isolated from each other (each runs in its own iframe) and communicate via `postMessage`. There are 16 built-in views: aichat, ai-browser, file-browser, rss, settings, spotify, treeview, workspace-view, and 8 data-driven visualizations (dataview-*).
*Avoid*: App, page, screen

### Data Views

**DataView** (prefix):
A view that loads and validates a single JSON file against a schema. The 8 dataviews are: chart, stock, graph, flow, diagram, mindmap, canvas, and theme. Each has a `config.json` with an `expected_file_type` schema.
*Avoid*: Chart, graph (ambiguous without context)

**DataViewChart**:
A charting view supporting bar, line, area, pie, and radar chart types. Schema: `{keys: string[], data: object[]}`.

**DataViewStock**:
A candlestick chart view for financial data. Schema: `{symbol: string, data: [{open, high, low, close, volume}]}`.

**DataViewGraph**:
A force-directed graph view (now using bipartite layered layout). Schema: `{nodes: [{id, label}], links: [{source, target}]}`.

**DataViewFlow**:
A node-based flow editor using @xyflow/react. Schema: `{nodes: [{position: {x,y}, data: {label}}], edges: [{source, target}]}`.

**DataViewDiagram**:
A Mermaid diagram renderer. Schema: `{definition: string}`.

**DataViewMindMap**:
A tree-based mind map with dynamic node widths and auto-fit zoom. Schema: `{root: {id, label, children?}}`.

**DataViewCanvas**:
An Excalidraw-based infinite whiteboard. Schema: `{elements: object[], appState: object}`.

**DataViewTheme**:
A color theme editor that exports Aynite-compatible themes. Schema: `{id: string, colors: {string: string}}`.

### File Views

**FileView** (prefix):
A specialized viewer for a specific file type, rendered in the file browser. Unlike dataviews, fileviews have NO schema — they simply render files of matching extensions. The 6 fileviews are: audio, html, image, markdown, pdf, video.
*Avoid*: Player, viewer (unless qualified)

### AI System

**Agent** (also **Spell**):
A named AI agent configuration consisting of a system prompt, model selection, and optional tool set. Multiple agents can coexist (Alpha, Aynite, Ghost, Prism, Sonic, Void).
*Avoid*: Bot, assistant

**Skill**:
A directory containing a `SKILL.md` file that teaches the AI to perform a specific task. Skills are stored at `~/.aynite/skills/` and are loaded at app startup. They are the primary extension mechanism.
*Avoid*: Plugin, extension

**Command**:
An executable shell script with a `COMMAND.md` descriptor. Commands are simpler than skills — they're parameterized scripts the user can run, with no AI involvement.
*Avoid*: Runner, action

**Session**:
A conversation with an AI agent. Sessions are persisted to disk as JSON files and include message history, tool calls, and metadata. Each session belongs to exactly one workspace.
*Avoid*: Conversation, chat (in storage contexts)

**Spell** (alias for Agent):
See **Agent**. The term "spell" is used interchangeably but is being phased out in favor of "agent" for clarity. Internal code still uses both.
*Flagged ambiguity*: The codebase uses both "spell" and "agent" for the same concept. Prefer "agent" in new code.

### File Browser

**FileBrowserPage**:
The view that manages file tabs, content rendering, search, and mode switching. It coordinates between fileviews, text editing, git diff, and dataview rendering.

**Mode** (in file browser):
One of: **edit** (writable text editor), **view** (read-only text), **fileview** (rendered preview like PDF/image/markdown), **diff** (git diff viewer). The `userModeRef` pattern prevents async mode auto-detection from overriding user-selected modes.

### Infrastructure

**aynite-resource://** (protocol):
A custom Electron protocol for serving local files to iframe-based views. Supports HTTP Range requests for media streaming via `fs.createReadStream`. Used by dataviews and fileviews to load JSON data and media files.

**Config Router** (router.ts):
The centralized config dispatch in `src/main/config/router.ts`. Handles ~20 config keys including window-scoped state (active workspace, active file, sessions) and global state (themes, keybindings, view configs). Known architectural debt — should be replaced with a handler registry.

**Window State** (window-state.ts):
Per-window state registry (`Map<number, WindowSession>`) enabling independent workspace selection per window. New windows inherit the globally-active workspace as default.

## Flagged Ambiguities

1. **"Aynite"** refers to the app, the company, and the default agent. This is intentional brand unity, but any future multi-agent offering will need to disambiguate.
2. **"Spell" vs "Agent"** — both terms exist in the codebase for the same concept. Prefer "agent" in new code and UI. "Spell" remains in IPC channel names and internal code for backward compatibility.
3. **"Skill" vs "Command"** — clear distinction exists (skills teach AI, commands run scripts), but "command" is overloaded with the general concept of shell commands (as in `run_command` tool).
4. **"View"** is used broadly — any iframe-loaded component is a "view." The codebase distinguishes between "DataViews" (JSON + schema), "FileViews" (no schema, file-type rendering), and plain "Views" (functional UI like aichat or settings).

## Example Dialogue

**Dev**: I want to add a new visualization for baseball stats.
**Domain Expert**: Is it schema-driven JSON data? Then it's a **DataView** — you'd create `dataview-baseball/` with a `config.json` schema.
**Dev**: What if I just want to render a `.csv` file with a table?
**Domain Expert**: That's a **FileView** — no schema, just render by extension. Create `fileview-csv/`.
**Dev**: And if I want the AI to be able to analyze the stats automatically?
**Domain Expert**: Write a **Skill**. Put a `SKILL.md` in `skills/statistics/` that teaches the agent how to calculate baseball metrics. The agent will activate it when the user asks about stats.
