# Theme Propagation Pattern for Isolated Views

In Aynite, UI views (Treeview, Settings, AIChat, etc.) are often loaded as standalone HTML pages within iframes. Because iframes are isolated documents, they do not automatically inherit CSS variables or theme state from the parent application. 

To ensure a seamless and themed experience, follow this established pattern.

---

## 1. Parent Responsibility: `Tile.tsx`

The `Tile` component is responsible for "pushing" the theme into the iframe. It does this by:
- **Listening for Changes**: Using the `useTheme` hook to detect theme updates.
- **Inline Injection**: Injecting CSS variables directly into the iframe's `documentElement.style`. This bypasses specificity issues.
- **Attribute Syncing**: Propagating the `data-theme` attribute (e.g., `light` or `dark`) and setting the `color-scheme` CSS property.

### Key Implementation in `Tile.tsx`:
```tsx
const root = iframeDoc.documentElement;

// Inject all theme colors as variables
for (const [key, value] of Object.entries(activeTheme.colors)) {
  root.style.setProperty(`--${toKebabCase(key)}`, value);
}

// Sync theme metadata
root.setAttribute('data-theme', activeTheme.type);
root.style.colorScheme = activeTheme.type;

// Match tile background exactly
root.style.backgroundColor = 'var(--card)';
```

---

## 2. View Responsibility: Component Styling

When building a view component (e.g., `MyNewView.tsx`), follow these styling rules:

### Use Standard Variables
Always use Tailwind utilities or CSS variables instead of hex codes.
- Use `bg-card` for the main container to match the tile background.
- Use `text-foreground` and `text-muted-foreground` for text.
- Use `border-border` for dividers.

### Outermost Container
The outermost container of your view should fill the viewport and ideally use `bg-card` to match the `Tile` container:
```tsx
return (
  <div className="w-full h-full bg-card flex flex-col overflow-hidden">
    {/* View content here */}
  </div>
);
```

### Avoid Redundant Decorations
Since the view is inside a `Tile`, it should **not** include:
- Outer shadows (`shadow-sm`, etc.)
- Outer borders (unless internal dividers are needed)
- Fixed widths (it should be responsive to the tile size)

---

## 3. HTML Template Responsibility: `index.html`

Each view has an `index.html` entry point. Ensure this file is clean of hardcoded overrides.

### Avoid Hardcoded Backgrounds
Do **not** set a hardcoded background color in the `<style>` block of `index.html`:
```html
<!-- BAD: This overrides the theme injection -->
<style>
  body { background: #000; } 
</style>

<!-- GOOD: Let the theme variables handle it -->
<style>
  html, body, #root {
    height: 100%;
    margin: 0;
  }
</style>
```

---

## 4. Troubleshooting

If a view appears "dark" when the app is in "light" theme:
1. Check that `Tile.tsx` is correctly calling `injectThemeIntoIframe()`.
2. Ensure the view's `index.html` doesn't have a `background: #000` style.
3. Verify that the view component uses `bg-card` or `bg-background` instead of a hardcoded class.
4. Ensure `toCSSVar` in the parent matches the variable names expected by the view's CSS/Tailwind configuration.
