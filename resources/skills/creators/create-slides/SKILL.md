---
name: create-slides
description: Create interactive slide decks using reveal.js. Use when users want to create presentations, slide decks, slide shows, or any kind of presentation materials. Triggers on phrases like "create slides", "make a presentation", "turn this into slides", "build a slide deck", or any request involving presenting content in slide format. Also triggers when users provide structured content (markdown, notes, outlines) and want it rendered as visual slides. If the user has content files (markdown, text), suggest using this skill to turn them into an interactive reveal.js presentation.
---

# create-slides — Slide Deck Creator

A skill for creating interactive, beautiful slide decks using [reveal.js](https://revealjs.com/). You will work with the user interactively — asking about their content, confirming each slide, and producing a polished HTML presentation.

---

## Workflow Overview

1. **Gather Content** — Ask the user what they want to present. They may provide a file (markdown, text, outline), a folder of content, or describe it verbally.
2. **Plan the Slides** — Break the content into individual slides. For each slide, confirm with the user:
   - What content goes on it
   - How it should be rendered (title slide, text, code, list, image, comparison, etc.)
   - Background or visual style
   - Transitions (if they want something special)
3. **Confirm Slide-by-Slide** — Present each planned slide to the user and get their OK before generating the full deck. Keep this conversational — ask "How does this look?" not "Confirm parameters."
4. **Ask for Output Location** — Ask where to save the final `index.html`.
   - If the user provided a content file or folder as input, suggest a location close to that input (e.g., same directory).
   - If no input files, ask them where they'd like it saved.
5. **Set up the project** — Create the output directory with the template and build script.
6. **Generate slides one-by-one** — For each slide, create a small HTML snippet file using `write_file`. Each file only contains the `<section>...</section>` content.
7. **Run the build script** — After all slides are written, run the Python build script to assemble the final `index.html`.
8. **Suggest opening in Aynite** — Tell the user the exact path to `index.html` and suggest they open it in Aynite's file browser. Do NOT run `npx serve` or any local server.

---

## Why This Two-Phase Approach

Writing a full `index.html` with many slides in a single `write_file` call can exceed tool limits when the content is large. Instead:

- **Phase 1**: A small **template file** is written once (the reveal.js skeleton with a placeholder).
- **Phase 2**: Each slide is written as a **separate small snippet file** — one `write_file` call per slide.
- **Phase 3**: A **build script** (provided in the skill) reads all snippet files and assembles the final HTML.

This means each tool call is small and focused. It also lets you preview intermediate results and regenerate individual slides without touching the rest.

---

## CRITICAL: Making Slides Fit the 16:9 Frame

Each slide must fit entirely within a 16:9 viewport (1920×1080 virtual canvas). Reveal.js scales everything proportionally, but **if a slide's content is too tall, it will overflow and be cropped**.

Two mechanisms work together to ensure this:

### 1. Reveal.js Config — `width: 1920, height: 1080`

The `Reveal.initialize()` call must set `width: 1920, height: 1080`. This tells reveal.js to use a 1920×1080 virtual canvas — it will automatically scale the entire deck to fit the actual viewport. Content is measured against this 1920×1080 coordinate system.

**Without this config**: Content uses the browser window's native dimensions (can be any aspect ratio).
**With this config**: Content is always mapped to 16:9, and reveal.js handles the scaling.

### 2. Content Compactness Rules

You MUST follow these rules when designing each slide. A slide that violates these rules will overflow the 16:9 frame.

#### Font Size Rules (for 1920×1080 canvas)
| Element | Font Size | Notes |
|---------|-----------|-------|
| Slide title (`h1`) | `1.8em` max | Only for title slides |
| Section title (`h2`) | `1.4em` max | Regular slide headers |
| Sub-header (`h3`) | `1.0em` max | Card titles, column headers |
| Body text (`p`, `li`) | `0.6em` — `0.75em` | Keep it compact |

These are max values — use smaller sizes when you have more content.

#### Maximum Content Per Slide

**Text/bullet slides**: Max **5-6 lines** of body content total.
- Title (h2) + 4-5 bullet points (each ≤ 1 line) = good
- Title (h2) + 7 bullet points = too tall, overflow!

**Two-column slides**: Max **4 lines per column**.
- Each column: heading + 2-3 bullet points or 1-2 short paragraphs
- If you need more content, split into multiple slides

**Cards/grid slides**: Max **2 rows of cards** (e.g., 2×2 or 2×3 grid).
- A 2×3 grid of 6 cards = good (2 rows)
- A 4×2 grid of 8 cards = too tall, overflow!

**Table slides**: Max **5-6 data rows** (not counting header row).
- With 5-6 rows the table is readable
- With 10+ rows text becomes too small or the table overflows

**Code slides**: Max **8-10 lines** of code.
- Use `data-line-numbers` to focus attention on specific lines
- If code is longer, show only the essential snippet

**Image slides**: Images should not exceed ~70% of the slide height.
- Full-bleed background images are fine (they fill the background)
- An image with a text caption below it: image takes ~60% height, text takes ~10%

#### General Principles

1. **When in doubt, split it out** — If a slide feels crowded, split it into two slides. The user can always merge them later.
2. **One idea per slide** — Don't cram "File Browser" AND "Three Viewing Modes" AND "File Types" all on one slide. That's 3 slides.
3. **Use fragments** — Instead of showing all content at once, use `class="fragment"` to reveal items step by step. This lets you fit more items without visual crowding.
4. **Shorter text = better slides** — Bullet points should be 5-10 words each, not full paragraphs.
5. **Vertical groups for depth** — If a slide has too much detail, use nested sections (vertical slides) so the user can press Down arrow to see more.
6. **No scrollbars** — If you need a scrollbar, the slide content is too tall. Split it.

#### Flow Check: "Will this fit?"

Before writing any slide, mentally check:
- Title (h2): ~1 line
- Subtitle/description: ~1 line
- Content: ~4-6 lines total (bullets, cards, table rows, code lines)
- Total: ~6-8 lines from top of slide content area

If the content is pushing past 8 lines in the content area, the slide is too tall. Split it.

---

## Step-by-Step Instructions

### Step 1: Create the Output Directory

Create the output directory alongside the template and script:

```
mkdir -p <output-dir>/slides
```

### Step 2: Write the Template

Write `slides-template.html` to the output directory. This is the reveal.js skeleton — it stays small and is written once.

The template contains the full HTML structure with `<!-- SLIDES_PLACEHOLDER -->` where individual slides will be injected.

Use the latest reveal.js version from CDN. Always check the actual latest version at the time of generation — do not hardcode a version number.

**IMPORTANT — 16:9 Frame**: The reveal.js deck is wrapped in a centered 16:9 aspect-ratio frame. The `Reveal.initialize()` config uses `width: 1920, height: 1080` to tell reveal.js that content is designed for a 16:9 canvas, so it scales everything to fit.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>__TITLE__</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/reset.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/reveal.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/theme/__THEME__.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/plugin/highlight/monokai.min.css">
  <style>
    /* ── 16:9 Frame Wrapper ── */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }

    #slides-wrapper {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }

    #slides-frame {
      position: relative;
      width: min(100vw, 177.78vh);
      height: min(100vh, 56.25vw);
      overflow: hidden;
    }

    #slides-frame .reveal {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    /* ── Your custom styles go here ── */

    /* Compact typography defaults for 16:9 slides */
    .reveal h1 { font-size: 1.8em; }
    .reveal h2 { font-size: 1.4em; margin-bottom: 0.4em; }
    .reveal h3 { font-size: 1.0em; }
    .reveal p { font-size: 0.7em; line-height: 1.5; }
    .reveal li { font-size: 0.7em; line-height: 1.6; }
    .reveal table { font-size: 0.6em; }
    .reveal pre code { font-size: 0.6em; max-height: 400px; }

    /* ── Fullscreen Button ── */
    #fullscreen-btn {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1000;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.6);
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: background 0.2s, color 0.2s, opacity 0.3s;
      opacity: 0.3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #fullscreen-btn:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
      opacity: 1;
    }
    #fullscreen-btn .icon { font-size: 16px; }
  </style>
