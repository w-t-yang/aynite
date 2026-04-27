import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, Trash2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { SettingsState } from './Settings';

export default function ChatTab({ settings }: { settings: SettingsState }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    // Focus down to the latest message
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    // Keybinding focus hook
    (window as any).focusChatInput = () => {
      inputRef.current?.focus();
    };
    return () => {
      delete (window as any).focusChatInput;
    };
  }, []);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const provider = settings.aiProvider || 'gemini';
      
      if (provider === 'gemini' || provider === 'deepseek') {
         setTimeout(() => {
           setMessages(prev => [...prev, { role: 'model', text: `[WIP] The integration for ${provider} is currently a work in progress.` }]);
           setLoading(false);
         }, 500);
         return;
      }

      if (provider === 'ollama') {
        const url = settings.aiConfigs?.ollama?.url || 'http://localhost:11434';
        const model = settings.aiConfigs?.ollama?.model || 'deepseek-r1:14b';
        const contextWindow = settings.aiConfigs?.ollama?.contextWindow || 8192;
        
        const response = await fetch(`${url}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            messages: [...messages, { role: 'user', text: userMsg }].map(m => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.text
            })),
            options: {
              num_ctx: contextWindow
            }
          })
        });

        if (!response.ok) {
           throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        
        if (reader) {
          let fullText = '';
          while (true) {
             const { done, value } = await reader.read();
             if (done) break;
             const chunk = decoder.decode(value, { stream: true });
             const lines = chunk.split('\n');
             for (const line of lines) {
                if (line.trim()) {
                   try {
                     const parsed = JSON.parse(line);
                     if (parsed.message?.content) {
                       fullText += parsed.message.content;
                       setMessages(prev => {
                         const newMessages = [...prev];
                         newMessages[newMessages.length - 1] = { role: 'model', text: fullText };
                         return newMessages;
                       });
                     }
                   } catch (err) {
                     // ignore partial json
                   }
                }
             }
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-muted-foreground flex flex-col items-center justify-center h-full space-y-6">
            <Bot size={48} className="opacity-50" />
            <div className="space-y-3 text-sm opacity-80">
              <p className="flex items-center gap-3"><span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">Aa</span> Type any text to talk to AI</p>
              <p className="flex items-center gap-3"><span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">@</span> Tag any file to the content</p>
              <p className="flex items-center gap-3"><span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">/</span> Call any registered AI skill</p>
              <p className="flex items-center gap-3"><span className="w-6 h-6 rounded bg-accent shrink-0 flex items-center justify-center text-xs font-mono font-bold">&gt;</span> Call any registered command</p>
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
            )}
            
            <div className={`px-4 py-3 rounded-xl max-w-[85%] ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-accent/40 rounded-tl-none border border-border/50 text-foreground'
            }`}>
              {msg.role === 'model' ? (
                <div className="markdown-body prose prose-sm dark:prose-invert max-w-none break-words">
                  <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              )}
            </div>
            
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center shrink-0">
                <User size={18} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-4 max-w-4xl mx-auto justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
               <RefreshCw size={18} className="animate-spin" />
            </div>
          </div>
        )}
      </div>
      
      <div className="px-4 py-2 flex items-center justify-between border-t border-border bg-accent/5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          <Bot size={12} />
          <span>{settings.aiProvider || 'gemini'}</span>
          {settings.aiProvider === 'ollama' && (
             <span className="normal-case font-medium opacity-80 border-l border-border pl-2">
               {settings.aiConfigs?.ollama?.model || 'deepseek-r1:14b'}
             </span>
          )}
        </div>
        <button 
          onClick={() => setMessages([])}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-all text-[10px] font-medium"
        >
          <Trash2 size={12} />
          Clear History
        </button>
      </div>

      <div className="p-4 border-t border-border">
        <div className="max-w-4xl mx-auto relative flex items-end shadow-sm">
          <textarea 
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Type a message..."
            className="w-full bg-background border border-border rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[50px] max-h-48 resize-none transition-shadow disabled:opacity-50"
            rows={1}
          />
          <button 
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-400 rounded-lg transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
