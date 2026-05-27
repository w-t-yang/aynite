# Aynite

<div align="center">

**An AI-native workspace. An operating system for your AI agent.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--beta.15-blue)](https://github.com/w-t-yang/aynite/releases)
[![Electron](https://img.shields.io/badge/Electron-42.x-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## Philosophy

Aynite believes **storage, processing, and rendering should be independent layers.**

**Storage** — Your data belongs where you choose. Aynite can look into any folder you point it at — it doesn't dictate where your data lives.

**Processing** — What you do with data should be tool-agnostic. Analyze with AI, summarize with agents, transform with scripts — whichever tool fits the task.

**Rendering** — How you see data should be reusable and composable. Aynite's built-in views are a starting point, not a ceiling. Build a view once, share it, let others use it with their own data.

When these layers are decoupled, each can scale independently. The AI era makes scaling trivially easy — processing that once required custom software can now be done with a prompt. Aynite is the hub that connects these layers.

→ **[Read the full philosophy →](docs/PHILOSOPHY.md)**

---

## Features

| Area | What You Can Do |
|------|----------------|
| 🤖 **AI Chat** | Multi-provider chat (OpenAI, Anthropic, Google, DeepSeek, Ollama, and more), tool execution, command streaming, session history |
| 📂 **File Browser** | Tabs, syntax highlighting, search with match navigation, git diff integration, markdown preview |
| 🎨 **Data Visualization** | 8 built-in views — charts, stock candlestick, graphs, flow diagrams, Mermaid diagrams, mind maps, infinite canvas, color themes |
| 🔧 **Extensible** | Create your own skills (`/create-skill`), commands (`> command-name`), themes (`/create-theme`), and even views |
| 🔄 **Git Integration** | File status, side-by-side diff, hunk staging/discard, AI-powered commit message generation |
| 📡 **RSS Reader** | Feed management, groups, bookmarks, article summarization with AI |
| 🎵 **Spotify** | Browse, search, playback control, playlist management |
| 🪟 **Tiled Layout** | Split tiles vertically/horizontally, multiple workspaces, multi-window support |
| ⌨️ **Keyboard-First** | Keyboard shortcuts for everything — file switching, chat, navigation |
| 🎭 **Themes** | Fully customizable with 32 CSS variables, create your own with `/create-theme` |

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
/create-theme make me a cozy autumn sunset theme
```

The AI will generate a custom theme. Press **`Ctrl+R`** to refresh the tile, then go find it in **Settings → Appearance**.

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
