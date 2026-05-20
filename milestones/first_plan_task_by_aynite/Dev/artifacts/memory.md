# Project Memory

## Shell Environment Fix (Login Shell)

**Context**: Shell commands run via `exec()` from `child_process` default to `/bin/sh -c`, which doesn't source the user's shell profile files (`.zprofile`, `.bash_profile`, etc.). This means tools like `node`, `npm`, Homebrew binaries etc. are not on the PATH.

**Fix**: Created `execInUserShell()` in `src/main/system/logic.ts` which:
- Detects the user's default shell from `process.env.SHELL`
- On Unix: runs commands through `$SHELL -l -c 'command'` — a login shell that sources profile files
- Uses proper single-quote escaping to prevent the outer shell from mangling the command
- On Windows: passes through unchanged

**Applied to**:
- `src/main/ai/tools.ts` — `run_command` AI tool
- `src/main/spells/index.ts` — `COMMAND_RUN` and `COMMAND_RUN_DIRECT` IPC handlers