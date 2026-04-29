import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { SelectionList, SelectionItem } from './ui/SelectionList';
import { FileText, Folder, Zap, Play } from 'lucide-react';
import { KeyManager } from '../lib/key-handlers';

// ─── Types ───────────────────────────────────────────────────────────

export interface ChatInputHandle {
  focus: () => void;
  clear: () => void;
  trigger: (prefix: string) => void;
}

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  workspaceFolders?: string[];
}

// Real registries will be loaded via API

// ─── Suggestion List Component ───────────────────────────────────────

interface SuggestionItem extends SelectionItem {
  name?: string;
  isDirectory?: boolean;
}

interface SuggestionListProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
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
        const isCtrl = event.ctrlKey || event.metaKey;

        if (event.key === 'ArrowUp' || (isCtrl && event.key.toUpperCase() === 'P')) {
          event.preventDefault();
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown' || (isCtrl && event.key.toUpperCase() === 'N')) {
          event.preventDefault();
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

    const triggerLabel = triggerChar === '@' ? 'Files' : triggerChar === '/' ? 'Skills' : 'Commands';

    const selectionItems: SelectionItem[] = items.map(item => {
      let icon = <FileText size={14} />;
      if (triggerChar === '/') icon = <Zap size={14} />;
      else if (triggerChar === '>') icon = <Play size={14} />;
      else if (item.isDirectory) icon = <Folder size={14} />;

      return {
        ...item,
        label: item.name || item.label,
        icon
      };
    });

    return (
      <div className="suggestion-list bg-sidebar border border-border rounded-lg shadow-2xl overflow-hidden min-w-[280px] max-w-[480px] flex flex-col animate-in fade-in zoom-in-95 duration-100">
        <div className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/30 bg-muted/20 shrink-0">
          {triggerLabel}
        </div>
        
        <SelectionList
          items={selectionItems}
          selectedIndex={selectedIndex}
          onSelect={(item) => command(item as SuggestionItem)}
          size="sm"
          className="max-h-[40vh]"
        />
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
          const isCtrl = props.event.ctrlKey || props.event.metaKey;
          if (props.event.key === 'Escape' || (isCtrl && props.event.key.toUpperCase() === 'G')) {
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
): Promise<SuggestionItem[]> {
  const results: SuggestionItem[] = [];

  const walk = async (dir: string, depth: number, rootFolder: string, rootName: string) => {
    if (depth > maxDepth) return;
    try {
      // @ts-ignore
      const res = await window.api.getFiles(dir);
      if (res.error || !res.data) return;
      for (const file of res.data) {
        const parts = file.path.split(/[/\\]/);
        const name = parts.pop() || '';
        const parent = parts.pop() || '';
        const relativePath = file.path.replace(rootFolder, '').replace(/^[/\\]/, '');
        
        results.push({ 
          id: file.path, 
          label: `${rootName}/${relativePath}`, 
          name: name,
          subtitle: parent ? `${rootName}/.../${parent}/` : `(Root: ${rootName})`,
          isDirectory: file.isDirectory 
        });
        if (file.isDirectory && depth < maxDepth) {
          await walk(file.path, depth + 1, rootFolder, rootName);
        }
      }
    } catch {
      // ignore errors
    }
  };

  for (const folder of folders) {
    const rootName = folder.split(/[/\\]/).pop() || folder;
    results.push({ id: folder, label: rootName, name: rootName, subtitle: 'Workspace Root', isDirectory: true });
    await walk(folder, 1, folder, rootName);
  }

  return results;
}

// ─── Main ChatInput Component ────────────────────────────────────────

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ onSubmit, disabled, workspaceFolders = [] }, ref) => {
    const [fileItems, setFileItems] = useState<SuggestionItem[]>([]);
    const [skillItems, setSkillItems] = useState<SuggestionItem[]>([]);
    const [commandItems, setCommandItems] = useState<SuggestionItem[]>([]);

    const fileItemsRef = React.useRef<SuggestionItem[]>([]);
    const skillItemsRef = React.useRef<SuggestionItem[]>([]);
    const commandItemsRef = React.useRef<SuggestionItem[]>([]);

    // Debug utility exposed to window
    useEffect(() => {
      const rebuild = async () => {
        if (workspaceFolders.length > 0) {
          const items = await flattenWorkspaceFiles(workspaceFolders);
          fileItemsRef.current = items;
          setFileItems(items);
        }
        
        const skillsRes = await (window.api as any).getAvailableSkills();
        if (skillsRes.data) {
          const items = skillsRes.data.map((s: any) => ({ id: s.path, label: s.name, name: s.name, subtitle: 'Skill' }));
          skillItemsRef.current = items;
          setSkillItems(items);
        }

        const cmdsRes = await (window.api as any).getAvailableCommands();
        if (cmdsRes.data) {
          const items = cmdsRes.data.map((c: any) => ({ id: c.path, label: c.name, name: c.name, subtitle: 'Command' }));
          commandItemsRef.current = items;
          setCommandItems(items);
        }

        console.log('[Aynite Debug] All indexes rebuilt.');
      };

      // @ts-ignore
      window.__aynite = {
        rebuild,
        getItems: () => ({
          files: fileItemsRef.current,
          skills: skillItemsRef.current,
          commands: commandItemsRef.current
        }),
        getWorkspaceFolders: () => workspaceFolders
      };
      
      return () => {
        // @ts-ignore
        delete window.__aynite;
      };
    }, [workspaceFolders]);

    // Initial load
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
          const items = res.data.map((s: any) => ({ id: s.path, label: s.name, name: s.name, subtitle: 'Skill' }));
          skillItemsRef.current = items;
          setSkillItems(items);
        }
      });
      // @ts-ignore
      window.api.getAvailableCommands().then((res: any) => {
        if (res.data) {
          const items = res.data.map((c: any) => ({ id: c.path, label: c.name, name: c.name, subtitle: 'Command' }));
          commandItemsRef.current = items;
          setCommandItems(items);
        }
      });
    }, [workspaceFolders]);
    
    
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
          placeholder: 'Message Aynite… (@ files, / skills, > commands)',
        }),
        Mention.configure({
          HTMLAttributes: { class: 'mention mention-file' },
          suggestion: createSuggestion('@', (query) => {
            const q = query.toLowerCase();
            return fileItemsRef.current
              .filter((item) => item.label.toLowerCase().includes(q))
              .sort((a, b) => {
                const aName = (a.name || '').toLowerCase();
                const bName = (b.name || '').toLowerCase();
                const aLabel = a.label.toLowerCase();
                const bLabel = b.label.toLowerCase();

                // 1. Exact name match
                if (aName === q && bName !== q) return -1;
                if (bName === q && aName !== q) return 1;

                // 2. Name starts with
                if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
                if (bName.startsWith(q) && !aName.startsWith(q)) return 1;

                // 3. Label starts with (root match)
                if (aLabel.startsWith(q) && !bLabel.startsWith(q)) return -1;
                if (bLabel.startsWith(q) && !aLabel.startsWith(q)) return 1;

                // 4. Shorter label (closer to root)
                return aLabel.length - bLabel.length;
              })
              .slice(0, 20);
          }),
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
      },
      editable: !disabled,
    });

    const handleSubmit = useCallback(() => {
      if (!editor || disabled) return;

      // Serialize: convert mention nodes to tagged text
      const json = editor.getJSON();
      const text = serializeTiptapToText(json);
      if (!text.trim()) return;

      onSubmit(text);
      editor.commands.clearContent();
    }, [editor, disabled, onSubmit]);

    useEffect(() => {
      if (!editor) return;
      const api = {
        submit: () => handleSubmit(),
        selectAll: () => editor.commands.selectAll()
      };
      KeyManager.registerChat(api);
      return () => KeyManager.unregisterChat();
    }, [editor, handleSubmit]);

    // Update editable when disabled changes
    useEffect(() => {
      if (editor) {
        editor.setEditable(!disabled);
      }
    }, [disabled, editor]);

    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus(),
      clear: () => editor?.commands.clearContent(),
      trigger: (prefix: string) => {
        if (!editor) return;
        editor.commands.focus();
        editor.commands.clearContent();
        editor.commands.insertContent(prefix);
      }
    }));

    return (
      <div className={`chat-input-wrapper bg-background/60 backdrop-blur-xl border border-border/40 rounded-2xl px-4 py-3.5 shadow-2xl shadow-black/20 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-300 active:scale-[0.995] ${disabled ? 'opacity-50 grayscale-[0.5]' : ''}`}>
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
