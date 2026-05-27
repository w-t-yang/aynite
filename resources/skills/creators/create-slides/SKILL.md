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
    /* Custom styles go here */
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
<!-- SLIDES_PLACEHOLDER -->
    </div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/reveal.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/plugin/notes/notes.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/plugin/markdown/markdown.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/__VERSION__/plugin/highlight/highlight.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      center: true,
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
    # Read template
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()
    
    # Read all slide snippets in order
    slide_files = sorted(
        [f for f in os.listdir(slides_dir) if f.endswith('.html')],
        key=lambda x: int(re.search(r'(\d+)', x).group(1)) if re.search(r'(\d+)', x) else 0
    )
    
    slides_html = []
    for sf in slide_files:
        with open(os.path.join(slides_dir, sf), 'r', encoding='utf-8') as f:
            slides_html.append(f.read())
    
    # Assemble
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

Each file contains ONLY the `<section>...</section>` content (the portion that goes between `<!-- SLIDES_PLACEHOLDER -->` and `<!-- END_SLIDES_PLACEHOLDER -->`). No doctype, no head, no body — just the slide HTML.

**Example — `slides/001-title.html`:**
```html
<section>
  <h1>My Presentation</h1>
  <p>A subtitle here</p>
</section>
```

**Example — `slides/002-intro.html`:**
```html
<section data-auto-animate>
  <h2 data-id="title">Introduction</h2>
  <p>Welcome to this presentation.</p>
</section>
```

**Example — `slides/003-code.html`:**
```html
<section>
  <h2>Code Example</h2>
  <pre><code data-line-numbers>
function hello() {
  console.log("Hello!");
}
  </code></pre>
</section>
```

**Example — vertical group (nested slides in one file):**
```html
<section>
  <section>
    <h2>Top Level</h2>
  </section>
  <section>
    <h2>Detail A</h2>
  </section>
  <section>
    <h2>Detail B</h2>
  </section>
</section>
```

**IMPORTANT RULES for generating slides:**
- Each slide file must contain valid HTML
- Each file represents ONE section element (or one vertical group with nested sections)
- Number files sequentially: `001-slide-name.html`, `002-slide-name.html`, etc.
- Use descriptive names so you can easily identify which file to regenerate if the user wants a change

### Step 5: Run the Build Script

After all slide files are written, run:

```bash
python3 <output-dir>/scripts/build-slides.py <output-dir>/slides-template.html <output-dir>/slides/ <output-dir>/index.html
```

This produces the final `index.html`.

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

## How to Build Each Layout

### Title slide
```html
<section>
  <h1>The Title</h1>
  <p style="opacity: 0.6;">Subtitle or tagline</p>
</section>
```

### Text slide
```html
<section>
  <h2>Section Title</h2>
  <p>Your paragraph of text here.</p>
  <p>Another paragraph if needed.</p>
</section>
```

### Bullet list
```html
<section>
  <h2>Key Points</h2>
  <ul>
    <li class="fragment">First point</li>
    <li class="fragment">Second point</li>
    <li class="fragment">Third point</li>
  </ul>
</section>
```

### Two-column layout
```html
<section>
  <h2>Comparison</h2>
  <div style="display: flex; gap: 2rem;">
    <div style="flex: 1;">
      <h3>Left</h3>
      <p>Left content</p>
    </div>
    <div style="flex: 1;">
      <h3>Right</h3>
      <p>Right content</p>
    </div>
  </div>
</section>
```

### Code
```html
<section>
  <h2>Code Demo</h2>
  <pre><code data-line-numbers="1-3|5">
function greet(name) {
  return `Hello, ${name}!`;
}
  </code></pre>
</section>
```

### Quote
```html
<section>
  <blockquote style="font-size: 1.5em; font-style: italic;">
    &ldquo;The best way to predict the future is to invent it.&rdquo;
    <br><small style="opacity: 0.6;">— Alan Kay</small>
  </blockquote>
</section>
```

### Cards
```html
<section>
  <h2>Features</h2>
  <div style="display: flex; gap: 1rem;">
    <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem;">
      <h3>Feature A</h3>
      <p>Description</p>
    </div>
    <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem;">
      <h3>Feature B</h3>
      <p>Description</p>
    </div>
    <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem;">
      <h3>Feature C</h3>
      <p>Description</p>
    </div>
  </div>
</section>
```

### Table
```html
<section>
  <h2>Data Table</h2>
  <table>
    <thead>
      <tr><th>Item</th><th>Value</th><th>Qty</th></tr>
    </thead>
    <tbody>
      <tr><td>Apples</td><td>$1</td><td>7</td></tr>
      <tr><td>Bananas</td><td>$2</td><td>18</td></tr>
    </tbody>
  </table>
</section>
```

### Full-bleed with overlay
```html
<section data-background-image="https://example.com/photo.jpg" data-background-size="cover">
  <div style="background: rgba(0,0,0,0.6); padding: 2rem; border-radius: 12px;">
    <h2>Title on Image</h2>
    <p>Text overlay</p>
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

1. **Keep it simple** — Don't overcrowd slides. One main idea per slide.
2. **Use fragments** — Reveal content step-by-step to keep audience focused.
3. **Backgrounds matter** — A colored/gradient background section break helps structure.
4. **Font choices** — Import Google Fonts for custom typography (Outfit, Inter, etc. pair well).
5. **Auto-animate** — Great for showing transformations or state changes between slides.
6. **Speaker notes** — Add notes with `<aside class="notes">` for presenters.
7. **Export to PDF** — Add `?print-pdf` to the URL for printing.
8. **Use `data-background-iframe`** — Embed live web pages/demos behind content.

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

Only `index.html` is the final deliverable. The rest are intermediate build artifacts that enable the modular workflow. Keep them so you can regenerate if the user wants changes.

## After Creation

1. Tell the user the full path to the saved `index.html`.
2. Suggest they open the HTML file in Aynite's file browser — they can navigate to it and click to view the slides directly. Aynite's HTML file view renders reveal.js presentations perfectly.
3. Optionally mention they can also double-click the file to open it in a regular browser if they prefer.
