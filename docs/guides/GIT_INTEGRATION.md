# Git Integration

> 🚧 **Early stage.** Aynite's git integration currently covers the basics — review changes and commit. More advanced features (branch management, rebase, merge conflict resolution, stashing, etc.) will come in future releases.

Aynite has basic git integration built into the file tree and file browser. You can track changes, view diffs, stage hunks, and generate commit messages — all without leaving the editor.

---

## File Status

The **Tree View** shows git status badges next to each file:

| Badge | Meaning |
|-------|---------|
| **M** (amber) | Modified — file has unstaged changes |
| **A** (green) | Added — new file staged |
| **U** (blue) | Untracked — new file not yet staged |
| **D** (red) | Deleted — file removed |
| **R** (purple) | Renamed — file name changed |

---

## Git Diff Mode

In the Tree View, toggle **Changes Only** to show only files with git changes. This turns the tree into a focused git diff panel, grouped by folder, with add/delete line counts.

---

## Viewing Diffs

When you open a file that has git changes, Aynite automatically shows the **diff view** instead of the regular file content.

### Diff View Features

- **Side-by-side view** — Modified lines shown in two columns (left = original, right = current)
- **Syntax highlighting** — Diffs are syntax-highlighted for readability
- **Hunk-based** — Changes are grouped into hunks (contiguous blocks of changes)

### Hunk Actions

Each hunk has action buttons:

| Action | What It Does |
|--------|-------------|
| **Stage** (➕) | Stage the hunk for commit |
| **Discard** (🗑️) | Discard the changes in this hunk |

You can stage or discard individual hunks, not just entire files — giving you fine-grained control over what goes into your commit.

---

## Committing

### AI-Powered Commit Messages

Aynite can generate commit messages automatically based on your staged changes:

1. Stage your changes (using hunk actions or `git add` via command)
2. In the Git Diff panel, click the **commit** button
3. The AI analyzes your staged changes and generates a commit message
4. Review and edit the message if needed
5. Click **Commit** to execute

The commit message generation uses your active AI provider but **without reasoning** (it's a simple task that doesn't need deep thinking).

### Manual Commits

You can also run git commands directly in the chat:

```
> git add -A
> git commit -m "my message"
> git push
```

---

## Auto-Refresh

Git status updates automatically in three ways:

1. **File operations** — Save, create, rename, or delete a file in Aynite → git status refreshes
2. **External changes** — The app watches `.git/HEAD` and `.git/index` for changes from external tools (command line, other editors)
3. **Manual refresh** — Click the refresh button (🔄) in the Git Diff panel header

---

## Tips

- **After committing**, the diff view automatically clears and returns to the normal file view
- **The diff view shows unstaged changes** (what `git diff` shows) — stage what you want, then commit
- If you close all tabs and reopen, the diff state is preserved
