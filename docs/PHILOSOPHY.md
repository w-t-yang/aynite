# The Decoupled Data Stack

**Most apps bundle three things together: your data, their processing, and their interface. Aynite unbundles them.**

```
┌──────────────────────────────────────────────────┐
│                                                  │
│    STORAGE        PROCESSING        RENDERING    │
│                                                  │
│   ┌────────┐    ┌──────────┐    ┌────────────┐   │
│   │ Your   │    │   AI     │    │  Charts    │   │
│   │ Files  │ ──▶│ Agents   │ ──▶│  Graphs    │   │
│   │        │    │ Scripts  │    │  Mindmaps  │   │
│   │ RSS    │    │Commands  │    │  Diagrams  │   │
│   │Spotify │    │ Any tool │    │  Canvases  │   │
│   └────────┘    └──────────┘    └────────────┘   │
│        │              │                │         │
│        └──────────────┴────────────────┘         │
│                       ▲                          │
│                       │                          │
│            Aynite connects them all              │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Three layers. Fully decoupled. You own every layer.**

This isn't an academic idea — it's a practical one. The AI era makes it trivially easy to process data in ways that once required custom software. But if your data is locked inside a monolithic app, you can't take advantage of that. Decoupling is what makes the AI era truly useful.

---

## Storage — Your Data, Your Choice

**Aynite can look into any folder you point it at. It doesn't dictate where your data lives.**

A local folder. A network drive. A cloud API. A database. The location is yours to decide.

This means:
- **RSS articles** are cached locally under `~/.aynite/rss/` — you own the content, not the feed provider
- **Spotify playlists** and saved tracks are synced to `~/.aynite/spotify/` — your music library is yours
- **AI chat sessions** are saved as plain JSON files — portable, inspectable, never locked in
- **Workspace configs**, themes, keybindings — all plain files on disk

Store them wherever makes sense for you. Aynite follows.

> **The key insight:** When your data is in a standard format in a location you control, you can use ANY tool to process it. You're not dependent on what the app vendor provides.

---

## Processing — Any Tool Fits

**What you do with data should be tool-agnostic.**

Analyze with AI. Summarize with agents. Transform with scripts. Run a Python program, a shell command, a Node.js script — any tool that fits the task.

Aynite gives you:
- **AI agents** — Multi-provider chat (OpenAI, Anthropic, Google, DeepSeek, Ollama) with tool access to read, write, analyze, and transform data
- **Commands** (`>` prefix) — Deterministic shell scripts for precise, repeatable operations
- **Skills** (`/` prefix) — AI-guided workflows that teach the agent how to handle specialized tasks

But you're not limited to what's built in. Write your own scripts. Use your own models. Wire up your own pipeline. Aynite is the hub, not the gatekeeper.

> **The key insight:** In the AI era, processing power is abundant and cheap. The bottleneck isn't what you can process — it's whether you can GET to your data. Decoupled storage solves that.

---

## Rendering — Build Once, Share Forever

**How you see data should be reusable and composable.**

Aynite's built-in views are a starting point, not a ceiling:

- **8 DataViews** — Chart, stock, graph, flow, diagram, mindmap, canvas, theme. Each loads a JSON file and renders it through a well-defined schema.
- **6 FileViews** — Audio, HTML, image, markdown, PDF, video. Type-based renderers for common file formats.
- **Functional Views** — AI chat, file browser, RSS reader, Spotify player, settings, tree view, workspace view.

The [`transform-to-dataview`](../resources/skills/transformers/transform-to-dataview/SKILL.md) skill is the bridge: it takes raw data from any source and transforms it into the format expected by any dataview. Storage and rendering are fully decoupled — the same chart view can render data from a CSV, a database export, or an API response.

**Build a view once, share it, let others use it with their own data.** The rendering layer is where Aynite's community can contribute most.

---

## Why This Matters Now

The AI era makes scaling trivially easy. Processing that once required custom software — data transformation, analysis, summarization, pattern detection — can now be done with a prompt.

When storage, processing, and rendering are decoupled, each layer can scale independently:

- **Query more data** without changing your processing pipeline
- **Use smarter models** without migrating your data
- **Render in richer views** without rebuilding your storage

But if these layers are bundled together, you can't take advantage of this. You're stuck with whatever processing your monolithic app provides, rendering in whatever views it ships.

**Switch tools without switching data. Switch views without switching storage.**

---

## What Aynite Is

**Aynite is the hub that connects these layers.**

It's not an IDE, not a note-taking app, not a browser — it's an **AI-native workspace** that gives AI agents direct access to files, git, media feeds, and data visualizations through a tiled window manager.

Think of it as an operating system for your AI agent. The editor is the interface to everything — AI, scripts, APIs, automations, your entire digital toolchain. No context-switching. No copy-pasting. No waiting for someone else to "add an integration."

**All You Need Is The Editor.**