</head>
<body>
  <button id="fullscreen-btn" onclick="toggleFullscreen()" title="Presentation mode (fullscreen)">
    <span class="icon">⛶</span> <span id="fs-label">Present</span>
  </button>
  <div id="slides-wrapper">
    <div id="slides-frame">
      <div class="reveal">
        <div class="slides">
<!-- SLIDES_PLACEHOLDER -->
        </div>
      </div>
    </div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/reveal.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/plugin/notes/notes.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/plugin/markdown/markdown.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/plugin/highlight/highlight.js"></script>
  <script>
    function toggleFullscreen() {
      const el = document.getElementById('slides-wrapper');
      const label = document.getElementById('fs-label');
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
        label.textContent = 'Exit';
      } else {
        document.exitFullscreen().catch(() => {});
        label.textContent = 'Present';
      }
    }

    document.addEventListener('fullscreenchange', () => {
      const label = document.getElementById('fs-label');
      if (label) label.textContent = document.fullscreenElement ? 'Exit' : 'Present';
    });

    Reveal.initialize({
      hash: true,
      center: true,
      width: 1920,
      height: 1080,
      transition: '__TRANSITION__',
      plugins: [ RevealMarkdown, RevealHighlight, RevealNotes ]
    });
  </script>
</body>
</html>
```

> **Important**: Determine the actual latest reveal.js version from CDN at generation time. Replace `__VERSION__`, `__TITLE__`, `__THEME__`, `__TRANSITION__` with real values in the template.

### Step 3: Write the Build Script

Write `scripts/build-slides.py` to the output directory. This script reads the template and all slides, then produces `index.html`.

```python
"""Build reveal.js slide deck from template and individual slide snippets."""

