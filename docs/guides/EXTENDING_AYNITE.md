# Extending Aynite

Aynite is designed to be extended. You can add new capabilities through **skills** (AI-guided workflows), **commands** (deterministic scripts), **spells** (agent configurations), and in the future, **custom views** and **slide decks**.

---

## Skills (`/skill-name`)

**Skills** teach the AI agent how to do something new. They're written in Markdown and can include bundled scripts, reference docs, and assets.

### Anatomy of a Skill

```
skill-name/
├── SKILL.md          # Instructions for the AI (required)
├── scripts/          # Executable code (optional)
├── references/       # Documentation loaded as needed (optional)
└── assets/           # Templates, icons, fonts (optional)
```

The `SKILL.md` file has YAML frontmatter with `name` and `description` fields. The description is the primary mechanism for skill triggering — it tells the AI when to activate the skill.

### Creating a Skill

Use the `/create-skill` skill:

```
/create-skill help me create a skill that generates commit messages in my team's format
```

The AI will:
1. Interview you about what the skill should do
2. Write a draft `SKILL.md`
3. Run test cases to verify it works
4. Iterate based on your feedback
5. Save the skill to `~/.aynite/skills/<name>/`

### Built-in Skills

| Skill | What It Does |
|-------|-------------|
| `/create-theme` | Generate a custom color theme |
| `/create-command` | Create a new command |
| `/create-skill` | Create or improve a skill |
| `/create-spell` | Decide between command or skill, then delegate |
| `/create-slides` | Create slide decks from your data — markdown, images, and more |
| `/transform-to-dataview` | Transform data into visualizations |

> 🚧 **Coming soon:** `/create-dataview` — a skill that guides you through creating custom dataviews, defining their JSON schemas, and registering them as views.

| `/create-slides` | Create slide decks from your data — markdown, images, and more |

---

## Commands (`> command-name`)

**Commands** are deterministic shell scripts. They always produce the same output for the same input — no AI reasoning, just precise, repeatable execution.

### Anatomy of a Command

```
command-name/
├── COMMAND.md        # Documentation with YAML frontmatter (required)
├── run.sh            # Entry point script (required)
└── scripts/          # Helper scripts (optional)
```

### Creating a Command

Use the `/create-command` skill:

```
/create-command help me create a command that converts CSV files to JSON
```

The AI will walk you through defining parameters, writing `run.sh`, and documenting with `COMMAND.md`.

### Using Commands

Run any command from the AI chat with the `>` prefix.

---

## Spells (`/spell-name` or `> spell-name`)

A **spell** is a unified concept that covers both commands and skills. Use the `/create-spell` skill to decide which one you need:

```
/create-spell I want to automate my deployment process
```

The AI will help you determine:
- **Command** — If it's deterministic and doesn't need AI reasoning
- **Skill** — If it needs judgment, context, or flexible workflows

Then it delegates to the appropriate creator.

---

## Custom Views

> 🚧 **Coming soon:** The `/create-dataview` skill will help you create new dataviews from scratch. You'll be able to:
> - Define a JSON schema for your data format
> - Create a rendering component
> - Register the view so it appears in the view selector
> - Share it as a reusable component

In the meantime, existing dataviews in `src/renderer/views/dataview-*/` serve as reference implementations.

---

## Tips

- **Refresh after adding** — Press **`Ctrl+R`** to refresh the tile after installing new skills, commands, or themes
- **Share by copying folders** — Skills and commands are just directories — zip them up and share
- **Folder management** — Add external skill/command folders in **Settings → Skills** or **Settings → Commands**
