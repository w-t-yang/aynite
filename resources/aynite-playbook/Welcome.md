# Welcome to Aynite! 👋

**A.Y.N.I.T.E — All You Need Is The Editor.**

Seriously. That's the whole idea.

Aynite is not just another AI coding tool bolted onto a chat window. It's a belief: the editor itself should be the interface to everything — AI, scripts, APIs, automations, your entire digital toolchain. No context-switching. No copy-pasting. No waiting for some product team to "add an integration." Just you, your editor, and the power to make it do whatever you want.

Aynite is an attitude.

---

## The Big Picture

Aynite is built on three simple ideas:

- **Extremely easy.** If you can open a text editor, you can use Aynite. No sprawling dashboards, no configuration hell, no PhD in prompt engineering required. It's a clean, beautiful editor that just works — and the AI is always one keystroke away.

- **Extremely flexible.** The ambition is for Aynite to do *anything* by connecting you to your computer — through **commands** (shell scripts, Python, Node — whatever you throw at it) and **skills** (AI-guided workflows that teach the agent how to handle specialized tasks). The editor becomes the operating system.

- **Extremely integrable.** If something has an API or SDK, you can integrate it into Aynite. You don't need to wait for the "official Aynite plugin" or the company to ship a feature. You're the one in control. Want to hook into Notion? Jira? Your custom internal tool? Go for it — wire it up with a command or a skill and you're done.

> 🚧 **Aynite is under active development, and it's far from perfect.** But that's the direction. That's the ambition. That's the vision. And every release gets us closer.

---

## ✨ Showcase

See what Aynite can do — for real. No mockups, no "imagine if." Just working code.

### 🔮 [Trading Showcase](./showcase/trading/README.md)

A complete, end-to-end example built entirely with Aynite commands:

| Command | What It Does |
| :--- | :--- |
| `> stock-fetch --symbol AAPL` | Fetches 1 year of daily stock data from Yahoo Finance, saves as JSON |
| `> stock-view --file AAPL.json` | Generates an interactive HTML chart with price history, volume, and company info |

**[→ Open the Trading Showcase](./showcase/trading/README.md)** to see the commands, sample data, live demo charts, and step-by-step instructions to add them to your own Aynite.

> 💡 More showcases coming soon. Built something cool? It could be here.

---

## ⚡ Quick Start: Three Shortcuts to Rule Them All

You can do almost anything in Aynite from the keyboard. Here are the three shortcuts to burn into your muscle memory right now:

| Shortcut | What It Does |
| :--- | :--- |
| **`Ctrl+R`** | **Refresh the active tile.** Made a change to a theme, a skill, or a config file? This is your refresh button. Quick, reliable, and you'll use it a lot. |
| **`Ctrl+Tab`** | **Find and switch files.** Fuzzy-search your entire workspace and jump instantly. Think of it as "Open Anything." No mouse required. |
| **`Ctrl+L`** | **Focus the AI chat.** The magic key. Instantly jump to the chat so you can ask the AI to explain code, refactor a file, generate a skill — whatever you need. One keystroke, infinite possibilities. |

---

## 🤖 Step 1: Set Up Your AI Provider

Before the AI agent can help you, you need to tell it which model to use. Aynite supports a huge range of providers through the Vercel AI SDK:

- **OpenAI** (GPT-4o, o1, etc.)
- **Anthropic** (Claude 3.5 Sonnet, Claude Opus, etc.)
- **Google** (Gemini 2.0 Flash, Gemini Pro, etc.)
- **DeepSeek** (Reasoning beasts)
- **Ollama** (Run models locally — fully offline!)
- **OpenRouter, Groq, Mistral, Azure, Bedrock...** and many more.

### How to configure

1. Open **Settings** from the app menu or sidebar.
2. Go to the **AI** tab.
3. Select your provider, enter your API key, and pick a model.
4. That's it. You're ready to chat.

> 💡 **Prefer local?** Set up [Ollama](https://ollama.ai), pull a model like `llama3.1`, and point Aynite to `http://localhost:11434`. No API key, no cloud — everything stays on your machine.

---

## 🎨 Step 2: Get Your Hands Dirty — Create Your First Theme

This is where the fun starts. You're going to use your very first **skill** to create a custom theme, right now.

1. Open the AI chat in any tile.
2. Type something like:
   ```
   /create-theme make me a cozy autumn sunset theme
   ```
   (You can say anything — "cyberpunk neon," "forest green," "ocean depths," whatever vibe you want.)
3. The AI agent will generate a complete theme file and save it to your themes folder.
4. Press **`Ctrl+R`** to refresh the tile.
5. Go to **Settings → Appearance** and select your brand new theme from the dropdown.

Boom. You just created something. Feels good, right?

> 🎨 The `create-theme` skill generates themes with all 32 color properties — backgrounds, text, borders, accent colors, semantic colors for errors and warnings, scrollbar styling, even font choices. Every pixel of Aynite responds to these variables, so your theme touches everything.

---

## ⚙️ Step 3: Try Your First Command

**Commands** are direct, deterministic scripts that run on your system. They're prefixed with `>` in the chat (or in the command palette).

A simple example — open the chat and type:

```
> echo "Hello from Aynite!"
```

You'll see the output directly in the chat. Commands can be anything: shell scripts, Python programs, Node scripts, curl calls to APIs — if you can run it in a terminal, you can run it as a command in Aynite.

> 💡 **Commands are deterministic.** Unlike AI skills (which are flexible and open-ended), commands always produce the same output for the same input. Use commands for precise, repeatable operations — file processing, deployment scripts, API calls, data transformations.

---

## 🔮 Step 4: Create Your Own Magic

This is where Aynite truly becomes *yours*. You can extend it infinitely with two built-in skills:

### Create a Skill with `/create-skill`

**Skills** teach the AI agent how to do something new. They're written in plain Markdown and can include bundled scripts, reference docs, and assets.

Think: "I want the AI to know how to write commit messages in my company's format," or "I want the AI to be able to generate deployment configs for my specific stack."

Just type:

```
/create-skill help me create a skill that...
```

The `create-skill` skill will walk you through it — defining the skill's purpose, writing the instructions, testing it, and packaging it up.

### Create a Command with `/create-command`

**Commands** are executable scripts. They have a `COMMAND.md` for documentation and a `run.sh` entry point (which can call Python, Node, whatever).

Think: "I want a one-click command that deploys my project to production," or "I want a command that formats my data files a specific way."

Just type:

```
/create-command help me create a command that...
```

> 🌟 **The real power of Aynite is this:** you don't need to wait for anyone. If you can describe it, you can build it. Skills and commands are your bridge from *"I wish Aynite could..."* to *"Aynite can."*

---

## 📚 The Aynite Playbook

This very file lives in the **Aynite Playbook** — a folder of guides, examples, and reference material to help you get the most out of the editor. Feel free to explore, modify, even delete things. It's your sandbox.

---

## 🚀 The Road Ahead

Aynite is young. Parts of it are rough. There are bugs. There are missing features. The docs might not always be up to date. But here's the thing:

**Aynite is moving fast**, and every update is a step toward the vision of an editor that can do *anything* — not because a product team planned it, but because **you** wired it up yourself, in minutes, without waiting on anyone.

We're building a tool where the user is in control. Where the editor is the platform. Where "All You Need Is The Editor" isn't just a clever acronym — it's the truth.

Welcome aboard. Let's build something awesome together.

— *The Aynite Team*