import os
import sys
import re

def build_slides(template_path, slides_dir, output_path):
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()
    
    slide_files = sorted(
        [f for f in os.listdir(slides_dir) if f.endswith('.html')],
        key=lambda x: int(re.search(r'(\d+)', x).group(1)) if re.search(r'(\d+)', x) else 0
    )
    
    slides_html = []
    for sf in slide_files:
        with open(os.path.join(slides_dir, sf), 'r', encoding='utf-8') as f:
            slides_html.append(f.read())
    
    result = template.replace('<!-- SLIDES_PLACEHOLDER -->', '\n'.join(slides_html), 1)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(result)
    
    print(f"✅ Built {output_path} from {len(slide_files)} slides")

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python scripts/build-slides.py <template> <slides-dir> <output>")
        sys.exit(1)
    build_slides(sys.argv[1], sys.argv[2], sys.argv[3])
```

### Step 4: Generate Slides One-by-One

For each slide, create a numbered file in the `slides/` subdirectory:

```
<output-dir>/slides/001-title.html
<output-dir>/slides/002-intro.html
<output-dir>/slides/003-key-points.html
...
```

Each file contains ONLY the `<section>...</section>` content. No doctype, no head, no body — just the slide HTML.

**Reminder**: Before writing each slide file, do the "flow check" from the content rules above. If the content is too tall, split it into multiple slides.

### Step 5: Run the Build Script

After all slide files are written, run:

```bash
python3 <output-dir>/scripts/build-slides.py <output-dir>/slides-template.html <output-dir>/slides/ <output-dir>/index.html
```

### Step 6: Iterate

If the user wants changes to a specific slide:
1. Edit the individual slide file in `slides/` (small, focused edit)
2. Re-run the build script
3. No need to regenerate the template or other slides

---

## Available reveal.js Styles

You can offer these to the user as options for the overall look and feel of the deck.

### Official Themes
| Theme | Vibe | Best For |
|-------|------|----------|
| **black** (default) | Dark background, light text | Tech talks, modern presentations |
| **white** | Light background, dark text | Clean, professional decks |
| **league** | Dark with subtle gradient | Conference talks |
| **beige** | Warm beige background | Casual presentations |
| **night** | Very dark, high contrast | Data-heavy, dramatic |
| **serif** | Serif font, elegant | Academic, formal |
| **simple** | Minimal, clean | Anything |
| **solarized** | Warm, easy on eyes | Long presentations, reading |
| **moon** | Dark blue/purple | Creative, artistic |
| **dracula** | Dark purple theme | Developer presentations |
| **sky** | Light blue sky | Light, airy decks |
| **blood** | Dark red | Intense, passionate topics |

### Available Transitions (per-slide or global)
`none` | `fade` | `slide` | `convex` | `concave` | `zoom`

### Background Types Per Slide
- **Color** — Any CSS color (`#ff0000`, `rgb(...)`, `aquamarine`)
- **Gradient** — CSS gradient (`linear-gradient(to bottom, #283b95, #17b2c3)`)
- **Image** — URL to an image
- **Video** — URL to a video file
- **Iframe** — URL to embed a web page
- **None** — Just inherit the theme background

---

## Slide Layout Types

When planning each slide with the user, offer one of these layouts:

