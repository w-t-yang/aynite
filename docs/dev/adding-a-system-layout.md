# Adding a New System Layout (with View)

This doc captures the full process for creating a new system layout — from the view file all the way through to wiring it into the sidebar, homepage, build config, and workspace migration.

---

## 1. Create the View

Each view lives in `src/renderer/views/<view-name>/`. It needs at minimum:

- **`index.html`** — entry HTML file
- **`<view-name>-main.tsx`** — entry point that registers the view
- **`<ViewName>.tsx`** — the actual view component
- **`config.json`** — metadata (name, description, i18n, aynite-version)

Example directory layout for `flows-view`:

```
src/renderer/views/flows-view/
├── index.html
├── flows-view-main.tsx
├── FlowsView.tsx
└── config.json
```

---

## 2. Register the View Entry in Vite Build Config

In **`vite.views.config.ts`**, add a new entry under `build.rollupOptions.input`:

```ts
'views/flows-view/index': resolve(
  __dirname,
  'src/renderer/views/flows-view/index.html',
),
```

✅ **Verified:** `npm run build` compiles without errors.

---

## 3. Define the Layout Constant

In **`src/lib/constants/layout.ts`**, define a new layout config constant.

A single-tile leaf layout looks like:

```ts
export const FLOWS_LAYOUT: LayoutConfig = {
  id: 'sys-flows',          // Prefix with 'sys-' for system layouts
  name: 'Flows',            // Display name
  system: true,             // Prevents deletion/modification
  fixed: true,              // Prevents splitting
  layout: {
    id: 'tile-flows',       // Unique tile ID
    type: 'leaf',           // 'leaf' for a single view, 'split' for multi-tile
    name: 'flows-view',     // Must match the view's registered name
    size: 100,              // Full width
  },
}
```

> For a multi-tile layout, use `type: 'split'` with `children` array (see `PROJECTS_LAYOUT`).

Add the new constant to the `SYSTEM_LAYOUTS` array **in the desired sidebar order**:

```ts
export const SYSTEM_LAYOUTS: LayoutConfig[] = [
  HOME_LAYOUT,
  PROJECTS_LAYOUT,
  FLOWS_LAYOUT,    // Between Projects and Settings
  SETTINGS_LAYOUT,
]
```

---

## 4. Wire the Sidebar

In **`src/renderer/src/layout/Sidebar.tsx`**, add a sidebar item:

```ts
{ id: 'flows', layoutId: 'sys-flows', icon: Workflow }
```

Import the icon from `lucide-react`:

```ts
import { ..., Workflow } from 'lucide-react'
```

---

## 5. Add Translations

In **`src/lib/constants/renderer/translations.ts`**, add the sidebar label translation:

```ts
'sidebar.flows': { en: 'Flows', zh: '流程' },
```

---

## 6. Wire the Home View

In **`src/renderer/views/home/HomeView.tsx`**, there are two places to update:

### a) SYSTEM_ICON_MAP

Add the icon mapping so the shortcuts section shows the correct icon:

```ts
const SYSTEM_ICON_MAP: Record<string, typeof LayoutIcon> = {
  'sys-home': Home,
  'sys-projects': FolderOpen,
  'sys-flows': Workflow,    // <-- Use the same icon as the sidebar
  'sys-settings': Settings,
}
```

Make sure the icon is imported from `lucide-react`.

### b) systemOrder array (in getOrderedLayouts)

Add the layout ID to the ordered list matching the sidebar order:

```ts
const systemOrder = ['sys-home', 'sys-projects', 'sys-flows', 'sys-settings']
```

---

## 7. Ensure Auto-Injection into Workspaces

### New workspaces
**`src/main/workspace/logic.ts`** — `defaultWorkspaceConfig()` already spreads `SYSTEM_LAYOUTS` into the layouts array, so new workspaces automatically include it:

```ts
function defaultWorkspaceConfig(name: string): WorkspaceConfig {
  // ...
  return {
    layouts: [...SYSTEM_LAYOUTS, layout],
    // ...
  }
}
```

### Existing workspaces
**`src/main/workspace/logic.ts`** — `getWorkspaceState()` has a runtime migration that checks each system layout by ID and prepends any missing ones:

```ts
const existingIds = new Set(data.layouts.map((l: any) => l.id))
const missing = SYSTEM_LAYOUTS.filter((sl) => !existingIds.has(sl.id))
if (missing.length > 0) {
  data.layouts = [...missing, ...data.layouts]
}
```

> ⚠️ **Important:** The original implementation used a `hasSystemLayouts` boolean check (`data.layouts.some(l => l.system === true)`), which only worked once. If a workspace already had some system layouts (e.g. from an earlier migration), new system layouts like `sys-flows` would never be added. The per-ID check above fixes this — it's idempotent and future-proof.

---

## Summary Checklist

| Step | File | What to do |
|------|------|------------|
| 1 | `src/renderer/views/<name>/` | Create view files (html, tsx, config.json) |
| 2 | `vite.views.config.ts` | Add rollup input entry |
| 3 | `src/lib/constants/layout.ts` | Define layout constant, add to `SYSTEM_LAYOUTS` |
| 4 | `src/renderer/src/layout/Sidebar.tsx` | Add sidebar item with icon |
| 5 | `src/lib/constants/renderer/translations.ts` | Add sidebar label translation |
| 6a | `HomeView.tsx` | Add to `SYSTEM_ICON_MAP` with correct icon |
| 6b | `HomeView.tsx` | Add to `systemOrder` in `getOrderedLayouts` |
| 7 | `src/main/workspace/logic.ts` | ✅ Already handled (new + existing workspaces) |

---

## Lessons Learned (from creating `sys-flows`)

1. **Don't use a generic icon placeholder** — always use the same `Workflow` icon for both the sidebar and the home view's `SYSTEM_ICON_MAP`.
2. **The per-ID migration check is the correct pattern** — `hasSystemLayouts` boolean check is brittle when new system layouts are added later.
3. **Order matters in `SYSTEM_LAYOUTS` and `systemOrder`** — keep them consistent with the sidebar's visual order.
