/**
 * Hook for file tab management.
 *
 * Manages the tabs array, active path, navigation history,
 * persistence to config, and responding to active-file-changed
 * events from the main process.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { config, configMutations } from '../../../bridge/config'
import { useViewEvent } from '../../useViewEvents'

interface Tab {
  name: string
  path: string
}

export function useFileTabs() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set())
  const isBroadcastingRef = useRef(false)
  const isInitializedRef = useRef(false)

  const openFile = useCallback((path: string) => {
    const name = path.split(/[/\\]/).pop() || path
    setTabs((prev) => {
      if (prev.some((t) => t.path === path)) return prev
      return [...prev, { name, path }]
    })
    setHistory((prev) => {
      const filtered = prev.filter((p) => p !== path)
      return [...filtered, path]
    })
    setActivePath(path)
  }, [])

  const handleTabSelect = useCallback(
    (path: string) => {
      if (activePath === path) return
      isBroadcastingRef.current = true
      configMutations.set('activeFile', path).then(() => {
        isBroadcastingRef.current = false
      })
      setActivePath(path)
      setHistory((prev) => {
        const filtered = prev.filter((p) => p !== path)
        return [...filtered, path]
      })
    },
    [activePath],
  )

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.path !== path)
        const newHistory = history.filter((p) => p !== path)
        setHistory(newHistory)

        if (activePath === path) {
          if (newHistory.length > 0) {
            const nextActive = newHistory[newHistory.length - 1]
            handleTabSelect(nextActive)
          } else {
            setActivePath(null)
            configMutations.set('activeFile', null)
          }
        }
        return newTabs
      })
    },
    [activePath, history, handleTabSelect],
  )

  const closeAll = useCallback(() => {
    setTabs([])
    setActivePath(null)
    setHistory([])
    configMutations.set('activeFile', null)
  }, [])

  // Initial load of active file and opened files
  useEffect(() => {
    const init = async () => {
      const paths = await config.get('openedFiles')
      if (paths && Array.isArray(paths) && paths.length > 0) {
        const initialTabs = paths.map((p: string) => ({
          name: p.split(/[/\\]/).pop() || p,
          path: p,
        }))
        setTabs(initialTabs)
        setHistory(paths)
      }

      const active = await config.get('activeFile')
      if (active) {
        setActivePath(active)
        setTabs((prev) => {
          if (prev.some((t) => t.path === active)) return prev
          return [
            ...prev,
            { name: active.split(/[/\\]/).pop() || active, path: active },
          ]
        })
      }
      isInitializedRef.current = true
    }
    init()
  }, [])

  // Persist tabs to main
  useEffect(() => {
    if (!isInitializedRef.current) return
    configMutations.set(
      'openedFiles',
      tabs.map((t) => t.path),
    )
  }, [tabs])

  // Listen for active-file-changed broadcast from main
  useViewEvent('active-file-changed', (data: { path: string }) => {
    if (isBroadcastingRef.current) return
    if (data?.path) {
      openFile(data.path)
    } else {
      setActivePath(null)
    }
  })

  return {
    tabs,
    activePath,
    dirtyPaths,
    setDirtyPaths,
    isBroadcastingRef,
    openFile,
    handleTabSelect,
    closeTab,
    closeAll,
    setActivePath,
  }
}