| Layout | What It Shows | Best For |
|--------|--------------|----------|
| **title** | Large centered title + subtitle | Opening slides, section headers |
| **text** | Title + body text | General content |
| **bullets** | Title + bullet list | Key points, agendas, summaries |
| **numbered** | Title + numbered list | Steps, ordered processes |
| **two-column** | Two side-by-side content blocks | Comparisons, pros/cons |
| **code** | Title + syntax-highlighted code block | Code examples, demos |
| **image** | Full-bleed or sized image | Visuals, screenshots, diagrams |
| **image-text** | Image + text side by side | Explaining visuals |
| **quote** | Large centered quote + attribution | Pull quotes, testimonials |
| **table** | Title + data table | Data comparison, specs |
| **cards** | Grid of card elements | Feature showcases, team |
| **blank** | Custom HTML content | Anything unique |
| **vertical-group** | Wrapper for vertical sub-slides | Detailed breakdowns |
| **full-bleed** | Image/video as full background with overlay text | Impact slides |

---

## How to Build Each Layout (16:9 Compact Versions)

All examples below are designed to fit within the 16:9 frame. Follow these patterns exactly — sizes, spacing, and content density are tuned to 1920×1080.

### Title slide
```html
<section>
  <h1 style="font-size: 1.8em;">The Title</h1>
  <p style="opacity: 0.6;">Subtitle or tagline</p>
</section>
```

### Text slide (max ~5 lines of body)
```html
<section>
  <h2>Section Title</h2>
  <p style="font-size: 0.7em;">A short paragraph. Keep it to 2-3 sentences max.</p>
  <p style="font-size: 0.7em;">Another short paragraph if needed.</p>
</section>
```

### Bullet list (max 5 items)
```html
<section>
  <h2>Key Points</h2>
  <ul style="font-size: 0.7em;">
    <li class="fragment">First point — keep each under 10 words</li>
    <li class="fragment">Second point</li>
    <li class="fragment">Third point</li>
    <li class="fragment">Fourth point</li>
    <li class="fragment">Fifth point</li>
  </ul>
</section>
```

### Two-column (max 4 bullets per side)
```html
<section>
  <h2>Comparison</h2>
  <div style="display: flex; gap: 2rem; font-size: 0.7em;">
    <div style="flex: 1;">
      <h3 style="font-size: 0.9em;">Left Column</h3>
      <ul>
        <li class="fragment">Item 1</li>
        <li class="fragment">Item 2</li>
        <li class="fragment">Item 3</li>
      </ul>
    </div>
    <div style="flex: 1;">
      <h3 style="font-size: 0.9em;">Right Column</h3>
      <ul>
        <li class="fragment">Item A</li>
        <li class="fragment">Item B</li>
        <li class="fragment">Item C</li>
      </ul>
    </div>
  </div>
</section>
```

### Code (max 10 lines)
```html
<section>
  <h2>Code Demo</h2>
  <pre style="font-size: 0.6em;"><code data-line-numbers="1-3">
function greet(name) {
  return `Hello, ${name}!`;
}
  </code></pre>
</section>
```

### Quote
```html
<section>
  <blockquote style="font-size: 1.0em; font-style: italic;">
    &ldquo;The best way to predict the future is to invent it.&rdquo;
    <br><small style="opacity: 0.6; font-size: 0.6em;">— Alan Kay</small>
  </blockquote>
</section>
```

### Cards grid (max 2 rows, e.g. 3×2 or 2×2)
```html
<section>
  <h2>Features</h2>
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.8rem; font-size: 0.65em;">
    <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.8rem;">
      <h3 style="font-size: 0.9em; margin: 0 0 0.2em 0;">Feature A</h3>
      <p style="margin: 0; opacity: 0.7;">Short description</p>
    </div>
    <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.8rem;">
      <h3 style="font-size: 0.9em; margin: 0 0 0.2em 0;">Feature B</h3>
      <p style="margin: 0; opacity: 0.7;">Short description</p>
    </div>
    <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.8rem;">
      <h3 style="font-size: 0.9em; margin: 0 0 0.2em 0;">Feature C</h3>
      <p style="margin: 0; opacity: 0.7;">Short description</p>
    </div>
    <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.8rem;">
      <h3 style="font-size: 0.9em; margin: 0 0 0.2em 0;">Feature D</h3>
      <p style="margin: 0; opacity: 0.7;">Short description</p>
    </div>
    <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.8rem;">
      <h3 style="font-size: 0.9em; margin: 0 0 0.2em 0;">Feature E</h3>
      <p style="margin: 0; opacity: 0.7;">Short description</p>
    </div>
    <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.8rem;">
      <h3 style="font-size: 0.9em; margin: 0 0 0.2em 0;">Feature F</h3>
      <p style="margin: 0; opacity: 0.7;">Short description</p>
    </div>
  </div>
</section>
```

