# Dataview Schemas Reference

Consolidated schemas for all 8 Aynite dataview types. Each dataview expects a `.json` file
that conforms to its `config.json` schema.

---

## 1. dataview-chart — Bar / Line / Area / Pie / Radar

**Schema:** `{keys, data}`

```json
{
  "title": "Optional title",
  "keys": ["Revenue", "Profit", "Expenses"],
  "data": [
    { "name": "Mon", "Revenue": 4000, "Profit": 2400, "Expenses": 1600 }
  ]
}
```

- `keys` — Array of data series names (strings). Each key becomes a line/bar series.
- `data` — Array of objects. Each object should have a `name` (x-axis label) plus one value per key.
- `title` — Optional chart title.

---

## 2. dataview-graph — Force-Directed Graph

**Schema:** `{nodes, links}`

```json
{
  "nodes": [
    { "id": "node-1", "label": "Node One", "group": 0, "val": 10 }
  ],
  "links": [
    { "source": "node-1", "target": "node-2", "value": 1 }
  ]
}
```

- `nodes[].id` — Unique identifier (string).
- `nodes[].label` — Display label.
- `nodes[].group` — Optional group number (colors by group).
- `nodes[].val` — Optional node size.
- `links[].source` — Node ID of the source.
- `links[].target` — Node ID of the target.
- `links[].value` — Optional link thickness.

---

## 3. dataview-flow — Node-Based Flow Editor

**Schema:** `{nodes, edges}`

```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "input",
      "position": { "x": 50, "y": 100 },
      "data": { "label": "Start" }
    }
  ],
  "edges": [
    { "id": "e-1", "source": "node-1", "target": "node-2", "label": "Go" }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

- `nodes[].id` — Unique node ID.
- `nodes[].position` — `{x, y}` coordinates on the canvas.
- `nodes[].data.label` — Node display text.
- `nodes[].type` — Optional: `"input"`, `"output"`, `"default"`.
- `edges[].source` / `edges[].target` — Node IDs to connect.
- `edges[].label` — Optional edge label.
- `viewport` — Optional initial camera position/zoom.

---

## 4. dataview-diagram — Mermaid Diagram

**Schema:** `{definition}`

```json
{
  "title": "System Architecture",
  "type": "flowchart",
  "definition": "graph TD\n    A[Start] --> B[End]"
}
```

- `definition` — Mermaid syntax string. Supports flowchart, sequence, class, state, gantt, pie, etc.
- `type` — Optional hint: `"flowchart"`, `"sequenceDiagram"`, `"classDiagram"`, etc.
- `title` — Optional diagram title.

---

## 5. dataview-mindmap — Interactive Mind Map

**Schema:** `{root}`

```json
{
  "root": {
    "id": "root",
    "label": "Central Topic",
    "children": [
      {
        "id": "child-1",
        "label": "Subtopic",
        "children": [
          { "id": "leaf-1", "label": "Detail" }
        ]
      }
    ]
  }
}
```

- `root.id` — Unique ID for the root node.
- `root.label` — Display text.
- `root.children` — Optional array of child nodes (recursive structure).
- Each child recursively has `id`, `label`, and optional `children`.

---

## 6. dataview-canvas — Excalidraw Canvas

**Schema:** `{elements, appState}`

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [
    {
      "id": "rect-1",
      "type": "rectangle",
      "x": 40,
      "y": 150,
      "width": 150,
      "height": 80,
      "strokeColor": "#1971c2",
      "backgroundColor": "#d0ebff",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "strokeStyle": "solid"
    }
  ],
  "appState": {
    "gridSize": null,
    "viewBackgroundColor": "#ffffff"
  }
}
```

- `elements` — Array of Excalidraw element objects (rectangle, ellipse, diamond, arrow, text, etc.).
- `appState` — Canvas state with `viewBackgroundColor`, `gridSize`, etc.
- Each element requires `id`, `type`, `x`, `y`, `width`, `height`, `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`.
- For a full list of element properties, see the [Excalidraw API](https://github.com/excalidraw/excalidraw).

---

## 7. dataview-stock — Candlestick Stock Chart

**Schema (alternative 1):** `{symbol, data}`

```json
{
  "symbol": "AAPL",
  "data": [
    {
      "time": "2024-06-03",
      "open": 192.0,
      "high": 194.5,
      "low": 191.2,
      "close": 193.8,
      "volume": 65000000
    }
  ]
}
```

**Schema (alternative 2):** `{metadata, history}`

```json
{
  "metadata": { "symbol": "AAPL" },
  "history": [
    {
      "time": "2024-06-03",
      "open": 192.0,
      "high": 194.5,
      "low": 191.2,
      "close": 193.8,
      "volume": 65000000
    }
  ]
}
```

- `data[].time` or `data[].date` — Date string.
- `open`, `high`, `low`, `close` — OHLC price values (numbers).
- `volume` — Trading volume.

---

## 8. dataview-theme — Color Theme Editor

**Schema:** `{id, colors}`

```json
{
  "id": "my-theme",
  "name": "My Custom Theme",
  "type": "dark",
  "colors": {
    "background": "#1a1a2e",
    "foreground": "#e0e0e0",
    "primary": "#6c63ff",
    "secondary": "#3f3d56",
    "accent": "#ff6584",
    "border": "#2d2d44",
    "sidebar": "#16213e",
    "muted": "#2a2a40"
  }
}
```

- `id` — Unique theme identifier (string).
- `colors` — Object mapping color role names to hex values.
- `name` — Optional human-readable name.
- `type` — Optional: `"light"` or `"dark"`.

---

## Quick Selection Guide

| Your Data Looks Like... | Best Dataview |
|---|---|
| Tabular data with rows and columns, values over time | `dataview-chart` |
| Network of connected entities (people, systems, concepts) | `dataview-graph` |
| Process/workflow with steps and decision points | `dataview-flow` |
| Visual diagram using standard notation | `dataview-diagram` |
| Hierarchical / tree-structured information | `dataview-mindmap` |
| Freeform sketch, wireframe, or whiteboard | `dataview-canvas` |
| Financial time-series with OHLC prices | `dataview-stock` |
| Color scheme / visual theme definition | `dataview-theme` |
