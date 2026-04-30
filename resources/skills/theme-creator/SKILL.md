---
name: theme-creator
description: Create custom Aynite themes. Use this skill when a user wants to create a new color theme, customize their editor appearance, design a dark/light theme, or generate a theme based on a mood, image, or color palette. Also use when users mention "theme", "color scheme", "appearance", or "look and feel" of the editor.
---

# Theme Creator

Create beautiful, harmonious Aynite themes from user descriptions.

## Theme File Format

Aynite themes are stored as JSON files in `~/.aynite/themes/`. Each file contains:

```json
{
  "name": "Display Name",
  "type": "dark",
  "isSystem": false,
  "colors": {
    "background": "#hex",
    "foreground": "#hex",
    "sidebar": "#hex",
    "card": "#hex",
    "cardForeground": "#hex",
    "popover": "#hex",
    "popoverForeground": "#hex",
    "primary": "#hex",
    "primaryForeground": "#hex",
    "secondary": "#hex",
    "secondaryForeground": "#hex",
    "muted": "#hex",
    "mutedForeground": "#hex",
    "accent": "#hex",
    "accentForeground": "#hex",
    "destructive": "#hex",
    "destructiveForeground": "#hex",
    "border": "#hex",
    "input": "#hex",
    "ring": "#hex",
    "selection": "#hex",
    "selectionForeground": "#hex",
    "link": "#hex",
    "success": "#hex",
    "successForeground": "#hex",
    "warning": "#hex",
    "warningForeground": "#hex",
    "info": "#hex",
    "infoForeground": "#hex",
    "tabActive": "#hex",
    "tabActiveBorder": "#hex",
    "scrollbarThumb": "#hex",
    "scrollbarTrack": "transparent"
  },
  "fonts": {
    "fontFamily": "Inter, ui-sans-serif, system-ui, sans-serif",
    "fontMono": "JetBrains Mono, ui-monospace, SFMono-Regular, monospace",
    "fontSize": "14px"
  }
}
```

## Color Roles

Understanding what each color controls helps create coherent themes:

- **background / foreground**: Main editor area background and text color
- **sidebar**: Left panel background (slightly different from main background)
- **card / popover**: Floating UI elements like modals and dropdowns
- **primary**: Brand/accent color for buttons, active states, and emphasis
- **secondary**: Subtler UI surfaces like inactive panels and secondary buttons
- **muted / mutedForeground**: De-emphasized text and backgrounds (comments, hints)
- **accent**: Hover states and interactive element backgrounds
- **destructive**: Delete actions and error states
- **border**: Lines between panels, around inputs
- **input**: Input field backgrounds
- **ring**: Focus ring outlines on interactive elements
- **selection / selectionForeground**: Text selection highlight
- **link**: Hyperlink color
- **success / warning / info**: Semantic status colors
- **tabActive / tabActiveBorder**: Active editor tab styling
- **scrollbarThumb / scrollbarTrack**: Scrollbar appearance

### Font Properties

- **fontFamily**: The primary UI font stack (comma-separated list)
- **fontMono**: The monospace font stack for code and file content
- **fontSize**: Base font size for the UI (e.g. `"14px"`, `"13px"`, `"16px"`)

## Design Guidelines

When creating themes, follow these principles:

1. **Contrast Ratios**: Ensure at least 4.5:1 contrast between foreground/background pairs for readability. Text on dark backgrounds should be light; text on light backgrounds should be dark.

2. **Cohesive Palette**: Derive all colors from a base palette of 3-5 hues. Use HSL adjustments to create variations rather than picking unrelated colors.

3. **Hierarchy Through Lightness**: In dark themes, use progressively lighter backgrounds for elevated surfaces (sidebar < background < card < popover). In light themes, reverse this.

4. **Semantic Consistency**: Destructive should always feel "dangerous" (reds/oranges), success should feel "positive" (greens), warnings should feel "cautionary" (yellows/ambers).

5. **Foreground Pairing**: Every background color with a "Foreground" pair must have sufficient contrast. The foreground should be readable against its paired background.

## Workflow

1. Ask the user what mood, style, or colors they want (e.g., "ocean blue", "warm sunset", "cyberpunk neon", "forest green")
2. Generate a complete theme JSON with all 32 color properties
3. Save it to `~/.aynite/themes/<theme-id>.json` where `<theme-id>` is the lowercase, hyphenated name
4. Set `"isSystem": false` for user-created themes
5. Set `"type"` to `"dark"` or `"light"` based on the background luminance
6. Tell the user they can switch to the new theme in Settings > Appearance

## Example

If the user says "make me an ocean theme", you might create:

```json
{
  "name": "Ocean",
  "type": "dark",
  "isSystem": false,
  "colors": {
    "background": "#0a1628",
    "foreground": "#c8ddf0",
    "sidebar": "#081220",
    "card": "#0f1e34",
    "cardForeground": "#c8ddf0",
    "popover": "#0f1e34",
    "popoverForeground": "#c8ddf0",
    "primary": "#38bdf8",
    "primaryForeground": "#0a1628",
    "secondary": "#1a2d48",
    "secondaryForeground": "#c8ddf0",
    "muted": "#152438",
    "mutedForeground": "#7a9ab8",
    "accent": "#1a2d48",
    "accentForeground": "#c8ddf0",
    "destructive": "#f87171",
    "destructiveForeground": "#0a1628",
    "border": "#1e3652",
    "input": "#1a2d48",
    "ring": "#38bdf8",
    "selection": "#1e4976",
    "selectionForeground": "#c8ddf0",
    "link": "#7dd3fc",
    "success": "#34d399",
    "successForeground": "#042f2e",
    "warning": "#fbbf24",
    "warningForeground": "#451a03",
    "info": "#60a5fa",
    "infoForeground": "#eff6ff",
    "tabActive": "#0a1628",
    "tabActiveBorder": "#38bdf8",
    "scrollbarThumb": "#1e3652",
    "scrollbarTrack": "transparent"
  }
}
```
