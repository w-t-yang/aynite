# Data Visualization

Aynite has 8 built-in data visualization views (called **DataViews**). Each one loads a JSON file and renders it as an interactive visualization. Combined with the `transform-to-dataview` skill, you can turn data from any source into a visual format.

---

## The 8 DataViews

| View | What It Renders | Schema |
|------|----------------|--------|
| **📊 Chart** | Bar, line, area, pie, radar charts | `{keys: string[], data: object[]}` |
| **📈 Stock** | Candlestick charts for financial data | `{symbol: string, data: [{open,high,low,close,volume}]}` |
| **🕸️ Graph** | Force-directed network graphs | `{nodes: [{id,label}], links: [{source,target}]}` |
| **🔀 Flow** | Node-based flow editor (React Flow) | `{nodes: [{position,data}], edges: [{source,target}]}` |
| **📐 Diagram** | Mermaid diagrams | `{definition: string}` |
| **🌳 MindMap** | Collapsible tree mind maps | `{root: {id,label,children?}}` |
| **✏️ Canvas** | Excalidraw infinite whiteboard | `{elements: object[], appState: object}` |
| **🎨 Theme** | Color theme editor | `{id: string, colors: {string: string}}` |

---

## Opening a Dataview

There are two ways to open a dataview:

### From the File Browser

Open any `.json` file in the file browser. If the file matches a dataview's schema (auto-detected), the view switches from text mode to the matching dataview renderer.

### From a Tile

1. Open a tile's view selector (click the tile menu)
2. Choose a dataview (e.g., "Data Chart", "Graph Explorer")
3. The view loads a demo/playbook file by default
4. Click **Open File** to load your own JSON data
5. Click **Refresh** to reload the current file

---

## Using the Transform-to-Dataview Skill

The `/transform-to-dataview` skill turns raw data from any source into a JSON file compatible with one of the 8 dataviews.

### Example Workflow

Say you have a CSV file with employee data and you want to visualize it as a graph of who reports to whom:

1. Open the AI chat (**`Ctrl+I`**)
2. Type: `/transform-to-dataview I have this CSV of employees with manager IDs, I want to see it as a graph`
3. The AI will:
   - Show you available dataviews (run `discover_dataviews.py`)
   - Help you choose the right one (Graph for connections)
   - Understand your source data structure
   - Brainstorm the mapping
   - Write and run a transformation script
   - Validate the output against the graph schema
   - Save the JSON file next to your source data

4. Open the new JSON file in the file browser — it renders as an interactive graph

### Supported Source Formats

Any data can be transformed — CSV, JSON, plain text, markdown, logs, clipboard content, folder structures. The skill adapts to whatever you have.

---

## Playbook Demo Files

Aynite comes with demo data files for all 8 dataviews, located in your `~/.aynite/aynite-playbook/` folder:

| File | Best Viewed As |
|------|---------------|
| `aynite-git-activity.json` | 📊 Chart |
| `aynite-stock.json` | 📈 Stock |
| `aynite-view-dependencies.json` | 🕸️ Graph |
| `aynite-ai-agent-flow.json` | 🔀 Flow |
| `aynite-architecture.json` | 📐 Diagram |
| `aynite-mindmap.json` | 🌳 MindMap |
| `aynite-canvas-sketch.json` | ✏️ Canvas |
| `aynite-deep-theme.json` | 🎨 Theme |

Open any of these from the file browser to see the dataview in action.

---

## Building Your Own DataViews

> 🚧 **Coming soon:** The `/create-dataview` skill will guide you through creating new custom dataviews, defining their JSON schemas, and registering them as first-class Aynite views — just like the 8 built-in ones.

In the meantime, you can study the source code of existing dataviews in `src/renderer/views/dataview-*/` as reference for building your own.
