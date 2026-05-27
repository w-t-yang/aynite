# 🔮 Trading Showcase

This is a live showcase of what you can build with Aynite commands — no plugins, no waiting, just scripts wired into your editor.

---

## 📊 Demo Charts

Open these in your browser to see interactive stock charts with price history, volume, and company info:

- **[AAPL — Apple Inc.](./data/AAPL.view.html)**  
- **[002594.SZ — BYD Co.](./data/002594.SZ.view.html)**  

> 💡 These HTML files were generated entirely by the commands below. Drag them into Aynite to view the source.

---

## 🪄 How It Was Made

This showcase was built with two commands — one to fetch data, one to visualize it:

| Command | What It Does |
| :--- | :--- |
| `> stock-fetch --symbol AAPL` | Fetches 1 year of daily stock data from Yahoo Finance and saves it as JSON |
| `> stock-view --file AAPL.json` | Generates an interactive HTML chart from the stock JSON, with shared CSS/JS assets |

That's it. Two commands. Five minutes. No waiting for a feature request.

---

## ✨ Create Your Own Commands

You can create commands just like these in two ways:

### Via `/create-spell` (Recommended for Beginners)

Type `/create-spell` in the chat. The AI will interview you about what you want to build, help you decide whether it should be a **command** (deterministic script with `>`) or a **skill** (AI-guided workflow with `/`), then delegate to the right creator.

```
/create-spell I want a command that converts CSV files to JSON
```

### Via `/create-command` (Direct)

If you already know you want a command, go straight to:

```
/create-command help me create a command that...
```

The creator will walk you through defining parameters, writing `run.sh`, and documenting with `COMMAND.md`.

---

## 🔧 Improve These Commands

The commands in this showcase are yours now — modify them, break them, make them better. Some ideas:

- **stock-fetch**: Add multi-symbol batch fetching, different data sources, CSV output
- **stock-view**: Add candlestick charts, moving averages, date range picker, comparison mode

Every command is just a folder with `COMMAND.md` + `run.sh` + scripts. Open them in Aynite and start hacking.

---

## ⚙️ Adding This Commands Folder to Aynite

To make these commands available in your editor:

1. **Open Settings** (gear icon or menu → Settings)
2. Go to the **Commands** tab
3. Click **Add Folder** and select:
   ```
   <aynite-playbook>/showcase/trading/commands
   ```
4. Press **`Ctrl+Shift+R`** to reload Aynite
5. Try it: type `> stock-fetch --symbol TSLA` in the chat

Now the commands will appear in your command palette and can be invoked from anywhere.

---

## 📁 Folder Structure

```
trading/
├── README.md              ← You are here
├── commands/              ← Add this folder in Settings → Commands
│   ├── stock-fetch/       ← Fetches stock data from Yahoo Finance
│   │   ├── COMMAND.md
│   │   ├── run.sh
│   │   └── scripts/
│   │       └── fetch.py
│   └── stock-view/        ← Generates HTML chart from stock JSON
│       ├── COMMAND.md
│       ├── run.sh
│       ├── scripts/
│       │   └── generate.py
│       └── assets/
│           ├── style.css
│           ├── viewer.js
│           └── template.html
└── data/                  ← Sample output — what the commands produce
    ├── AAPL.json
    ├── AAPL.view.html
    ├── 002594.SZ.json
    ├── 002594.SZ.view.html
    ├── style.css
    └── viewer.js
```
