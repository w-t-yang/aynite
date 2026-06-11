# Roadmap

Prioritized by importance. Done items are at the bottom.

---

## Release & Polish

- [x] macOS code signing pipeline — entitlements, CI cert import, notarization config
- [x] Docs — README, project wiki, showcase
- [/] Welcome workspace with settings and theme demo
- [ ] Language / i18n support
- [x] Track usage
- [-] Collect feedback
- [ ] Logo
- [ ] Update
- [x] Domain name

## Promotion

- [ ] Investigate success stories
- [ ] Plan promotion
- [ ] Build community

## Agent

- [ ] Advanced agent features
- [ ] RAG (Retrieval-Augmented Generation)
- [ ] Tools section — include skills and tasks in tool management
- [x] Make sure read/write/edit file only works on text files, not binaries
- [ ] When updating memory, update session metadata with title and description
- [ ] Support uploading files
- [ ] Ensure session/task/plan/memory are bound to workspace from chat view/tools (fix multi-window issues with different workspaces/sessions)

## Chat View

- [ ] Stream writing/editing for large files
- [x] Improve block display — e.g. grep function name, line break handling

## Editor

- [ ] Markdown and HTML link support
- [ ] More advanced editing features

## Files

- [ ] File sync
- [ ] More file type support

## Dataview

- [ ] Improve dataviews in the future
- [ ] HTML view and markdown view (and maybe more views) should be moved to dataview

## File Browser

- [ ] More file types

## Workspace View

- [ ] Rename session (maybe rename when updating memory)

## Switcher

- [ ] Search text from workspace files
- [ ] Index images/audios/videos and support search

## Spells / Extensions

- [ ] Spell registry, discovery

## Aynite Spells — Files

- [ ] Notes, knowledge base, memory
- [ ] PDF to markdown — using MS open source project as command
- [ ] Video support
- [ ] Image support
- [ ] Slides — Node.js, slides to video
- [ ] Spreadsheets, tables

## Integration

- [ ] Instagram
- [ ] Email
- [ ] Slack, Discord
- [ ] Google Drive
- [ ] Figma
- [ ] NotebookLM

## Config

- [ ] AI Backend — other API key connections (beyond the tested providers)
- [ ] Key binding — advanced customization

## Logs

- [ ] Dev log — remove current key trigger logs and ollama call request logs from console, put them into the dev log

## Git

- [ ] Other git functions (beyond basic review and commit)

---

## ✅ Done

### Config — AI Backend
- [x] Ollama connection
- [x] Gemini connection
- [x] DeepSeek connection
- [x] Claude
- [x] OpenAI

### Config — Key Binding
- [x] Basics

### Agent
- [x] Calling tools
- [x] Tag files and folders
- [x] Artifact files — tasks, plans, temporary scripts, etc.
- [x] How to access files — system prompt, memory, artifacts
- [x] Memory
- [x] Plan

### Git
- [x] Tree view
- [x] File state
- [x] View diff

### Editor
- [x] Syntax highlighting
- [x] Markdown smart editing (e.g. auto indent)

### Spells
- [x] System prompts
- [x] Commands — add default commands (stock-fetch)
- [x] Skills — add default skills (create-skill, create-command)
- [x] Config to maintain a list of folders for skills and commands

### File Browser
- [x] Basic key bindings — save, search

### Logs
- [x] Conversation history

### Aynite Spells — Files
- [x] Mindmap

### Aynite Spells — Data
- [x] Stock chart

### Integration
- [x] RSS
- [x] Spotify

### Before First Release
- [x] Docs / wiki (initial version)
- [x] Default workspaces — including demonstrating RSS, Spotify
