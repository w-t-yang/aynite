import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Bot, History, Settings, X, Calendar, Clock, AlertTriangle, Terminal, Folder, Check, Copy } from 'lucide-react';
import { ChatMessage } from '../../lib/types';
import { SettingsState } from '../../lib/types';
import { useChat } from '../../context/ChatMockContext';
import ChatInput, { ChatInputHandle } from '../../featured/ChatInput';
import { ChatMessageItem } from '../../featured/advanced/ChatMessage';
import { SelectionPopover } from '../../featured/SelectionPopover';
import { Button } from '../../basic/Button';
import { Modal } from '../../basic/Modal';
import { SelectionList } from '../../basic/SelectionList';
import { cn } from '../../lib/utils';

interface AIChatPageProps {
  activeTabPath?: string;
  workspaceFolders?: string[];
  onOpenFile?: (file: { name: string; path: string, isDirectory: boolean }, content: string) => void;
}

export function AIChatPage({ activeTabPath, workspaceFolders = [], onOpenFile }: AIChatPageProps) {
  const aynite = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-0',
      role: 'system',
      content: '# About Me\nYou are Aynite, an AI assistant.\n\n## Behavioral Guidelines\n\n### 1. Think Before Coding\n**Don\'t assume. Don\'t hide confusion. Surface tradeoffs.**\nBefore implementing:\n- State your assumptions explicitly. If uncertain, ask.\n- If multiple interpretations exist, present them - don\'t pick silently.\n- If a simpler approach exists, say so. Push back when warranted.\n- If something is unclear, stop. Name what\'s confusing. Ask.\n\n### 2. Simplicity First\n**Minimum code that solves the problem. Nothing speculative.**\n- No features beyond what was asked.\n- No abstractions for single-use code.\n- No "flexibility" or "configurability" that wasn\'t requested.\n- No error handling for impossible scenarios.\n- If you write 200 lines and it could be 50, rewrite it.\nAsk yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.\n\n### 3. Surgical Changes\n**Touch only what you must. Clean up only your own mess.**\nWhen editing existing code:\n- Don\'t "improve" adjacent code, comments, or formatting.\n- Don\'t refactor things that aren\'t broken.\n- Match existing style, even if you\'d do it differently.\n- If you notice unrelated dead code, mention it - don\'t delete it.\nWhen your changes create orphans:\n- Remove imports/variables/functions that YOUR changes made unused.\n- Don\'t remove pre-existing dead code unless asked.\n\n### 4. Goal-Driven Execution\n**Define success criteria. Loop until verified.**\nTransform tasks into verifiable goals:\n- "Add validation" → "Write tests for invalid inputs, then make them pass"\n- "Fix the bug" → "Write a test that reproduces it, then make it pass"\n- "Refactor X" → "Ensure tests pass before and after"\nFor multi-step tasks, state a brief plan:\n```\n1. [Step] → verify: [check]\n2. [Step] → verify: [check]\n3. [Step] → verify: [check]\n```\n\nStrong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.'
    },
    {
      id: 'msg-1',
      role: 'user',
      content: 'read file @file[Welcome.md](/home/wentao/.aynite/aynite-playbook/Welcome.md)'
    },
    {
      id: 'msg-2',
      role: 'assistant',
      thinking: 'The user wants to see the welcome document. I should read the file to provide its content.',
      content: 'I will read the `Welcome.md` file for you.',
      tool_calls: [
        {
          id: 'call_1',
          toolName: 'read_file',
          args: { path: '/home/wentao/.aynite/aynite-playbook/Welcome.md' }
        }
      ]
    },
    {
      id: 'msg-3',
      role: 'tool',
      name: 'read_file',
      tool_call_id: 'call_1',
      content: '# Welcome to Aynite! 👋\n\n**A.Y.N.I.T.E — All You Need Is The Editor.**\n\nSeriously. That\'s the whole idea.\n\nAynite is not just another AI coding tool bolted onto a chat window. It\'s a belief: the editor itself should be the interface to everything — AI, scripts, APIs, automations, your entire digital toolchain.\n\n## ✨ Showcase\n\n### 🔮 [Trading Showcase](./showcase/trading/README.md)\n\n| Command | What It Does |\n| :--- | :--- |\n| `> stock-fetch --symbol AAPL` | Fetches 1 year of daily stock data |\n| `> stock-view --file AAPL.json` | Generates an interactive HTML chart |'
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: 'Here is the content of the `Welcome.md` file. It explains the Aynite philosophy and showcases some built-in capabilities like the Trading Showcase.'
    },
    {
      id: 'msg-5',
      role: 'user',
      content: '>cmd[stock-fetch](/home/wentao/repos/aynite-spells/commands/stock/stock-fetch)'
    },
    {
      id: 'msg-6',
      role: 'tool',
      name: 'stock-fetch',
      content: '{\n  "status": "error",\n  "error": "Missing required parameter: --symbol",\n  "usage": {\n    "description": "Fetch stock market data from Yahoo Finance and save as JSON.",\n    "syntax": "> stock-fetch --symbol <TICKER> [options]",\n    "required": [\n      {\n        "name": "--symbol",\n        "description": "Stock ticker symbol (e.g., AAPL, GOOGL, TSLA)"\n      }\n    ]\n  }\n}'
    },
    {
      id: 'msg-7',
      role: 'assistant',
      content: 'It seems you missed the `--symbol` parameter. You can run it like this:\n\n```bash\n> stock-fetch --symbol AAPL\n```'
    },
    {
      id: 'msg-8',
      role: 'user',
      content: 'I want to automate Instagram media extraction. I want to be able to fetch pictures from a list of accounts and view them in a gallery. No login.'
    },
    {
      id: 'msg-9',
      role: 'assistant',
      thinking: 'Automating Instagram media extraction without login is tricky because Instagram blocks most scrapers. I should look for tools or APIs that still work. instaloader is a popular library, but it often hits 403 errors. I should also check if there is a public web API endpoint.',
      content: '<think>Searching for Instagram scraping methods that do not require login.</think>I will research the best way to fetch Instagram media without requiring a login.',
      tool_calls: [
        {
          id: 'call_2',
          toolName: 'search_web',
          args: { query: 'instagram media extraction without login python instaloader' }
        }
      ]
    },
    {
      id: 'msg-10',
      role: 'tool',
      name: 'search_web',
      tool_call_id: 'call_2',
      content: 'Results suggest using `instaloader` with specific flags or using the `web_profile_info` endpoint with proper headers (User-Agent, X-IG-App-ID).'
    },
    {
      id: 'msg-11',
      role: 'assistant',
      thinking: 'I will try to install instaloader first. If that fails or gets blocked, I will fall back to manual curl requests using the web API endpoint.',
      content: '<think>Trying to install instaloader to test its capability.</think>I will try to install `instaloader` to see if it works for public profiles.',
      tool_calls: [
        {
          id: 'call_3',
          toolName: 'run_command',
          args: { command: 'pip install instaloader' }
        }
      ]
    },
    {
      id: 'msg-12',
      role: 'tool',
      name: 'run_command',
      tool_call_id: 'call_3',
      content: 'error: externally-managed-environment\n\n× This environment is externally managed\n╰─> To install Python packages system-wide, try apt install python3-xyz...'
    },
    {
      id: 'msg-13',
      role: 'assistant',
      thinking: 'The environment is managed, so I should use pipx to install instaloader in an isolated environment.',
      content: 'I will use `pipx` to install `instaloader` in an isolated environment.',
      tool_calls: [
        {
          id: 'call_4',
          toolName: 'run_command',
          args: { command: 'pipx install instaloader' }
        }
      ]
    },
    {
      id: 'msg-14',
      role: 'tool',
      name: 'run_command',
      tool_call_id: 'call_4',
      content: '  installed package instaloader 4.10.1, installed executable instaloader\nDone! ✨'
    },
    {
      id: 'msg-15',
      role: 'assistant',
      content: 'Now that `instaloader` is installed, I will try to fetch some posts from @natgeo.',
      tool_calls: [
        {
          id: 'call_5',
          toolName: 'run_command',
          args: { command: 'instaloader --count 3 natgeo' }
        }
      ]
    },
    {
      id: 'msg-16',
      role: 'tool',
      name: 'run_command',
      tool_call_id: 'call_5',
      content: 'Retrieving profile natgeo...\nErrors occurred:\n403 Forbidden'
    },
    {
      id: 'msg-17',
      role: 'assistant',
      thinking: 'Instaloader is being blocked with a 403 error. This is common. I will try the manual approach using `curl` and the `web_profile_info` API endpoint with headers that mimic a browser.',
      content: 'It seems `instaloader` is being blocked. I will try a more surgical approach using the Instagram web API directly.',
      tool_calls: [
        {
          id: 'call_6',
          toolName: 'run_command',
          args: { command: 'curl -s "https://www.instagram.com/api/v1/users/web_profile_info/?username=natgeo" -H "User-Agent: Mozilla/5.0" -H "X-IG-App-ID: 936619743392459"' }
        }
      ]
    },
    {
      id: 'msg-18',
      role: 'tool',
      name: 'run_command',
      tool_call_id: 'call_6',
      content: '{"data":{"user":{"id":"12345","username":"natgeo","edge_owner_to_timeline_media":{"edges":[{"node":{"display_url":"https://scontent...","shortcode":"ABCDE"}}]}}}}'
    },
    {
      id: 'msg-19',
      role: 'assistant',
      thinking: 'The API response works! I have the post data. Now I can build the full command that fetches a list of accounts and generates an HTML gallery.',
      content: '<think>Success! I can now implement the full command logic.</think>The API works! I am now creating the `instagram-view` command.',
      tool_calls: [
        {
          id: 'call_7',
          toolName: 'write_file',
          args: { 
            path: '/home/wentao/repos/aynite-spells/commands/social/instagram-view/scripts/generate.py',
            content: '#!/usr/bin/env python3\n# Instagram generator script...' 
          }
        }
      ]
    },
    {
      id: 'msg-20',
      role: 'tool',
      name: 'write_file',
      tool_call_id: 'call_7',
      content: 'Successfully wrote to /home/wentao/repos/aynite-spells/commands/social/instagram-view/scripts/generate.py'
    },
    {
      id: 'msg-21',
      role: 'user',
      content: '>cmd[instagram-view](/home/wentao/repos/aynite-spells/commands/social/instagram-view) --file @file[accounts.txt](accounts.txt)'
    },
    {
      id: 'msg-22',
      role: 'tool',
      name: 'instagram-view',
      content: 'Fetching @natgeo...\n  Error: HTTP Error 401: Unauthorized\nFetching @nasa...\n  Error: HTTP Error 401: Unauthorized\n\n{\n  "status": "ok",\n  "accounts_fetched": 0,\n  "accounts_failed": 2,\n  "errors": [\n    {"username": "natgeo", "error": "Instagram rate limit hit. Try again in a few minutes."}\n  ]\n}'
    },
    {
      id: 'msg-23',
      role: 'assistant',
      thinking: 'We\'ve been rate-limited. Instagram detected the rapid requests and is returning 401 Unauthorized with a "Please wait" message.',
      content: 'It seems we have hit Instagram\'s rate limit. We should wait a few minutes before trying again.'
    },
    {
      id: 'msg-24',
      role: 'user',
      content: 'the command has a problem, it should fetch all profiles in the file, not only 5'
    },
    {
      id: 'msg-25',
      role: 'agent' as any,
      content: 'This is a message from an unknown role type to demonstrate fallback rendering logic in the chat interface.'
    }
  ]);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);

  useEffect(() => {
    aynite.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const loadSessions = async () => {
    const res = await aynite.listChatLogs();
    setSessions(res);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Mock response for now, real implementation would call aynite.sendMessage or similar
      // but the user wants mock data.
      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I've received your message. This is a mock response in the standalone Chat view."
        };
        setMessages(prev => [...prev, assistantMsg]);
        setLoading(false);
      }, 1000);
    } catch (e) {
      setLoading(false);
    }
  };

  if (!settings) return <div className="p-8 text-muted-foreground">Loading settings...</div>;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Header */}
      <div className="h-12 border-b border-border/40 flex items-center justify-between px-4 shrink-0 bg-background/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-widest text-foreground/80">Aynite AI</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight opacity-60">Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { loadSessions(); setShowHistory(true); }}
            title="History"
            className="text-muted-foreground hover:text-foreground"
          >
            <History size={18} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 gap-4">
            <Bot size={64} strokeWidth={1} />
            <p className="text-sm font-medium uppercase tracking-widest">Start a conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessageItem
              key={msg.id || idx}
              msg={msg}
              idx={idx}
              total={messages.length}
              onOpenFile={async (path: string) => {
                const content = await aynite.readFile(path);
                onOpenFile?.({ name: path.split(/[/\\]/).pop() || path, path, isDirectory: false }, content);
              }}
              onCopy={(content: string) => navigator.clipboard.writeText(content)}
              settings={settings}
            />
          ))
        )}
        {loading && (
          <div className="max-w-4xl mx-auto flex items-center gap-3 text-muted-foreground animate-pulse">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <Bot size={14} />
            </div>
            <span className="text-xs font-medium uppercase tracking-widest">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            ref={inputRef}
            onSubmit={handleSendMessage}
            disabled={loading}
            workspaceFolders={workspaceFolders}
            getFiles={aynite.getFiles}
            getAvailableSkills={aynite.getAvailableSkills}
            getAvailableCommands={aynite.getAvailableCommands}
          />
        </div>
      </div>

      <Modal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title="Chat Sessions"
        size="lg"
      >
        <div className="flex-1 overflow-y-auto">
          <SelectionList
            items={sessions.map(s => ({
              id: s.id,
              label: `Session ${s.id.slice(-6)}`,
              subtitle: s.preview || "No content",
              badge: new Date(s.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              icon: (
                <div className="w-8 h-8 rounded bg-muted flex flex-col items-center justify-center text-[8px] font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors shrink-0">
                  <Calendar size={10} className="mb-0.5" />
                  {s.date.split('-').slice(1).join('/')}
                </div>
              ),
              date: s.date // Keep for handler
            }))}
            selectedIndex={-1}
            onSelect={(item) => {
              aynite.loadChatLog(item.id, item.date).then(setMessages);
              setSessionId(item.id);
              setShowHistory(false);
            }}
            itemClassName="py-4 border-b border-border/10 last:border-0"
          />
        </div>
      </Modal>
    </div>
  );
}
