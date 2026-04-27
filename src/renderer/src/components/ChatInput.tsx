import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import tippy, { Instance as TippyInstance } from 'tippy.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface ChatInputHandle {
  focus: () => void;
}

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  workspaceFolders?: string[];
}

// Real registries will be loaded via API

// ─── Suggestion List Component ───────────────────────────────────────

interface SuggestionListProps {
  items: { id: string; label: string }[];
  command: (item: { id: string; label: string }) => void;
  triggerChar: string;
}

interface SuggestionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const SuggestionList = forwardRef<SuggestionListHandle, SuggestionListProps>(
  ({ items, command, triggerChar }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (items[selectedIndex]) {
            command(items[selectedIndex]);
          }
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="suggestion-list bg-sidebar border border-border rounded-lg shadow-xl p-2 text-xs text-muted-foreground">
          No results
        </div>
      );
    }

    const icon = triggerChar === '@' ? '📄' : triggerChar === '/' ? '⚡' : '▶';
    const label = triggerChar === '@' ? 'Files' : triggerChar === '/' ? 'Skills' : 'Commands';

    return (
      <div className="suggestion-list bg-sidebar border border-border rounded-lg shadow-xl overflow-hidden min-w-[200px] max-w-[360px]">
        <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/30">
          {icon} {label}
        </div>
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`w-full text-left px-3 py-1.5 text-sm truncate transition-colors ${
              index === selectedIndex
                ? 'bg-blue-500/15 text-blue-400'
                : 'text-foreground hover:bg-accent/50'
            }`}
            onClick={() => command(item)}
          >
            <span className="font-mono text-[10px] opacity-50 mr-1.5">{triggerChar}</span>
            {item.label}
          </button>
        ))}
      </div>
    );
  }
);

SuggestionList.displayName = 'SuggestionList';

// ─── Suggestion utility (shared across triggers) ─────────────────────

function createSuggestion(
  triggerChar: string,
  getItems: (query: string) => { id: string; label: string }[]
) {
  return {
    char: triggerChar,
    items: ({ query }: { query: string }) => {
      return getItems(query.toLowerCase());
    },
    render: () => {
      let component: ReactRenderer<SuggestionListHandle> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(SuggestionList, {
            props: { ...props, triggerChar },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            offset: [0, 4],
          });
        },
        onUpdate: (props: any) => {
          component?.updateProps({ ...props, triggerChar });
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect });
          }
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return (component?.ref as SuggestionListHandle)?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}

// ─── File tree flattening utility ────────────────────────────────────

async function flattenWorkspaceFiles(
  folders: string[],
  maxDepth: number = 3
): Promise<{ id: string; label: string }[]> {
  const results: { id: string; label: string }[] = [];

  const walk = async (dir: string, depth: number, rootFolder: string) => {
    if (depth > maxDepth) return;
    try {
      // @ts-ignore
      const res = await window.api.getFiles(dir);
      if (res.error || !res.data) return;
      for (const file of res.data) {
        const relativePath = file.path.replace(rootFolder, '').replace(/^[/\\]/, '');
        results.push({ id: file.path, label: relativePath });
        if (file.isDirectory && depth < maxDepth) {
          await walk(file.path, depth + 1, rootFolder);
        }
      }
    } catch {
      // ignore errors
    }
  };

  for (const folder of folders) {
    results.push({ id: folder, label: folder.split(/[/\\]/).pop() || folder });
    await walk(folder, 1, folder);
  }

  return results;
}

