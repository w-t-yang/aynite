export const SettingsMock = {
  getAppVersion: async () => "1.0.0-demo",
  
  // Update methods
  onUpdateChecking: (cb: () => void) => {
    console.log("Mock: onUpdateChecking");
    return () => {};
  },
  onUpdateAvailable: (cb: (info: any) => void) => {
    console.log("Mock: onUpdateAvailable");
    return () => {};
  },
  onUpdateNotAvailable: (cb: () => void) => {
    console.log("Mock: onUpdateNotAvailable");
    return () => {};
  },
  onUpdateError: (cb: () => void) => {
    console.log("Mock: onUpdateError");
    return () => {};
  },
  onUpdateProgress: (cb: (progress: any) => void) => {
    console.log("Mock: onUpdateProgress");
    return () => {};
  },
  onUpdateDownloaded: (cb: (info: any) => void) => {
    console.log("Mock: onUpdateDownloaded");
    return () => {};
  },
  checkUpdates: async () => {
    console.log("Mock: checkUpdates");
    return { data: true };
  },
  installUpdate: async () => {
    console.log("Mock: installUpdate");
  },

  // AI and Prompts
  getMergedSystemPrompt: async (files: string[], agentFiles: string[]) => {
    return { data: "This is a merged mock system prompt for demo purposes." };
  },
  restoreDefaultPrompts: async () => {
    return { 
      data: { 
        prompts: { files: [] },
        agents: { activeId: "default", list: [{ id: "default", name: "Default Agent", promptFiles: [] }] }
      } 
    };
  },
  pickPromptFile: async () => {
    return { data: "/mock/path/to/prompt.md" };
  },

  // Skills and Commands
  getAvailableSkills: async () => {
    return { data: [
      { name: "Code Analysis", description: "Analyzes code structure", path: "/skills/analysis", error: null },
      { name: "Web Search", description: "Searches the web for info", path: "/skills/search", error: null }
    ] };
  },
  pickSkillFolder: async () => {
    return { data: "/mock/path/to/skills" };
  },
  restoreDefaultSkills: async () => {
    return { data: true };
  },
  getAvailableCommands: async () => {
    return { data: [
      { name: "List Files", description: "ls -R", path: "/commands/ls" },
      { name: "Run Tests", description: "npm test", path: "/commands/test" }
    ] };
  },
  pickCommandFolder: async () => {
    return { data: "/mock/path/to/commands" };
  },
  restoreDefaultCommands: async () => {
    return { data: true };
  },

  // Tools
  getTools: async () => {
    return { data: [
      { id: "read_file", name: "Read File", description: "Read file content" },
      { id: "write_file", name: "Write File", description: "Write file content" },
      { id: "run_command", name: "Run Command", description: "Execute shell commands" }
    ] };
  },

  // Themes
  getThemesList: async () => {
    return { data: [
      { id: "nord", name: "Nord", colors: { background: "#2e3440", primary: "#88c0d0" }, isSystem: true },
      { id: "dracula", name: "Dracula", colors: { background: "#282a36", primary: "#bd93f9" }, isSystem: true }
    ] };
  },
  getTheme: async (id: string) => {
    return { data: {
      name: id === "nord" ? "Nord" : "Dracula",
      type: "dark",
      isSystem: true,
      colors: {
        background: id === "nord" ? "#2e3440" : "#282a36",
        foreground: id === "nord" ? "#d8dee9" : "#f8f8f2",
        primary: id === "nord" ? "#88c0d0" : "#bd93f9",
        border: id === "nord" ? "#3b4252" : "#44475a",
        accent: id === "nord" ? "#81a1c1" : "#ff79c6"
      },
      fonts: {
        fontFamily: "Inter",
        fontMono: "JetBrains Mono",
        fontSize: "14px"
      }
    } };
  },
  getSystemFonts: async () => {
    return { data: ["Inter", "Roboto", "JetBrains Mono", "Fira Code"] };
  },
  saveTheme: async (id: string, theme: any) => {
    console.log(`Mock: saveTheme ${id}`, theme);
    return { data: true };
  },
  restoreDefaultTheme: async (id: string) => {
    console.log(`Mock: restoreDefaultTheme ${id}`);
    return { data: true };
  },
  deleteTheme: async (id: string) => {
    console.log(`Mock: deleteTheme ${id}`);
    return { data: true };
  },

  // Misc
  openExternal: async (url: string) => {
    console.log(`Mock: openExternal ${url}`);
  }
};
