---
name: transform-to-dataview
description: >-
  Transform raw data (files, folders, clipboard content) into JSON files
  compatible with Aynite's dataview visualization types. When the user mentions
  wanting to visualize data, create a chart/graph/diagram/flow/mindmap from data,
  convert data to a specific format, prepare data for a view, or transform spreadsheets,
  CSVs, or structured text into a visual format — use this skill. Also use it when
  the user has data they want to "render in a dataview" or "make a dataview from this."
  This skill helps brainstorm the best visualization approach, handles the transformation,
  validates the output against the view's schema, and saves the result.
---

# transform-to-dataview

A guided skill for taking raw data and transforming it into a JSON file
that can be rendered by one of Aynite's 8 dataview types.

## How it works

The skill runs as a **collaborative conversation** between you (the AI) and the user.
You guide them through discovery, choice, brainstorming, transformation, and validation.

### The transformation process

```
1. DISCOVER  → 2. CHOOSE   → 3. UNDERSTAND  → 4. BRAINSTORM  → 5. TRANSFORM  → 6. VALIDATE  → 7. SAVE
```

---

## Step 1: Discover Available Dataviews

Run the discovery script to find which dataviews are available on this system:

```bash
python3 <skill-path>/scripts/discover_dataviews.py
```

This scans both the source code views (`src/renderer/views/`) and runtime views
(`~/.aynite/views/`) for directories with the `dataview-` prefix containing a
valid `config.json`. It returns a table like:

```
ID                       Name                   Schema Keys
--------------------------------------------------------------
dataview-chart           Data Chart             keys, data
dataview-graph           Graph Explorer         nodes, links
dataview-flow            Flow Editor            nodes, edges
dataview-diagram         Diagram                definition
dataview-mindmap         MindMap                root
dataview-stock           Stock Chart            symbol, data | metadata, history
dataview-canvas          Canvas                 elements, appState
dataview-theme           Theme Studio           id, colors
```

**Important:** If the script finds fewer dataviews than expected (e.g., only runtime
views but not source views), that's OK — you only need one list of available options.
The script deduplicates by name, so a dataview found in both locations only appears once.

---

## Step 1b: (Optional) Show Details for a Specific Dataview

If the user wants to understand a particular dataview's schema requirements in detail:

```bash
python3 <skill-path>/scripts/show_dataview_info.py <dataview-id>
```

For example:
```bash
python3 <skill-path>/scripts/show_dataview_info.py dataview-graph
```

This shows:
- Full description of what the dataview does
- Required fields and their types
- All optional fields
- A minimal example JSON structure

Use this when the user is unsure what a dataview expects, or when you need
to clarify the exact shape of data needed.

---

## Step 2: Present Options and Help the User Choose

Show the user the list of dataviews and help them pick the right one. Here's
a quick reference you can use in conversation:

| If the user's data looks like... | Suggest this dataview |
|---|---|
| Tables, numbers, time series, comparisons | **dataview-chart** — bar, line, area, pie, radar |
| Networks, connections between things | **dataview-graph** — force-directed graph |
| Processes, workflows, decision trees | **dataview-flow** — node-based flow editor |
| Visual diagrams (flowchart, sequence, class) | **dataview-diagram** — Mermaid renderer |
| Hierarchies, outlines, tree structures | **dataview-mindmap** — collapsible mind map |
| Freeform sketches, wireframes, whiteboards | **dataview-canvas** — Excalidraw canvas |
| Stock prices, financial OHLC data | **dataview-stock** — candlestick chart |
| Color schemes, visual themes | **dataview-theme** — color theme editor |

**How to guide the choice:**
- If the user is unsure, ask questions about the nature of their data:
  - "Is this a list of connected items, or more like a table with rows and columns?"
  - "Does your data have a natural hierarchy (parent-child relationships)?"
  - "Do you want to show changes over time?"
- If a user describes what they want to *see*, map that to the right view:
  - "I want to see how things connect" → graph
  - "I want to see trends" → chart
  - "I want a tree of ideas" → mindmap
- Don't force a choice — suggest the best fit and explain your reasoning.

---

## Step 3: Understand the Source Data

Once the dataview is chosen, help the user identify and understand their source data.

**The source can be:**
- A **file** (CSV, JSON, TSV, plain text, markdown, logs, etc.)
- A **folder/directory** (a collection of related files)
- **Clipboard content** or text they've already shared in the conversation

**For files and folders:**
- Use `read_file` or `list_files` to examine the data
- Understand the structure: headers, columns, relationships, nesting
- If it's a folder, check if files have a consistent format

**For text/clipboard:**
- The user may have already pasted it in the chat
- Format might be unstructured — ask clarifying questions

**What to figure out:**
- What are the key entities/fields in the data?
- What relationships exist between data points?
- What might be useful as labels, values, categories, or connections?
- Is there any data that won't be useful for visualization (filter it out)?

---

## Step 4: Brainstorm the Transformation Strategy

Now you and the user discuss how to map source data → target JSON format.
This is the most creative step. You should:

1. **Explain the target schema** briefly in plain language. For example:
   - "The graph view needs two lists: `nodes` (each with an `id` and `label`) and `links` (connecting nodes by their IDs)."
   - "The chart view needs a `keys` array naming each data series, and a `data` array where each item has values for every key."

2. **Propose a mapping** from source fields to target fields:
   - "Your CSV has columns `from`, `to`, `weight`. We can map `from` → `link.source`, `to` → `link.target`, `weight` → `link.value`."
   - "Your JSON has `employees` array. Each employee's `name` becomes a node label, and `manager_id` becomes a link."

