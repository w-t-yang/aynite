---
name: create-command
description: Create new direct commands, modify existing commands. Use when users want to create a deterministic command that is directly executed by the editor via a shell script.
---

# Command Creator

A skill for creating new "Direct Commands" and iteratively improving them.

## Output Location

Before creating any files, confirm the output folder with the user. If the user doesn't specify one:

- **All platforms**: Commands are stored in `~/.aynite/commands/`

Each command lives in its own subdirectory: `<output-folder>/<command-name>/`

## Command Structure

A direct command MUST follow this exact structure:

```
command-name/
├── COMMAND.md     - Documentation with YAML parameters
├── run.sh         - THE ENTRY POINT (required)
└── scripts/       - Support scripts (Python, JS, etc.)
```

## Anatomy of COMMAND.md

The `COMMAND.md` file must start with a YAML frontmatter block defining its parameters:

```markdown
---
name: my-command
description: What this command does
parameters:
  - name: input_file
    description: The file to process
    required: true
  - name: mode
    description: Processing mode (fast|slow)
    default: fast
---

# My Command Documentation
Detailed instructions on how to use this command...
```

## The run.sh Entry Point

The `run.sh` script is the primary execution point. It should:
1. Parse parameters passed by the editor.
2. Delegate to scripts in the `scripts/` folder if necessary (e.g., `python3 scripts/process.py`).
3. Provide clear output or error messages.

## Creation Workflow

1. **Confirm the output folder** — Ask the user where to create the command. If they don't have a preference, use the default Aynite commands folder (`~/.aynite/commands/` on all platforms). Create the folder if it doesn't exist.

2. **Define Interface** — What parameters does this command need?

3. **Implement Logic** — Write the `run.sh` and any supporting scripts in `scripts/`. Make sure `run.sh` is executable (`chmod +x run.sh`).

4. **Document** — Fill out the `COMMAND.md` with the parameter schema and descriptions.

5. **Tell the user what you created** — After creation, clearly tell the user:
   - The name of the command and where it was saved
   - How to invoke it: type `> <command-name>` in the chat (e.g., `> my-command`)
   - **Important**: They should press **`Ctrl+R`** to refresh the tile so Aynite discovers the new command. Until they reload, the command won't appear in the command palette or be invocable.
