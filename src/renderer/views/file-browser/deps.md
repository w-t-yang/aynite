# FileBrowser — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: config** | `config.get('openedFiles')`, `config.get('activeFile')` | Load persisted tabs and active file on mount |
| **Bridge: configMutations** | `configMutations.set('activeFile', ...)`, `configMutations.set('openedFiles', ...)` | Persist active file and open tabs |
| **Bridge: file** | `bridgeFile.read(path)`, `bridgeFile.info(path)`, `bridgeFile.checkIsText(path)`, `bridgeFile.list(dir)` | File content, metadata, text detection, listing |
| **Bridge: fileMutations** | `fileMutations.write(path, content)`, `fileMutations.watch(path)` | Save file, watch for external changes |
| **Bridge: git** | `git.getStatus(path)`, `git.getIndexContent(path)` | Git diff detection for active file |
| **Bridge: config** (via useFileModes) | `config.getWithPayload('view-config', ...)` | Load fileview configurations for extension matching |
| **Bridge: config** (via useFileModes) | `config.getWithPayload('matching-views', ...)` | Load matching dataviews for JSON files |

## Events (via `useViewEvent` — in hooks)

| Hook | Event | Payload | Handler |
|------|-------|---------|---------|
| **useFileTabs** | `active-file-changed` | `{ path: string }` | Opens new tab or switches to existing one |
| **useFileContent** | `fs-change` | `{ event: string, path: string }` | Debounced reload of file on disk change |
| **useFileModes** | `git-status-changed` | `{ root: string }` | Re-evaluates diff status for active file |

## Sub-components and their hooks

| Component | Hook | Purpose |
|-----------|------|---------|
| `FileBrowserPage` | `useFileTabs` | Manages tabs array, active path, navigation history |
| `FileBrowserPage` | `useFileContent` | Manages file content, loading/error, save, dirty tracking |
| `FileBrowserPage` | `useFileModes` | Fileview/diff/dataview mode selection logic |
| `FileBrowserPage` | `useSearchBar` | In-file search with match navigation |

## Description

Full file editor with tabs, syntax highlighting, git diff mode, fileview support, and dataview integration. The most complex view with 4 hooks managing different aspects of file editing.
