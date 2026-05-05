import React, { createContext, useContext, useMemo } from 'react';

export const SettingsMock = {
  getAppVersion: async () => {
    return "1.0.0-beta.6";
  },

  // Resource: Themes
  getThemes: async () => {
    return {
      list: [
        { id: "nord", name: "Nord", type: "dark", isSystem: true, colors: { background: "#2e3440", foreground: "#d8dee9", primary: "#88c0d0", border: "#3b4252", accent: "#81a1c1" }, fonts: { sans: "Inter", mono: "JetBrains Mono" } },
        { id: "dracula", name: "Dracula", type: "dark", isSystem: true, colors: { background: "#282a36", foreground: "#f8f8f2", primary: "#bd93f9", border: "#44475a", accent: "#ff79c6" }, fonts: { sans: "Inter", mono: "JetBrains Mono" } }
      ],
      activeId: "nord",
      systemFonts: ["Inter", "Roboto", "JetBrains Mono", "Fira Code", "Open Sans", "Montserrat"]
    };
  },
  setThemes: async (payload: any) => {
    console.log("Mock: setThemes", payload);
    return true;
  },

  // Resource: Keybindings
  getKeybindings: async () => {
    return {
      list: {
        global: { refresh: "CmdOrCtrl+R", quit: "CmdOrCtrl+Q" },
        explorer: { toggleLeftPanel: "CmdOrCtrl+B" },
        agent: { focusChat: "CmdOrCtrl+L", focusSkills: "CmdOrCtrl+/", focusCommands: "CmdOrCtrl+Shift+P", submit: "CmdOrCtrl+Enter", toggleRightPanel: "CmdOrCtrl+J" },
        content: {
          navigation: { switchTab: "CmdOrCtrl+Tab", closeTab: "CmdOrCtrl+W", focusContent: "CmdOrCtrl+0" },
          viewer: { enterEdit: "i", moveDown: "j", moveUp: "k", moveLeft: "h", moveRight: "l", search: "/", refresh: "r" },
          generic: { exitEdit: "Escape", selectAll: "CmdOrCtrl+A", deleteForward: "Delete", cut: "CmdOrCtrl+X", copy: "CmdOrCtrl+C", paste: "CmdOrCtrl+V", startOfLine: "CmdOrCtrl+Left", endOfLine: "CmdOrCtrl+Right", killLine: "CmdOrCtrl+K", prevLine: "Up", nextLine: "Down", forwardChar: "Right", backwardChar: "Left" }
        }
      }
    };
  },
  setKeybindings: async (payload: any) => {
    console.log("Mock: setKeybindings", payload);
    return true;
  },

  // Resource: AI Instances (Providers)
  getAI: async () => {
    return {
      activeId: "openai-1",
      list: [
        { id: "openai-1", name: "OpenAI", provider: "openai", url: "https://api.openai.com/v1", apiKey: "sk-...", model: "gpt-4o" },
        { id: "anthropic-1", name: "Anthropic", provider: "anthropic", url: "https://api.anthropic.com/v1", apiKey: "sk-ant-...", model: "claude-3-5-sonnet-20240620" }
      ]
    };
  },
  setAI: async (payload: any) => {
    console.log("Mock: setAI", payload);
    return true;
  },

  // Resource: Agents
  getAgents: async () => {
    return {
      activeId: "coder",
      list: [
        { id: "coder", name: "Coder Agent", promptFiles: ["/home/user/prompts/coder_rules.md"] },
        { id: "writer", name: "Writer Agent", promptFiles: ["/home/user/prompts/creative_writing.md"] }
      ]
    };
  },
  setAgents: async (payload: any) => {
    console.log("Mock: setAgents", payload);
    return true;
  },

  // Resource: Prompts
  getPrompts: async () => {
    return {
      list: [
        "/home/user/prompts/global_rules.md",
        "/home/user/prompts/project_context.md"
      ],
      available: [
        "system_defaults/basic_coding.md",
        "system_defaults/security_audit.md"
      ]
    };
  },
  setPrompts: async (payload: any) => {
    console.log("Mock: setPrompts", payload);
    return true;
  },

  // Resource: Skills
  getSkills: async () => {
    return {
      list: ["/home/user/skills/general", "/home/user/skills/advanced"],
      items: [
        { name: "Code Analysis", description: "Deeper understanding of code structures.", path: "/home/user/skills/general/code_analysis.py" },
        { name: "UI Design", description: "Helper for creating beautiful interfaces.", path: "/home/user/skills/advanced/ui_design.ts", error: "Missing dependency: tailwind-merge" }
      ]
    };
  },
  setSkills: async (payload: any) => {
    console.log("Mock: setSkills", payload);
    return true;
  },

  // Resource: Commands
  getCommands: async () => {
    return {
      list: ["/home/user/commands/utilities"],
      items: [
        { name: "Git Cleanup", description: "Removes merged local branches.", path: "/home/user/commands/utilities/cleanup.sh" },
        { name: "Docker Prune", description: "Cleans up unused docker images and containers.", path: "/home/user/commands/utilities/prune.sh" }
      ]
    };
  },
  setCommands: async (payload: any) => {
    console.log("Mock: setCommands", payload);
    return true;
  },

  // Resource: Tools
  getTools: async () => {
    return {
      list: [
        { id: "web-search", name: "Web Search", description: "Search the web for information." },
        { id: "file-editor", name: "File Editor", description: "Read and write local files." },
        { id: "terminal", name: "Terminal Access", description: "Execute shell commands directly." }
      ],
      active: { "web-search": true, "file-editor": true, "terminal": false }
    };
  },
  setTools: async (payload: any) => {
    console.log("Mock: setTools", payload);
    return true;
  },

  // Misc
  checkForUpdates: async () => {
    console.log("Mock: checkForUpdates");
  },
  openExternal: async (url: string) => {
    console.log(`Mock: openExternal ${url}`);
  }
};

const MockViewContext = createContext<any>(SettingsMock);

/**
 * Hook for accessing the Aynite API
 */
export const useAynite = () => {
  const context = useContext(MockViewContext);
  if (!context) throw new Error('useAynite must be used within a MockViewProvider');
  return context;
};

export const MockViewProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <MockViewContext.Provider value={SettingsMock}>
      {children}
    </MockViewContext.Provider>
  );
};