// ─── Main ChatInput Component ────────────────────────────────────────

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ onSubmit, disabled, workspaceFolders = [] }, ref) => {
    const [fileItems, setFileItems] = useState<{ id: string; label: string }[]>([]);
    const [skillItems, setSkillItems] = useState<{ id: string; label: string }[]>([]);
    const [commandItems, setCommandItems] = useState<{ id: string; label: string }[]>([]);

    const fileItemsRef = React.useRef<{ id: string; label: string }[]>([]);
    const skillItemsRef = React.useRef<{ id: string; label: string }[]>([]);
    const commandItemsRef = React.useRef<{ id: string; label: string }[]>([]);

    // Load workspace files for @ suggestions
    useEffect(() => {
      if (workspaceFolders.length > 0) {
        flattenWorkspaceFiles(workspaceFolders).then((items) => {
          fileItemsRef.current = items;
          setFileItems(items);
        });
      }
      
      // Load skills and commands
      // @ts-ignore
      window.api.getAvailableSkills().then((res: any) => {
        if (res.data) {
          const items = res.data.map((s: any) => ({ id: s.path, label: s.name }));
          skillItemsRef.current = items;
          setSkillItems(items);
        }
      });
      // @ts-ignore
      window.api.getAvailableCommands().then((res: any) => {
        if (res.data) {
          const items = res.data.map((c: any) => ({ id: c.path, label: c.name }));
          commandItemsRef.current = items;
          setCommandItems(items);
        }
      });
    }, [workspaceFolders]);
    
    useImperativeHandle(ref, () => ({
      focus: () => {
        editor?.commands.focus();
      }
    }));
    
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder: 'Message Citron… (@ files, / skills, > commands)',
        }),
        Mention.configure({
          HTMLAttributes: { class: 'mention mention-file' },
          suggestion: createSuggestion('@', (query) =>
            fileItemsRef.current.filter((item) => item.label.toLowerCase().includes(query)).slice(0, 10)
          ),
        }),
        Mention.extend({ name: 'skillMention' }).configure({
          HTMLAttributes: { class: 'mention mention-skill' },
          suggestion: createSuggestion('/', (query) =>
            skillItemsRef.current.filter((item) => item.label.toLowerCase().includes(query))
          ),
        }),
        Mention.extend({ name: 'commandMention' }).configure({
          HTMLAttributes: { class: 'mention mention-command' },
          suggestion: createSuggestion('>', (query) =>
            commandItemsRef.current.filter((item) => item.label.toLowerCase().includes(query))
          ),
        }),
      ],
      editorProps: {
        attributes: {
          class: 'chat-input-editor outline-none min-h-[24px] max-h-[200px] overflow-y-auto text-sm leading-relaxed',
        },
        handleKeyDown: (_view, event) => {
          if (import.meta.env.DEV) {
            console.log('ChatInput KeyDown:', { key: event.key, code: event.code, ctrl: event.ctrlKey, meta: event.metaKey });
          }

          // Explicitly ignore any modifier + \ to allow system input method switching
          if ((event.ctrlKey || event.metaKey || event.altKey) && (event.key === '\\' || event.code === 'Backslash' || event.key === '|')) return false;

          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
            return true;
          }
          return false;
        },
      },
      editable: !disabled,
    });

    // Update editable when disabled changes
    useEffect(() => {
      if (editor) {
        editor.setEditable(!disabled);
      }
    }, [disabled, editor]);

    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus(),
      clear: () => editor?.commands.clearContent(),
    }));

    const handleSubmit = useCallback(() => {
      if (!editor || disabled) return;

      // Serialize: convert mention nodes to tagged text
      const json = editor.getJSON();
      const text = serializeTiptapToText(json);
      if (!text.trim()) return;

      onSubmit(text);
      editor.commands.clearContent();
    }, [editor, disabled, onSubmit]);

    return (
      <div className={`chat-input-wrapper bg-background border border-border rounded-xl px-4 py-3 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow ${disabled ? 'opacity-50' : ''}`}>
        <EditorContent editor={editor} />
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
export default ChatInput;

// ─── Serializer ──────────────────────────────────────────────────────

function serializeTiptapToText(json: any): string {
  if (!json) return '';

  if (json.type === 'text') {
    return json.text || '';
  }

  if (json.type === 'mention') {
    return `@file[${json.attrs?.label || ''}](${json.attrs?.id || ''})`;
  }
  if (json.type === 'skillMention') {
    return `/skill[${json.attrs?.label || ''}](${json.attrs?.id || ''})`;
  }
  if (json.type === 'commandMention') {
    return `>cmd[${json.attrs?.label || ''}](${json.attrs?.id || ''})`;
  }

  if (json.type === 'paragraph') {
    const inner = (json.content || []).map(serializeTiptapToText).join('');
    return inner + '\n';
  }

  if (json.type === 'doc') {
    return (json.content || [])
      .map(serializeTiptapToText)
      .join('')
      .replace(/\n$/, ''); // trim trailing newline
  }

  if (json.content) {
    return json.content.map(serializeTiptapToText).join('');
  }

  return '';
}