### Table (max 6 data rows)
```html
<section>
  <h2>Data Table</h2>
  <table style="font-size: 0.6em;">
    <thead>
      <tr><th>Item</th><th>Value</th><th>Qty</th></tr>
    </thead>
    <tbody>
      <tr><td>Apples</td><td>$1</td><td>7</td></tr>
      <tr><td>Bananas</td><td>$2</td><td>18</td></tr>
      <tr><td>Cherries</td><td>$3</td><td>5</td></tr>
      <tr><td>Dates</td><td>$4</td><td>3</td></tr>
      <tr><td>Elderberries</td><td>$5</td><td>2</td></tr>
    </tbody>
  </table>
</section>
```

### Full-bleed with overlay
```html
<section data-background-image="https://example.com/photo.jpg" data-background-size="cover">
  <div style="background: rgba(0,0,0,0.5); padding: 1.5rem 2rem; border-radius: 8px; display: inline-block;">
    <h2 style="font-size: 1.4em; margin: 0;">Title on Image</h2>
    <p style="font-size: 0.7em; margin: 0.3em 0 0 0;">Text overlay</p>
  </div>
</section>
```

### Vertical slide group
```html
<section>
  <section>
    <h2>Overview</h2>
  </section>
  <section>
    <h2>Detail 1</h2>
  </section>
  <section>
    <h2>Detail 2</h2>
  </section>
</section>
```

---

## Interactive Confirmation Pattern

When confirming with the user, use this conversational flow. Don't be robotic — adapt this to the user's style.

```
You: I'll break this into [N] slides. Here's my plan:

1. Title Slide — "My Presentation"
2. Section: Background — What is this about?
3. Key Points — Bullet list of 3 main ideas
4. Code Demo — The main code snippet
5. Summary — Closing thoughts

For slide 1, I'm thinking a big centered title with a gradient background. For slide 4, I'll use syntax-highlighted code with line numbers. Does this structure look right? Any slide you want to change, combine, or split?
```

After they approve, ask:
```
Where would you like me to save the slides? Since you mentioned [input file/folder], I'll create the project next to it in [same directory]. Or would you prefer a different location?
```

---

## reveal.js Tips for Better Slides

1. **Keep it simple** — One main idea per slide. If you have 3 ideas, use 3 slides.
2. **Use fragments** — `class="fragment"` reveals content step by step, keeping the slide uncluttered.
3. **Backgrounds = section breaks** — A colored/gradient background signals a new section.
4. **Font choices** — Import Google Fonts for custom typography (Outfit, Inter, etc.).
5. **Auto-animate** — Use `data-auto-animate` for smooth transitions between related slides.
6. **Speaker notes** — Add `<aside class="notes">` for presenters.
7. **Export to PDF** — Add `?print-pdf` to the URL for printing. The 1920×1080 config makes PDF export look perfect.
8. **Think in 16:9** — Your canvas is always 1920×1080. Design with that constraint.

---

## Output Location Rules

- **If user provided input files/folders**: Suggest creating the slide project in the same directory as the input, in a `slides/` subfolder.
- **If no input**: Ask the user where they want it saved. Default to their current workspace directory.
- Always confirm the exact path with the user before writing files.

### Generated Project Structure

```
<output-dir>/
├── slides-template.html      # The reveal.js skeleton (written once)
├── scripts/
│   └── build-slides.py       # Build script (written once)
├── slides/
│   ├── 001-title.html        # Individual slide snippet
│   ├── 002-intro.html
│   ├── 003-key-points.html
│   └── ...
└── index.html                # Final output (generated by build script)
```

Only `index.html` is the final deliverable. The rest are intermediate build artifacts.

## After Creation

1. Tell the user the full path to the saved `index.html`.
2. Suggest they open the HTML file in Aynite's file browser — they can navigate to it and click to view the slides directly. Aynite's HTML file view renders reveal.js presentations perfectly.
3. Optionally mention they can also double-click the file to open it in a regular browser if they prefer.
