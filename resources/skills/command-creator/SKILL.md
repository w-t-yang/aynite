---
name: command-creator
description: Create new direct commands, modify existing commands. Use when users want to create a deterministic command that is directly executed by the IDE via a shell script.
---

# Command Creator

A skill for creating new "Direct Commands" and iteratively improving them.

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
1. Parse parameters passed by the IDE.
2. Delegate to scripts in the `scripts/` folder if necessary (e.g., `python3 scripts/process.py`).
3. Provide clear output or error messages.

## Creation Workflow
1. **Define Interface**: What parameters does this command need? 
2. **Implement Logic**: Write the `run.sh` and any supporting scripts in `scripts/`.
3. **Document**: Fill out the `COMMAND.md` with the parameter schema and descriptions.
