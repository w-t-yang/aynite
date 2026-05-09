import { Extension } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Send, Square } from 'lucide-react'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import type { ChatInputHandle } from '../../../../lib/types/ui'
import { Button } from '../../../shared/basic/Button'
import type { Keybinding } from '../../../shared/lib/types'
import type { SuggestionItem } from '../utils/input'
import { createSuggestion, serializeTiptapToText } from '../utils/input'

export type { ChatInputHandle }

interface InputEditorProps {
  onSend: (text: string) => void
  placeholder?: string
  loading?: boolean
  onAbort?: () => void
  onClear?: () => void
  disabled?: boolean
  workspaceFolders?: string[]
  focusKeybinding?: Keybinding
  getAllFiles: () => Promise<
    { path: string; name: string; isDirectory: boolean }[]
  >
  getAvailableSkills: () => Promise<
    { name: string; path: string; error?: string }[]
  >
  getAvailableCommands: () => Promise<
    { name: string; path: string; error?: string }[]
  >
}

const EMPTY_ARRAY: any[] = []

const InputEditorComponent = forwardRef<ChatInputHandle, InputEditorProps>(
  (
    {
      onSend,
      placeholder = 'Message assistant...',
      loading,
      onAbort,
      onClear: _onClear,
      disabled,
      workspaceFolders = EMPTY_ARRAY,
      focusKeybinding: _focusKeybinding,
      getAllFiles,
      getAvailableSkills,
      getAvailableCommands,
    },
    ref,
  ) => {
    const [_fileItems, setFileItems] = useState<SuggestionItem[]>([])
    const [_skillItems, setSkillItems] = useState<SuggestionItem[]>([])
    const [_commandItems, setCommandItems] = useState<SuggestionItem[]>([])

    const fileItemsRef = React.useRef<SuggestionItem[]>([])
    const skillItemsRef = React.useRef<SuggestionItem[]>([])
    const commandItemsRef = React.useRef<SuggestionItem[]>([])

    const BaseMention = React.useMemo(
      () =>
        Mention.extend({
          addAttributes() {
            return {
              ...this.parent?.(),
              isDirectory: {
                default: false,
                parseHTML: (element) =>
                  element.getAttribute('data-is-directory') === 'true',
                renderHTML: (attributes) => ({
                  'data-is-directory': attributes.isDirectory,
                }),
              },
            }
          },
        }),
      [],
    )

    const extensions = React.useMemo(
      () => [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          horizontalRule: false,
        }),
        Placeholder.configure({
          placeholder,
        }),
        BaseMention.configure({
          HTMLAttributes: { class: 'mention mention-file' },
          suggestion: createSuggestion('@', (query) => {
            const q = query.toLowerCase()
            return fileItemsRef.current
              .filter((item) => (item.label || '').toLowerCase().includes(q))
              .sort((a, b) => {
                const aName = (a.name || '').toLowerCase()
                const bName = (b.name || '').toLowerCase()
                const aLabel = (a.label || '').toLowerCase()
                const bLabel = (b.label || '').toLowerCase()

                // 1. Exact name match
                if (aName === q && bName !== q) return -1
                if (bName === q && aName !== q) return 1

                // 2. Name starts with
                if (aName.startsWith(q) && !bName.startsWith(q)) return -1
                if (bName.startsWith(q) && !aName.startsWith(q)) return 1

                // 3. Label starts with (root match)
                if (aLabel.startsWith(q) && !bLabel.startsWith(q)) return -1
                if (bLabel.startsWith(q) && !aLabel.startsWith(q)) return 1

                // 4. Shorter label (closer to root)
                return aLabel.length - bLabel.length
              })
              .slice(0, 20)
          }),
        }),
        BaseMention.extend({ name: 'skillMention' }).configure({
          HTMLAttributes: { class: 'mention mention-skill' },
          suggestion: createSuggestion('/', (query) =>
            skillItemsRef.current.filter((item) =>
              (item.label || '').toLowerCase().includes(query),
            ),
          ),
        }),
        BaseMention.extend({ name: 'commandMention' }).configure({
          HTMLAttributes: { class: 'mention mention-command' },
          suggestion: createSuggestion('>', (query) =>
            commandItemsRef.current.filter((item) =>
              (item.label || '').toLowerCase().includes(query),
            ),
          ),
        }),
        Extension.create({
          name: 'submitHandler',
          addKeyboardShortcuts() {
            return {
              Enter: () => {
                if (loading) return false
                const text = serializeTiptapToText(this.editor.getJSON())
                if (!text.trim()) return false
                onSend(text)
                this.editor.commands.clearContent()
                return true
              },
            }
          },
        }),
      ],
      [BaseMention, placeholder, loading, onSend],
    )

    // Unified effect for indexing workspace files, skills, and commands
    useEffect(() => {
      let isMounted = true

      const rebuild = async () => {
        // 1. Immediately clear indexes to prevent cross-workspace pollution
        fileItemsRef.current = []
        setFileItems([])
        skillItemsRef.current = []
        setSkillItems([])
        commandItemsRef.current = []
        setCommandItems([])

        // 2. Index Files
        if (workspaceFolders.length > 0) {
          try {
            const files = await getAllFiles()
            const items = (files || []).map((file: any) => {
              const parts = file.path.split(/[/\\]/)
              const name = file.name
              const parent = parts[parts.length - 2] || ''

              // Find which workspace folder this file belongs to for the label
              const rootFolder =
                workspaceFolders.find((f) => file.path.startsWith(f)) || ''
              const rootName = rootFolder.split(/[/\\]/).pop() || ''
              const relativePath = file.path
                .replace(rootFolder, '')
                .replace(/^[/\\]/, '')

              return {
                id: file.path,
                label: relativePath ? `${rootName}/${relativePath}` : rootName,
                name: name,
                subtitle: parent
                  ? `${rootName}/.../${parent}/`
                  : `(Root: ${rootName})`,
                isDirectory: file.isDirectory,
              }
            })

            if (isMounted) {
              fileItemsRef.current = items
              setFileItems(items)
            }
          } catch (e) {
            console.error('[ChatInput] File indexing failed:', e)
          }
        }

        // 3. Index Skills and Commands in parallel
        try {
          const [skillsRes, cmdsRes] = await Promise.all([
            getAvailableSkills(),
            getAvailableCommands(),
          ])

          if (isMounted && skillsRes) {
            const items = skillsRes.map((s: any) => ({
              id: s.path,
              label: s.name,
              name: s.name,
              subtitle: 'Skill',
              error: s.error,
            }))
            skillItemsRef.current = items
            setSkillItems(items)
          }

          if (isMounted && cmdsRes) {
            const items = cmdsRes.map((c: any) => ({
              id: c.path,
              label: c.name,
              name: c.name,
              subtitle: 'Command',
              error: c.error,
            }))
            commandItemsRef.current = items
            setCommandItems(items)
          }
        } catch (e) {
          console.error('[ChatInput] Skills/Commands indexing failed:', e)
        }
      }

      rebuild()

      return () => {
        isMounted = false
      }
    }, [
      workspaceFolders,
      getAvailableCommands,
      getAllFiles,
      getAvailableSkills,
    ])

    const editor = useEditor(
      {
        extensions,
        editorProps: {
          attributes: {
            class:
              'chat-input-editor outline-none min-h-[24px] max-h-[200px] overflow-y-auto text-sm leading-relaxed',
          },
        },
        editable: !disabled,
      },
      [],
    )

    const handleSubmit = useCallback(() => {
      if (!editor || disabled) return

      // Serialize: convert mention nodes to tagged text
      const json = editor.getJSON()
      const text = serializeTiptapToText(json)
      if (!text.trim()) return

      onSend(text)
      editor.commands.clearContent()
    }, [editor, disabled, onSend])

    // Update editable when disabled changes
    useEffect(() => {
      if (editor) {
        editor.setEditable(!disabled)
      }
    }, [disabled, editor])

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (editor) {
          editor.commands.focus('end')
        }
      },
      clear: () => editor?.commands.clearContent(),
      trigger: (prefix: string) => {
        if (!editor) return
        editor.commands.focus('end')
        editor.commands.clearContent()
        editor.commands.insertContent(prefix)
      },
    }))

    return (
      <fieldset
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            editor?.commands.focus('end')
          }
        }}
        onClick={() => {
          if (editor) {
            editor.commands.focus('end')
            // Force focus on next tick if needed
            setTimeout(() => editor.commands.focus('end'), 5)
          }
        }}
        className={`chat-input-wrapper flex items-end gap-2 bg-background/60 backdrop-blur-xl border border-border/40 rounded-2xl pl-4 pr-2 py-2.5 shadow-2xl shadow-black/20 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-300 cursor-text border-none m-0 p-0 ${disabled ? 'opacity-50 grayscale-[0.5]' : ''}`}
      >
        <div className="flex-1 min-h-[24px] py-1">
          <EditorContent editor={editor} />
        </div>
        <Button
          onClick={() => (loading ? onAbort?.() : handleSubmit())}
          disabled={disabled && !loading}
          variant="ghost"
          className="p-2 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:hover:bg-transparent rounded-xl transition-all duration-200 shrink-0 h-auto"
          title={loading ? 'Stop (Esc)' : 'Send Message (Ctrl+Enter)'}
        >
          {loading ? (
            <Square size={18} className="fill-primary/20" />
          ) : (
            <Send size={18} />
          )}
        </Button>
      </fieldset>
    )
  },
)

export const InputEditor = React.memo(InputEditorComponent)

InputEditor.displayName = 'InputEditor'
