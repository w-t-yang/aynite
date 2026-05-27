---
name: create-spell
description: Create a new "spell" in Aynite. A spell is a unified concept — it can be either a command (deterministic script, invoked with >) or a skill (AI-guided workflow, invoked with /). Use this skill whenever a user wants to create a spell, cast magic, automate something, or build a new capability but isn't sure whether it should be a command or a skill. Also use when users say "I want to make a spell", "teach Aynite to...", "I wish Aynite could...", or describe a task they want to automate or delegate.
---

# Spell Creator

A spell is magic. It's how you teach Aynite to do new things — anything from a quick shell one-liner to a sophisticated AI-guided workflow.

In Aynite, a **spell** is either:

| Spell Type | Invocation | What It Is | Best For |
| :--- | :--- | :--- | :--- |
| **Command** | `> spell-name` | A deterministic script (`run.sh`) that produces the same output for the same input | Deployments, file processing, API calls, data transforms, build scripts — anything precise and repeatable |
| **Skill** | `/spell-name` | An AI-guided workflow (`SKILL.md`) that adapts and reasons with context | Code generation, content creation, analysis, complex multi-step workflows — anything that needs judgment |

The spell-creator is the starting point: it helps you decide which kind of spell you need, then hands off to the right creator to build it.

## Output Location

Before creating any files, confirm the output folder with the user. If the user doesn't specify one:

- **Commands** → `~/.aynite/commands/` (Linux/Mac) or `%AppData%/aynite/commands/` (Windows)
- **Skills** → `~/.aynite/skills/` (Linux/Mac) or `%AppData%/aynite/skills/` (Windows)

Create the folders if they don't exist.

## Workflow

### Step 1: Understand the Magic

Start by asking the user what they want the spell to do. Get concrete:

- What's the trigger? (When should this spell fire?)
- What's the input? (A file? A question? A selection in the editor? Nothing — just run?)
- What's the desired output? (A changed file? An answer? A deployed app? A formatted report?)

Encourage the user to describe it in plain language. Something like:

> "When I'm about to commit code, I want Aynite to generate a commit message based on my staged changes."

or

> "I want a spell that takes a CSV file and spits out a nice summary with charts."

### Step 2: Choose the Spell Type

Based on the user's description, help them decide: **command or skill?**

Ask yourself (and confirm with the user):

| Question | If Yes → Command | If Yes → Skill |
| :--- | :--- | :--- |
| Is the output predictable for a given input? | ✅ | ❌ |
| Can it be expressed as a shell script or program? | ✅ | ❌ |
| Does it need AI reasoning, judgment, or context? | ❌ | ✅ |
| Is the workflow variable — different each time? | ❌ | ✅ |
| Does it involve generating text/code creatively? | ❌ | ✅ |
| Is speed and determinism critical? | ✅ | ❌ |

**Examples to help the user:**

> 🔧 **Command**: "Deploy the current project to my server" — same steps every time, no AI needed.
>
> 🧠 **Skill**: "Write a pull request description from my git diff" — needs AI to understand the changes and write prose.

If it's borderline, default to **skill** — skills are more flexible and can always call commands if needed. But explain your reasoning to the user and let them decide.

### Step 3: Confirm the Output Folder

Ask the user where to save the spell. Use the defaults from the [Output Location](#output-location) section above if they don't have a preference.

### Step 4: Delegate to the Creator

Now hand off to the appropriate creator:

- **If it's a command**: Load and follow `/create-command` to create the `COMMAND.md` and `run.sh`. The create-command skill contains the full specification for command structure, parameter definitions, and the `run.sh` entry point.

- **If it's a skill**: Load and follow `/create-skill` to create the `SKILL.md`. The create-skill skill contains the full specification for skill anatomy, progressive disclosure, writing style, and the eval/iteration loop.

Stay involved through the creation process — the user invoked spell-creator, so you're their guide from start to finish. Don't just hand off and disappear.

### Step 5: Tell the User How to Cast the Spell

After the spell is created, clearly tell the user:

1. **The spell name and type** — e.g., "I've created a command called `deploy` for you."
2. **How to cast it**:
   - For a **command**: type `> spell-name` in the chat (e.g., `> deploy --env production`)
   - For a **skill**: type `/spell-name` followed by your request (e.g., `/pr-writer generate a PR description from my last 3 commits`)
3. **Refresh the tile** — Press **`Ctrl+R`** to refresh the tile so Aynite discovers the new spell. It won't be available until you do.

Make it feel magical. The user just taught Aynite a new trick. Celebrate that.

---

## Quick Reference: Skill vs Command Creators

### create-command (for `>` spells)

- Creates a folder with `COMMAND.md` + `run.sh` + optional `scripts/`
- `COMMAND.md` has YAML frontmatter defining parameters
- `run.sh` is the entry point — make it executable with `chmod +x`
- Commands are invoked with `> command-name` in the chat

### create-skill (for `/` spells)

- Creates a folder with `SKILL.md` as the entry point
- `SKILL.md` has YAML frontmatter (name + description required)
- Can include `scripts/`, `references/`, `assets/` as bundled resources
- Skills are invoked with `/skill-name` in the chat
- The create-skill skill supports evals, benchmarking, and iterative improvement

---

## Example Walkthrough

### User says: "I want a spell that deploys my site to Netlify"

**Your thinking:**
- Input: nothing (just run it)
- Output: deployed site
- Is it deterministic? Yes — same steps every time (build, publish)
- Does it need AI? No — it's a fixed workflow

**Verdict: Command**

You'd confirm with the user, then delegate to `/create-command` to build a `deploy` command with a `run.sh` that runs the Netlify CLI.

**Cast it with:** `> deploy`

---

### User says: "I want a spell that writes daily standup notes from my git activity"

**Your thinking:**
- Input: git history
- Output: human-readable standup notes
- Is it deterministic? No — needs to understand and summarize code changes
- Does it need AI? Yes — generating natural language from code diffs

**Verdict: Skill**

You'd confirm with the user, then delegate to `/create-skill` to build a `standup-writer` skill.

**Cast it with:** `/standup-writer generate today's standup from my commits`