3. **Suggest the best visualization approach**: Based on the data shape:
   - For a chart: do you want bar (categories), line (trends), pie (proportions)?
   - For a graph: what should define groups? What defines node size?
   - For a flow: is the layout determined by position or should it auto-layout?

4. **Ask for confirmation** before proceeding — the user might want a different
   mapping or a different visualization approach.

### Common transformation patterns

| Source Format | Target Dataview | Typical Mapping |
|---|---|---|
| CSV with header row | chart | Column headers → `keys`, rows → `data` items |
| CSV with `from,to` columns | graph | Unique values → `nodes`, each row → `link` |
| Markdown headings | mindmap | Heading levels → tree depth |
| JSON array of objects | chart | Object keys → series, values → data points |
| Process description text | flow | Steps → nodes, transitions → edges |
| List of items with relationships | graph | Items → nodes, relationships → links |
| Nested JSON | mindmap | Nesting structure → children tree |
| OHLC price data | stock | Map field names to open/high/low/close/volume |

---

## Step 5: Transform the Data

This is where you write code to transform the raw data into the target JSON format.

**Always validate your approach before writing complex code:**
1. First read and understand the source data structure
2. Read the target schema (via `show_dataview_info.py`)
3. Write a transformation script (you can use Python, Node.js, or any tool available)
4. Run the script to produce the output JSON

### Writing the transformation

Your transformation approach depends on the data size and complexity:

- **Small data** (under 50 items): You can write the JSON directly using `write_file`
  after processing manually, or write a simple inline script.
- **Medium data** (50-10,000 items): Write a Python or Node.js script that reads the
  source, transforms each item, and outputs JSON.
- **Large data** (10,000+ items): Write an efficient streaming script and consider
  whether the user needs all data or just an aggregated/sampled view.

### Example: Transforming CSV to Graph

```python
import csv, json

nodes_set = set()
links = []

with open("connections.csv") as f:
    reader = csv.DictReader(f)
    for row in reader:
        source, target = row["from"], row["to"]
        nodes_set.add(source)
        nodes_set.add(target)
        links.append({"source": source, "target": target, "value": int(row.get("weight", 1))})

nodes = [{"id": n, "label": n, "group": 0} for n in sorted(nodes_set)]

with open("output.json", "w") as f:
    json.dump({"nodes": nodes, "links": links}, f, indent=2)
```

### Save to a temporary file first

Always save the transformed output to a temporary location first (e.g., `/tmp/`)
so you can validate it before moving it to the final destination.

---

## Step 6: Validate the Output

After transformation, validate the output JSON against the dataview's schema:

```bash
python3 <skill-path>/scripts/validate_schema.py <dataview-id> /tmp/output.json
```

**If validation passes:**
```
✅ Valid: 'output.json' matches the 'dataview-chart' schema.
```

**If validation fails:**
```
❌ Validation failed:
   • $: missing required field 'keys'
   • $: missing required field 'data'
```

Fix any issues and re-validate. The validator checks:
- Required fields exist at the top level
- Field types match (string, number, object, array)
- Array items have required sub-fields
- Enum values are valid (where applicable)
- `anyOf` alternatives (at least one must match)

**Important:** The validator uses the schema from `config.json`, which is a simplified
schema. Some valid data might fail edge cases in the validator, and some invalid data
might pass. Always use your own judgment — the validator is a helpful check, not a
perfect gate. If the validator reports an error that seems wrong (e.g., a required
field that's present), double-check the schema with `show_dataview_info.py`.

---

## Step 7: Save the Output

When validation passes and the user is happy with the result:

1. **Save next to the source.** The output JSON goes alongside the input:
   - **If the source is a file** — save the `.json` file in the **same directory** as the source file, with a descriptive name (e.g., `my-data-chart.json`).
   - **If the source is a folder** — save the `.json` file **inside that folder**, so the data and its visualization are kept together.
   - **If the source is clipboard/text** — ask the user where they'd like it saved (default: their current workspace directory).

2. **If you're unsure** (e.g., the input is a file inside a deeply nested path and the user might want the output elsewhere), ask the user to confirm the output location before saving.

3. **Copy/save the file:**
   ```bash
   cp /tmp/output.json /path/to/next/to/input/output.json
   ```

4. **Tell the user the full path** where the file was saved.

---

## When to Use This Skill's Bundled Scripts

| Situation | Script |
|---|---|
| Show all available dataviews | `scripts/discover_dataviews.py` |
| Show schema details for one dataview | `scripts/show_dataview_info.py <id>` |
| Validate output against schema | `scripts/validate_schema.py <id> <file>` |

All schema information is fetched live from each view's `config.json` — no static reference needed.

---

## Important Notes

### The skill is conversational — don't rush
The goal is to help the user get their data visualized in the best possible way.
This requires back-and-forth: explain options, suggest mappings, confirm choices.
Don't jump straight to writing code without understanding the user's intent.

### Data privacy
Source data may contain sensitive information. Transform it locally (don't send
data to external APIs). All scripts in this skill run locally.

### When the user has NO data yet
If the user wants to create a dataview visualization but hasn't specified source
data, ask them what they want to visualize. The skill can still help by explaining
what each dataview type does so they can match their idea to the right format.

### Malformed data
If source data is messy (inconsistent formatting, missing values, mixed types):
1. Clean it as best you can during transformation
2. Tell the user about assumptions you made
3. Point out data that couldn't be cleanly mapped
4. Let them decide if the result is acceptable

### Multiple output files
If the user wants multiple visualizations from the same data, transform it multiple
times into different dataview formats. Each output needs its own file.
