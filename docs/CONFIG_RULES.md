# Aynite Configuration Rules

## Directory Structure
The base configuration directory depends on the operating system:
- **Mac/Linux**: `~/.aynite`
- **Windows**: `%AppData%/aynite`

Within this base directory, there is a sub-folder named `config` containing the specialized configuration files.

## Configuration Files
The `config/` directory contains the following JSON files:

- **ai.json**: Stores AI provider selection and specific provider configurations (API keys, URLs, models).
- **appearance.json**: Stores theme settings (dark, light, nord, solarized).
- **keybindings.json**: Stores all keyboard shortcuts for global actions, view mode, and edit mode.
- **workspaces.json**: Stores the list of registered workspaces and the currently active one.
- **config.json**: Stores general application-wide configuration state.

## Saving Rules
When settings are updated, they are synchronized across their respective specialized files:
1. AI settings are updated in `ai.json`.
2. Theme/Appearance settings are updated in `appearance.json`.
3. Shortcuts are updated in `keybindings.json`.
4. Global application state is updated in `config.json`.
