# Implementation Plan

## 1. Problem Statement
When running shell commands via exec() from node:child_process, Node.js uses /bin/sh -c by default, which does NOT source the user's shell profile files (.zshrc, .bashrc, .bash_profile, .zprofile). This means tools like node, npm, nvm, homebrew binaries etc. are not on the PATH because they require the user's shell initialization to set up environment variables. Users have to manually set up PATH in every command.

## 2. Investigation Results
Three locations use execAsync (promisified exec) for running user-provided shell commands:

1. src/main/ai/tools.ts - the run_command AI tool (~line 80):
   const { stdout, stderr } = await execAsync(command, { cwd: runCwd })
   This is the primary path — AI invokes run_command tool.

2. src/main/spells/index.ts - the COMMAND_RUN handler (~line 48):
   const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() })
   This handles `>cmd[name](path)` syntax in chat.

3. src/main/spells/index.ts - the COMMAND_RUN_DIRECT handler (~line 59):
   const { stdout, stderr } = await execAsync(fullCmd, { cwd: commandPath, env })
   This runs run.sh files directly. It already passes env but still uses the default /bin/sh.

All three use exec which defaults to /bin/sh -c on Unix — a non-interactive, non-login shell that doesn't source user profile files.

src/main/system/logic.ts also uses execAsync but only for fc-list (system font listing), which is a system binary — no fix needed there.

The helper execAsync is defined locally in each file (not shared), so the fix needs to be applied in each location or a shared utility should be created.

## 3. Proposed Architecture & Trade-offs
Approach: On Unix (macOS/Linux), detect the user's default shell from process.env.SHELL and run commands through it as a login shell (-l flag). This causes the shell to source profile files (~/.zprofile, ~/.bash_profile, ~/.profile) where PATH and other environment variables are typically configured.

How it works:
- Detect shell: process.env.SHELL || '/bin/zsh' (macOS default) or /bin/bash (Linux fallback)
- Wrap the user command: ${userShell} -l -c '${escapedCommand}'
- The outer default /bin/sh interprets this string and spawns the user's login shell
- The login shell sources profile files, then executes the user's command

Escape strategy: Single-quote the user's command to prevent the outer /bin/sh from expanding variables/glob patterns. Escape any single quotes inside the command using the standard shell pattern: replace single-quote with the sequence: single-quote, backslash, single-quote, single-quote.

Windows: No change needed — exec uses cmd.exe on Windows which is the expected behavior.

Implementation: Create a shared helper execInUserShell() in a utility location (src/main/system/logic.ts), then apply it to all three call sites.

## 4. Implementation Steps
1. Create execInUserShell() helper in src/main/system/logic.ts that detects user's shell and runs commands through it as a login shell on Unix.
2. Update src/main/ai/tools.ts run_command tool to use execInUserShell instead of bare execAsync.
3. Update src/main/spells/index.ts COMMAND_RUN handler to use execInUserShell instead of bare execAsync.
4. Update src/main/spells/index.ts COMMAND_RUN_DIRECT handler to use execInUserShell instead of bare execAsync.
5. Run TypeScript type check (npx tsc --noEmit) to verify no compilation errors.
6. Run electron-vite build to verify the build succeeds.

## 5. Verification Plan
1. Run npx tsc --noEmit to ensure no type errors.
2. Run npm run build to verify the build succeeds.
3. Smoke test: run_command with 'node --version' should work without PATH setup.
4. Smoke test: run_command with 'npm --version' should work without PATH setup.
5. Smoke test: COMMAND_RUN_DIRECT with a run.sh that uses node should work.

## 6. Open Questions & Assumptions
- -l (login shell) sources .zprofile/.bash_profile but NOT .zshrc/.bashrc. Some users put PATH in .zshrc (interactive shell config). Should we also explore using -i (interactive) or -il (both)? Trade-off: -i could cause prompt/color artifacts in output. Using -l is the safer default — users who need .zshrc sourced can symlink or source it from .zprofile.