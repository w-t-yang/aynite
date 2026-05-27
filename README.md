# Aynite

<div align="center">

**Your AI desktop that connects everything.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--beta.15-blue)](https://github.com/w-t-yang/aynite/releases)
[![Electron](https://img.shields.io/badge/Electron-42.x-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## Showcase

<div align="center">

### AI Chat · Git Diff · Data Visualization · File Browser · RSS · Spotify

All in one desktop app. Your AI agent, your files, your tools.

</div>

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/ai-chat.png" alt="AI Chat with tool calls and command output streaming" width="100%">
      <br>
      <sub>🤖 AI Chat — multi-provider, tool execution, real-time command streaming</sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/data-views.png" alt="Data visualization views: charts, graphs, mindmaps" width="100%">
      <br>
      <sub>🎨 Data Views — 8 visualization types from any JSON data</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/git-diff.png" alt="Side-by-side git diff view with hunk staging" width="100%">
      <br>
      <sub>🔄 Git Integration — side-by-side diff, hunk staging, AI commit messages</sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/file-browser.png" alt="File browser with tabs, search, and syntax highlighting" width="100%">
      <br>
      <sub>📂 File Browser — tabs, syntax highlighting, search, 6 built-in file viewers</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/rss-reader.png" alt="RSS reader with feed management and AI summarization" width="100%">
      <br>
      <sub>📡 RSS Reader — feed management, groups, AI article summarization</sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/spotify.png" alt="Spotify player with playlist browsing" width="100%">
      <br>
      <sub>🎵 Spotify — browse, search, control playback without leaving the app</sub>
    </td>
  </tr>
</table>

<div align="center">

**And more:** mind maps 🧠, flow diagrams 🔀, interactive graphs 🕸️, Mermaid diagrams 📐, Excalidraw canvas ✏️, stock charts 📈, theme studio 🎨, AI browser, workspace manager, and a fully customizable tiled layout.

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

> 🙋 **A note from the developer:** As a part-time individual developer, I've personally only tested Gemini, DeepSeek, and Ollama — I don't have subscriptions to every AI provider. If you run into any issues connecting to a provider, I'd greatly appreciate you [reporting it](https://github.com/w-t-yang/aynite/issues). Apologies in advance if some providers don't work out of the box!

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

## Contributing

Everyone is welcome to contribute! There's just one small request: **write your code and make contributions with Aynite**. I believe contributors should be the people who love using Aynite the most — for everything.

> ⚡ **Aynite Contribution Ratio** — Up to this point (2026-05-27), **27.9%** of the project's commit history has already been authored by Aynite + DeepSeek-V4-Flash, and this ratio keeps climbing.
>
> ```
> Aynite + DeepSeek-V4-Flash     114 commits  (27.9%)
> Claude Code + DeepSeek-V4-Flash  71 commits  (17.4%)
> Antigravity + Gemini            224 commits  (54.8%)
> ─────────────────────────────────────────
> Total                           409 commits
> ```
>
> Check the latest ratio anytime with `npm run count:aynite`.

## Contributors

<!-- contributors:start -->

<a href="https://github.com/w-t-yang"><img src="https://avatars.githubusercontent.com/u/2253954?v=4&s=64" width="40" height="40" style="border-radius:50%" alt="w-t-yang" title="w-t-yang"></a>
<a href="https://github.com/apps/dependabot"><img src="https://avatars.githubusercontent.com/in/29110?v=4&s=64" width="40" height="40" style="border-radius:50%" alt="dependabot[bot]" title="dependabot[bot]"></a>

<!-- contributors:end -->

---

## License

[MIT](LICENSE) © Wentao Yang
