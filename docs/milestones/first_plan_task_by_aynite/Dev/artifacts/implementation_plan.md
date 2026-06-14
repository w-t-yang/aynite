# View Config Files Implementation Plan

## Goal
Add per-view JSON config files stored at `~/.aynite/config/views/[view]/config.json` with:
- Basic info: name, description, author, version
- `expected_file_type` (for 8 data-driven views): `ext` (string) + `schema` (JSON Schema)
- `key_bindings`: `{}` for now

## Architecture

### Config file location
```
~/.aynite/config/views/canvas/config.json
~/.aynite/config/views/datachart/config.json
~/.aynite/config/views/diagram/config.json
...
```

### Data flow
1. Default configs inlined in code → written to disk during `initAppFolders()`
2. Views load config via `window.aynite.getConfig('view-config', { view: 'canvas' })`
3. Config router reads `~/.aynite/config/views/[view]/config.json`
4. Schema used for programmatic validation + error display

## Implementation Steps

### Step 1: Schema validator utility
Create `src/renderer/shared/lib/schema-validator.ts`
- Lightweight JSON Schema validator supporting: `type`, `required`, `properties`, `items`, `minItems`, `anyOf`, `enum`
- Returns `{ valid: boolean, errors: string[] }`

### Step 2: Default view configs + path utilities
- Add `getViewConfigDir(viewName)`, `getViewConfigPath(viewName)` in `src/lib/path.ts`
- Add `ConfigKey.VIEW_CONFIG = 'view-config'` to `src/lib/constants/config.ts`
- Create default configs in `src/main/config/view-configs.ts` (all 16 views)
  - 8 with `expected_file_type` (canvas, datachart, diagram, flow, graph, mindmap, stockchart, theme-studio)
  - 8 without (aichat, ai-browser, file-browser, session-view, settings, rss, spotify, treeview)

### Step 3: Config router & init
- Add `routeGetConfig` handler for `ConfigKey.VIEW_CONFIG` in `src/main/config/router.ts`
- Add `initViewConfigs()` called from `initAppFolders()` in `src/main/config/logic.ts`

### Step 4: Refactor 8 data-driven views
Each view currently has a hardcoded `EXPECTED_FORMAT` string. Refactor to:
- On mount, load config via `window.aynite.getConfig('view-config', { view: '...' })`
- Store `schema` from config
- When loading a file: validate with schema validator before manual validation
- In error displays: show schema as expected format

### Step 5: Memory update
- Update `memory.md` with new view config pattern
