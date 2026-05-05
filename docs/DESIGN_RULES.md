# Frontend Design Guidelines & Skill Profile

This document serves as both a design principle guideline for Aynite and a reference skill profile for generating frontend components. It consolidates general frontend design philosophies with the specific, highly-polished aesthetic choices observed in the Aynite app.

## 1. Core Design Philosophy
*Consolidated from the `frontend-design` skill profile.*

Our goal is to create distinctive, production-grade frontend interfaces that avoid generic, cookie-cutter "AI slop" aesthetics. Every interface should execute a clear conceptual direction with precision.

- **Commit to an Aesthetic**: Whether brutally minimal, retro-futuristic, or refined luxury, pick a tone and stick to it. The key is intentionality, not intensity.
- **Differentiate**: What makes the interface unforgettable? Ensure there's a memorable element.
- **Typography**: Choose distinctive, characterful fonts over generic defaults. Pair a unique display font with a refined body font.
- **Motion & Spacing**: Use unexpected spatial composition (asymmetry, controlled density vs. generous negative space). Leverage CSS-only animations for staggered reveals, hover states, and smooth transitions.
- **Depth & Atmosphere**: Use subtle textures, noise, gradient meshes, or layered transparencies instead of defaulting to plain, solid backgrounds.
- **Complexity Matching**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code; minimalist designs need restraint, precision, and careful attention to subtle details.

---

## 2. Aynite App Visual Design Principles
*Derived from the current `src/renderer` implementation.*

The Aynite frontend executes a refined, highly functional, and seamless visual experience. The core design principles observed in the current app are:

### A. Dynamic, Variable-Driven Theming
- **Tokenized Color System**: The app relies exclusively on dynamic CSS variables (`--background`, `--foreground`, `--muted`, `--accent`, etc.) mapped to logical UI regions via Tailwind. 
- **Subtle Layering**: The design uses low-opacity backgrounds (e.g., `bg-accent/20`, `border-border/40`) and CSS color mixing (`color-mix(in srgb, var(--info), transparent 85%)`) to create a deep, sophisticated hierarchy. It completely avoids harsh, jarring solid colors in favor of soft contrast.

### B. Meticulous Micro-Interactions & Transitions
- **Polished Animations**: Components utilize tight, responsive transition effects. Examples include satisfied click feedback (`active:scale-[0.99]`) and smooth, grid-based content reveals for expanded sections.
- **Smooth Fluidity**: Draggable resizing zones and hover states for utility buttons use low-latency transitions, creating a native-feeling window management experience.
- **Integrated Activity Components**: Instead of generic collapsible blocks, activity-heavy areas (like AI thinking or tool steps) use custom, integrated components with pulsing indicators and subtle connector lines to visualize process flow.

### C. Refined Utility Aesthetics
- **Minimalist Agent Feeds**: Complex communication interfaces should avoid "social chat" tropes (like heavy speech bubbles or avatars). Instead, prioritize a "log-style" feed using subtle backgrounds for distinction and clear vertical spacing.
- **Theme-Agnostic Distinction**: Use low-opacity foreground tints (e.g., `bg-foreground/[0.05]`) for distinguishing message types. This ensures perfect visibility and a consistent "muted" feel across both light and dark themes.
- **Typography & Prose**: Tightly controlled markdown rendering (`prose`) that overrides default grays with theme-aware `--foreground` variables to ensure maximum legibility.
### D. Isolated View Theming
- **Propagation Pattern**: Since views are loaded in isolated iframes, theme state must be manually pushed from the parent `Tile` component using inline style injection.
- **Unified Backgrounds**: To ensure a seamless look, views should use `bg-card` for their primary container, matching the `Tile` background.
- **Variable Reliance**: Components must rely exclusively on CSS variables. Hardcoded colors (hex/rgb) are strictly prohibited in views to ensure cross-theme compatibility.
- **Reference**: For implementation details, see [THEME_PROPAGATION.md](./THEME_PROPAGATION.md).

