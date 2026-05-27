# Customization

Aynite is designed to feel like yours. Every visual element — backgrounds, text, borders, accent colors, scrollbars, fonts — is controlled by CSS variables that you can customize.

---

## Themes

### Built-in Themes

Aynite ships with 6 built-in themes:

- **Aynite Deep** — Dark, purple-accented (default)
- **Light** — Clean, light interface
- **Dark** — Standard dark mode
- **Solarized Light** — Warm, eye-friendly
- **Solarized Dark** — Low-contrast dark
- **Night Owl** — High-contrast dark with vibrant colors

Switch themes in **Settings → Appearance**.

### Creating Your Own Theme

Use the `/create-theme` skill in the AI chat to generate a custom theme from a description:

```
/create-theme make me a cozy autumn sunset theme
```

The AI will:
1. Generate a complete theme with all 32 color properties
2. Save it to `~/.aynite/themes/<name>.json`
3. Press **`Ctrl+R`** to refresh the tile
4. Find it in **Settings → Appearance**

Try any description — "cyberpunk neon," "forest green," "ocean depths," "vintage paper." The skill handles backgrounds, text colors, borders, accent colors, semantic colors (errors, warnings, success), scrollbar styling, and font choices.

### Theme Properties

Each theme defines 32 CSS variables that control every visual aspect of the interface:

- **Background** — Main, sidebar, popover, card, input surfaces
- **Foreground** — Primary text, muted text, inverted text
- **Borders** — Default border, focus rings, input borders
- **Accents** — Primary, secondary colors
- **Semantic** — Success, warning, error, info colors
- **Scrollbars** — Track and thumb colors
- **Typography** — Font family, sizes for UI and code

---

## Keybindings

### Viewing Keybindings

Open **Settings → Keybindings** to see all available keyboard shortcuts. They're grouped by category:
- **Application** — Global shortcuts (toggle panels, new window, search)
- **Navigation** — Tab switching, tile navigation
- **Editing** — Save, search within file

### Customizing Keybindings

Each keybinding can be customized in **Settings → Keybindings**:

1. Find the action you want to rebind
2. Click the current keybinding
3. Press your desired key combination
4. The change is saved immediately

Keybindings are stored in `~/.aynite/config/keybindings.json`.

---

## General Settings

Open **Settings** (gear icon in the sidebar) to configure:

| Tab | What You Can Configure |
|-----|----------------------|
| **AI** | Providers, API keys, models, reasoning effort, default agent |
| **Appearance** | Theme selection |
| **Keybindings** | View and customize keyboard shortcuts |
| **Agents** | Create and configure AI agent profiles |
| **Commands** | Add folders containing commands |
| **Skills** | Add folders containing skills |
| **Tools** | Configure tool access and permissions |
| **About** | Version info, update channel |

### Settings Folder

You can add custom command and skill folders in their respective settings tabs. Press **`Ctrl+R`** to refresh the tile after adding new folders.

---

## Layout Customization

### Tiles

- **Split horizontally** — `Ctrl+=`
- **Split vertically** — `Ctrl+-`
- **Close tile** — `Ctrl+Q`
- **Cycle through tiles** — `Ctrl+O`
- **Refresh tile** — `Ctrl+R`

### Loading Views

In an empty tile, click **Load View** to choose from all available views. See the [Workspaces & Layout guide](WORKSPACES_AND_LAYOUT.md) for more details on workspace and layout management.
