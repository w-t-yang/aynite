# AI Agent Improvements — Roadmap

This document tracks the AI Agent features implemented and planned for Aynite.

## ✅ Completed (v0.2)

### Rich Chat Input (Tiptap)
- Replaced plain `<textarea>` with a Tiptap-based rich text editor.
- Three mention triggers with autocomplete popup:
  - `@` → workspace files and folders (populated recursively from registered workspace paths)
  - `/` → AI skills (dummy: `review`, `summarize`, `translate`, `outline`, `explain`)
  - `>` → commands (dummy: `build`, `test`, `lint`, `format`, `dev`)
- Submit on Enter, Shift+Enter for newline.
- Mention tokens rendered as colored inline tags (blue for files, purple for skills, yellow for commands).

### Agentic Tool Calling (Ollama)
- Agent loop implemented in `src/renderer/src/lib/agent.ts`.
- Uses Ollama's native `/api/chat` endpoint with `tools` parameter.
- Four built-in tools:
  - `read_file` — reads a file within the workspace
  - `write_file` — writes/creates a file within the workspace
  - `list_files` — lists directory contents within the workspace
  - `run_command` — executes a shell command (requires user approval)
- Iterative loop: model can call tools multiple times before producing a final answer (max 10 iterations).
- System prompt establishes Aynite as an assistant.

### Security & Permissions
- **Path validation**: All file operations validate that the target path resolves within registered workspace folders. Requests outside the workspace are rejected with an error.
- **Command approval**: Shell commands are never auto-executed. An inline approval modal appears in the chat. The agent loop pauses until user clicks Approve or Reject.

### Chat UI
- Collapsible tool call steps visible in model messages (shows tool name, arguments, and results).
- Status bar showing active AI backend and model name.
- Clear History button to reset conversation.
- Streaming text response from Ollama.

---

## 🔮 Planned Improvements

### Input Enhancements
- [ ] Auto-resize input height based on content
- [ ] Keyboard shortcut to focus chat input (Ctrl+Y already wired)
- [ ] Persist chat history across sessions (save to workspace state)
- [ ] Multi-file `@` selection (select multiple files in one message)

### Agent Capabilities
- [ ] Load skills from `~/.aynite/skills/` directory (markdown-based skill definitions)
- [ ] Load commands from `~/.aynite/commands/` directory
- [ ] Context-aware system prompt (include open file content, cursor position)
- [ ] Support for Gemini and DeepSeek backends (currently WIP stubs)
- [ ] Agent memory: persist important facts across conversations
- [ ] Multi-step task planning with progress tracking

### Tool Improvements
- [ ] `search_files` tool — grep/ripgrep across workspace
- [ ] `edit_file` tool — surgical edits (find & replace) instead of full file writes
- [ ] `open_file` tool — open a file in the editor tab
- [ ] `create_directory` tool — create nested directory structures
- [ ] Streaming tool results for long-running commands

### Model Support
- [ ] Auto-detect tool-calling support per model
- [ ] Warning when selected model doesn't support function calling (e.g., DeepSeek-R1)
- [ ] Model switching mid-conversation
- [ ] Support for OpenAI-compatible endpoints

### UI/UX
- [ ] Syntax-highlighted code blocks in chat with copy button
- [ ] File diff view when agent writes/modifies files
- [ ] Token usage display per message
- [ ] Conversation branching (fork from any message)
- [ ] Export conversation as markdown
