# Aynite

<div align="center">

**Your AI desktop that connects everything.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--beta.15-blue)](https://github.com/w-t-yang/aynite/releases)
[![Electron](https://img.shields.io/badge/Electron-42.x-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## Philosophy

Most apps bundle three things together: your data, their processing, and their interface. **Aynite unbundles them.**

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

- **Your data stays yours.** Local files, your folders, your choice. Aynite looks into whatever folder you point it at — it doesn't lock your data in.
- **Process it your way.** AI agents, Python scripts, shell commands, whatever tool fits the task. The AI era makes this trivially easy.
- **Render it in any view.** Built-in charts, graphs, mindmaps, diagrams, canvases, RSS reader, Spotify player. Plus 6 file viewers (PDF, image, audio, video, HTML, markdown). More are on the way and you can build your own at anytime — a view is just a component that reads a file and renders it.

**Switch tools without switching data. Switch views without switching storage. Aynite is the hub that connects them all.**

→ **[Read the full philosophy →](docs/PHILOSOPHY.md)**

---

## Features

| Area | What You Can Do |
|------|----------------|
| 🤖 **AI Chat** | Multi-provider chat (OpenAI, Anthropic, Google, DeepSeek, Ollama), tool execution, command streaming, session history |
| 📂 **File Browser** | Tabs, syntax highlighting, search with match navigation, git diff integration |
| 🎨 **Data Views** | 8 built-in visualizations — charts, stock candlestick, graphs, flow diagrams, Mermaid diagrams, mind maps, infinite canvas, color themes |
| 🖼️ **File Views** | 6 built-in file renderers — PDF, image, audio, video, HTML, markdown. Bring your own fileview for any file type |
| 🔧 **Extensible** | Create your own skills (`/create-skill`), commands (`> command-name`), themes (`/create-theme`), and views |
| 🔄 **Git Integration** | File status, side-by-side diff, hunk staging/discard, AI-powered commit message generation |
| 📡 **RSS** | Built-in RSS reader with groups, bookmarks, and AI article summarization |
| 🎵 **Spotify** | Built-in Spotify player — browse, search, control playback |
| 🪟 **Tiled Layout** | Split tiles vertically/horizontally, multiple workspaces, multi-window support |
| 🎭 **Themes** | Fully customizable with 32 CSS variables, create your own with `/create-theme` |

> 💡 **See how it works:** RSS, Spotify, and the 8 data views + 6 file views are all built into Aynite to show you what's possible. They're not "integrations" you need to install — they're templates for how YOU can build and share your own views, file renderers, and third-party connections. Every built-in view is also a reference implementation. [Learn how →](docs/guides/EXTENDING_AYNITE.md)

---

## Quick Start

### 1. Download

[Download the latest release](https://github.com/w-t-yang/aynite/releases) for macOS (Apple Silicon).

> 🚧 **Windows and Linux builds are in progress.** The app is built for all three platforms — see the [build instructions](docs/DEVELOPER.md#building) if you want to build from source.

### 2. Set Up Your AI Provider

Open **Settings → AI**, add your API key, and pick a model. Aynite supports all major providers through the Vercel AI SDK.

### 3. Try Your First Chat

Open the AI chat and type:

```
/create-theme make a pinky cute theme, light mode
```

The AI will generate a custom theme. Go find it in **Settings → Appearance**.

Here is mine, how does yours look like?

![Pinky theme screenshot](docs/images/pinky-theme.png)

### 4. Explore More

- **`Ctrl+Tab`** — Fuzzy-find and switch files
- **`Ctrl+R`** — Refresh the active tile (for new skills, themes, or config)
- **`>` command** — Run a deterministic command (try `> echo "Hello from Aynite!"`)

→ **[Full getting started guide →](docs/GETTING_STARTED.md)**

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Philosophy](docs/PHILOSOPHY.md) | The Decoupled Data Stack — Aynite's core beliefs |
| [Getting Started](docs/GETTING_STARTED.md) | From zero to your first theme |
| [Working with Files](docs/guides/WORKING_WITH_FILES.md) | File browser, tabs, search, modes |
| [AI Chat & Agents](docs/guides/AI_CHAT_AND_AGENTS.md) | Conversations, providers, sessions, skills |
| [Git Integration](docs/guides/GIT_INTEGRATION.md) | Status, diff, staging, commit |
| [Data Visualization](docs/guides/DATA_VISUALIZATION.md) | 8 dataviews, transform-to-dataview skill |
| [Customization](docs/guides/CUSTOMIZATION.md) | Themes, keybindings, settings |
| [Extending Aynite](docs/guides/EXTENDING_AYNITE.md) | Skills, commands, spells, dataviews |
| [Workspaces & Layout](docs/guides/WORKSPACES_AND_LAYOUT.md) | Multi-workspace, tiles, multi-window |
| [Integrations](docs/guides/INTEGRATIONS.md) | RSS, Spotify |
| [Developer Guide](docs/DEVELOPER.md) | Architecture, building, testing, contributing |

---

## Built With

- **[Electron](https://www.electronjs.org/)** — Desktop application framework
- **[Vercel AI SDK](https://sdk.vercel.ai/)** — Unified AI provider interface
- **[React](https://react.dev/)** — UI components
- **[Vite](https://vitejs.dev/)** — Build tooling
- **[Tailwind CSS](https://tailwindcss.com/)** — Styling
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety

---

## Project Status

Aynite is in active development (beta). The app ships regularly, has a growing set of integrations, and a clear architectural vision. Some features are still rough around the edges — that's intentional. Every release gets closer to the goal.

**[View releases →](https://github.com/w-t-yang/aynite/releases)**

---

## License

[MIT](LICENSE) © Wentao Yang
