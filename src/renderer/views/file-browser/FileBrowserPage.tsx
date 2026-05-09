import { useCallback, useEffect, useState } from 'react'
import type { FileInfo } from '../../../lib/types/files'
import { useAppEvent } from '../ViewContext'
import { FileContent } from './components/FileContent'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'

interface Tab {
  name: string
  path: string
}

export function FileBrowserPage() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)

  // Content state
  const [content, setContent] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openFile = useCallback((path: string) => {
    const name = path.split(/[/\\]/).pop() || path
    setTabs((prev) => {
      if (prev.some((t) => t.path === path)) return prev
      return [...prev, { name, path }]
    })
    setActivePath(path)
  }, [])

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.path !== path)
        if (activePath === path) {
          if (newTabs.length > 0) {
            setActivePath(newTabs[newTabs.length - 1].path)
          } else {
            setActivePath(null)
          }
        }
        return newTabs
      })
    },
    [activePath],
  )

  const closeAll = useCallback(() => {
    setTabs([])
    setActivePath(null)
  }, [])

  // Listen for file-open events from other views
  useAppEvent('file-open', (data: { path: string }) => {
    if (data?.path) {
      openFile(data.path)
    }
  })

  // Load file content when activePath changes
  useEffect(() => {
    if (!activePath) {
      setContent(null)
      setFileInfo(null)
      return
    }

    const loadFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const isText = await window.aynite.checkIsTextFile(activePath)
        const info = await window.aynite.getFileInfo(activePath)
        setFileInfo(info)

        if (isText) {
          const text = await window.aynite.readFile(activePath)
          setContent(text)
        } else {
          setContent(null)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [activePath])

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      <TabBar
        tabs={tabs}
        activePath={activePath}
        onTabSelect={setActivePath}
        onTabClose={closeTab}
        onCloseAll={closeAll}
      />
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <FileContent
          path={activePath}
          content={content}
          fileInfo={fileInfo}
          loading={loading}
          error={error}
        />
      </div>
      <StatusBar />
    </div>
  )
}
