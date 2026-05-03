import React, { createContext, useContext } from 'react';
import { ChatMessage } from '../../src/lib/agent';
import { SettingsState } from '../lib/types';

export interface ChatApi {
  getSettings: () => Promise<SettingsState>;
  updateSettings: (settings: SettingsState) => Promise<void>;
  listChatLogs: () => Promise<{ id: string, date: string, preview: string, lastModified: number }[]>;
  loadChatLog: (id: string, date: string) => Promise<ChatMessage[]>;
  saveChatLog: (id: string, messages: ChatMessage[]) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  getAvailableSkills: () => Promise<{ name: string, path: string, error?: string }[]>;
  getAvailableCommands: () => Promise<{ name: string, path: string, error?: string }[]>;
  getFiles: (dirPath: string) => Promise<{ path: string, name: string, isDirectory: boolean }[]>;
  runDirectCommand: (payload: { commandPath: string, params: string[], currentFile?: string }) => Promise<{ stdout: string, stderr: string, error?: string }>;
  requestApproval: (command: string, cwd: string) => Promise<boolean>;
}

const ChatMockContext = createContext<ChatApi | null>(null);

export const useChat = () => {
  const context = useContext(ChatMockContext);
  if (!context) throw new Error('useChat must be used within a ChatMockProvider');
  return context;
};

export const ChatMockProvider = ({ children, value }: { children: React.ReactNode, value: ChatApi }) => {
  return (
    <ChatMockContext.Provider value={value}>
      {children}
    </ChatMockContext.Provider>
  );
};
