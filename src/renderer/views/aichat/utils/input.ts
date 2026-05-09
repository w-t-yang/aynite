import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import type { SuggestionItem } from '../../../../lib/types/ai'

export type { SuggestionItem }

import {
  SuggestionList,
  type SuggestionListHandle,
} from '../components/SuggestionList'

type GetFilesFn = (
  path: string,
) => Promise<{ path: string; name: string; isDirectory: boolean }[]>

export function createSuggestion(
  triggerChar: string,
  getItems: (query: string) => { id: string; label?: string }[],
) {
  return {
    char: triggerChar,
    items: ({ query }: { query: string }) => {
      return getItems(query.toLowerCase())
    },
    render: () => {
      let component: ReactRenderer<SuggestionListHandle> | null = null
      let popup: TippyInstance[] | null = null

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(SuggestionList, {
            props: { ...props, triggerChar },
            editor: props.editor,
          })

          if (!props.clientRect) return

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            offset: [0, 4],
          })
        },
        onUpdate: (props: any) => {
          component?.updateProps({ ...props, triggerChar })
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({ getReferenceClientRect: props.clientRect })
          }
        },
        onKeyDown: (props: any) => {
          const isCtrl = props.event.ctrlKey || props.event.metaKey
          if (
            props.event.key === 'Escape' ||
            (isCtrl && props.event.key.toUpperCase() === 'G')
          ) {
            popup?.[0]?.hide()
            return true
          }
          return (
            (component?.ref as SuggestionListHandle)?.onKeyDown(props) ?? false
          )
        },
        onExit: () => {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  }
}

export async function flattenWorkspaceFiles(
  folders: string[],
  getFiles: GetFilesFn,
  maxDepth: number = 100,
): Promise<SuggestionItem[]> {
  const results: SuggestionItem[] = []

  const walk = async (
    dir: string,
    depth: number,
    rootFolder: string,
    rootName: string,
  ) => {
    if (depth > maxDepth) return
    try {
      const res = await getFiles(dir)
      if (!res) return
      for (const file of res) {
        const parts = file.path.split(/[/\\]/)
        const name = parts.pop() || ''
        const parent = parts.pop() || ''
        const relativePath = file.path
          .replace(rootFolder, '')
          .replace(/^[/\\]/, '')

        results.push({
          id: file.path,
          label: `${rootName}/${relativePath}`,
          name: name,
          subtitle: parent
            ? `${rootName}/.../${parent}/`
            : `(Root: ${rootName})`,
          isDirectory: file.isDirectory,
        })
        if (file.isDirectory && depth < maxDepth) {
          await walk(file.path, depth + 1, rootFolder, rootName)
        }
      }
    } catch {
      // ignore errors
    }
  }

  for (const folder of folders) {
    const rootName = folder.split(/[/\\]/).pop() || folder
    results.push({
      id: folder,
      label: rootName,
      name: rootName,
      subtitle: 'Workspace Root',
      isDirectory: true,
    })
    await walk(folder, 1, folder, rootName)
  }

  return results
}

export function serializeTiptapToText(json: any): string {
  if (!json) return ''

  if (json.type === 'text') {
    return json.text || ''
  }

  if (json.type === 'hardBreak') {
    return '\n'
  }
  if (json.type === 'mention') {
    const type = json.attrs?.isDirectory ? 'dir' : 'file'
    return `@${type}[${json.attrs?.label || ''}](${json.attrs?.id || ''})`
  }
  if (json.type === 'skillMention') {
    return `/skill[${json.attrs?.label || ''}](${json.attrs?.id || ''})`
  }
  if (json.type === 'commandMention') {
    return `>cmd[${json.attrs?.label || ''}](${json.attrs?.id || ''})`
  }

  if (json.type === 'paragraph') {
    const inner = (json.content || []).map(serializeTiptapToText).join('')
    return `${inner}\n`
  }

  if (json.type === 'doc') {
    return (json.content || [])
      .map(serializeTiptapToText)
      .join('')
      .replace(/\n$/, '')
  }

  if (json.content) {
    return json.content.map(serializeTiptapToText).join('')
  }

  return ''
}
