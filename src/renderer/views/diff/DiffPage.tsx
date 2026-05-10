import { diffLines } from 'diff'
import {
  AlertCircle,
  Columns2,
  FileText,
  FolderOpen,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { iconBtn, ViewHeader } from '../../shared/basic/ViewHeader'
import { useView } from '../ViewContext'
import type { DiffData } from './types'

const MOCK_DATA: DiffData = {
  title: 'Configuration Migration',
  leftLabel: 'v1 (legacy)',
  rightLabel: 'v2 (refactored)',
  leftContent: `const express = require('express')
const app = express()
const PORT = 3000

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT)
})`,
  rightContent: `import express from 'express'
import { config } from './config'

const app = express()
const PORT = config.port || 3000

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' })
})

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`)
})`,
}

const EXPECTED_FORMAT = `{
  "title": "Optional comparison title",
  "leftLabel": "Original",
  "rightLabel": "Modified",
  "leftContent": "text content of left side",
  "rightContent": "text content of right side"
}`

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  value: string
  leftLine?: number
  rightLine?: number
}

export function DiffPage() {
  const { themes, activeThemeId } = useView()
  const [data, setData] = useState<DiffData | null>(null)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [fontSize, setFontSize] = useState(11)
  const currentFile = useRef<string | null>(null)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  const loadMockData = useCallback(() => {
    setData(MOCK_DATA)
    setIsMock(true)
  }, [])

  const loadInitialFile = useCallback(
    async (path: string) => {
      try {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)

        if (
          typeof json.leftContent !== 'string' ||
          typeof json.rightContent !== 'string'
        ) {
          throw new Error(
            'Invalid diff format: missing leftContent or rightContent',
          )
        }

        setError(null)
        setData(json)
        currentFile.current = path
        setIsMock(false)
      } catch (err) {
        console.error('Failed to load diff file:', err)
        setError({
          message: `Failed to load file. File might be missing or invalid.`,
          expected: EXPECTED_FORMAT,
        })
        loadMockData()
      }
    },
    [loadMockData],
  )

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    let initialFile = params.get('file')
    const dataParam = params.get('data')

    if (dataParam) {
      try {
        const tileData = JSON.parse(decodeURIComponent(dataParam))
        if (tileData.file) initialFile = tileData.file
      } catch {
        /* ignore */
      }
    }

    if (initialFile) {
      loadInitialFile(initialFile)
    } else {
      loadMockData()
    }
  }, [loadInitialFile, loadMockData])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Diff JSON',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (path) {
        await loadInitialFile(path)
        if (tileId) {
          ;(window as any).aynite.setConfig('tile-data', {
            tileId,
            data: { file: path },
          })
        }
      }
    } catch {
      setError({
        message: 'Failed to select or parse file.',
        expected: EXPECTED_FORMAT,
      })
    }
  }

  const handleRefresh = useCallback(() => {
    if (currentFile.current) {
      loadInitialFile(currentFile.current)
    } else {
      loadMockData()
    }
  }, [loadInitialFile, loadMockData])

  const diffLinesResult = useMemo(() => {
    if (!data) return []
    return diffLines(data.leftContent, data.rightContent)
  }, [data])

  const lineColumns = useMemo(() => {
    if (!data) return { left: [] as DiffLine[], right: [] as DiffLine[] }

    const left: DiffLine[] = []
    const right: DiffLine[] = []
    let leftLine = 0
    let rightLine = 0

    for (const part of diffLinesResult) {
      const lines = part.value.replace(/\n$/, '').split('\n')
      if (part.added) {
        for (const line of lines) {
          rightLine++
          right.push({ type: 'added', value: line, rightLine })
        }
      } else if (part.removed) {
        for (const line of lines) {
          leftLine++
          left.push({ type: 'removed', value: line, leftLine })
        }
      } else {
        for (const line of lines) {
          leftLine++
          rightLine++
          left.push({ type: 'unchanged', value: line, leftLine })
          right.push({ type: 'unchanged', value: line, rightLine })
        }
      }
    }

    return { left, right }
  }, [data, diffLinesResult])

  const renderLine = (line: DiffLine, side: 'left' | 'right') => {
    const bgColor =
      line.type === 'added'
        ? isDark
          ? 'bg-green-950/40'
          : 'bg-green-50'
        : line.type === 'removed'
          ? isDark
            ? 'bg-red-950/40'
            : 'bg-red-50'
          : ''

    const textColor =
      line.type === 'added'
        ? isDark
          ? 'text-green-300'
          : 'text-green-800'
        : line.type === 'removed'
          ? isDark
            ? 'text-red-300'
            : 'text-red-800'
          : ''

    const lineNum = side === 'left' ? line.leftLine : line.rightLine

    return (
      <div
        key={`${side}-${lineNum ?? ''}-${line.value.slice(0, 20)}`}
        className={`flex font-mono leading-[22px] min-h-[22px] ${bgColor}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        <span className="w-10 text-right pr-2 text-muted-foreground/50 select-none shrink-0 border-r border-border/30">
          {lineNum || ''}
        </span>
        <span
          className={`px-2 whitespace-pre overflow-hidden text-ellipsis ${textColor}`}
        >
          {line.value || ' '}
        </span>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      <ViewHeader icon={<Columns2 size={16} />} title="Diff Viewer">
        {data && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mr-1">
            <span className="w-2 h-2 rounded-full bg-green-500/60" />
            <span>{data.rightLabel || 'Added'}</span>
            <span className="w-2 h-2 rounded-full bg-red-500/60 ml-1" />
            <span>{data.leftLabel || 'Removed'}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setFontSize((s) => Math.min(s + 2, 24))}
          className={iconBtn()}
          title="Increase Font Size"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => setFontSize((s) => Math.max(s - 2, 7))}
          className={iconBtn()}
          title="Decrease Font Size"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className={iconBtn()}
          title="Reload"
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          onClick={handleSelectFile}
          className={iconBtn()}
          title="Load diff file"
        >
          <FolderOpen size={14} />
        </button>
      </ViewHeader>

      {/* Diff Content */}
      <section className="flex-1 flex overflow-hidden relative bg-background">
        {isMock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.05] z-10">
            <span className="text-[12vw] font-black rotate-12">DIFF MOCK</span>
          </div>
        )}

        {data ? (
          <>
            {/* Left Panel */}
            <div className="flex-1 overflow-auto border-r border-border/50">
              <div className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b border-border/50 px-3 py-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {data.leftLabel || 'Original'}
                </span>
              </div>
              <div className="pb-4">
                {lineColumns.left.map((line) => renderLine(line, 'left'))}
              </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 overflow-auto">
              <div className="sticky top-0 z-20 bg-muted/80 backdrop-blur-sm border-b border-border/50 px-3 py-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {data.rightLabel || 'Modified'}
                </span>
              </div>
              <div className="pb-4">
                {lineColumns.right.map((line) => renderLine(line, 'right'))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium opacity-40">
                Load a JSON diff file to compare
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-md w-full bg-popover border border-destructive/20 rounded-xl shadow-2xl p-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertCircle size={24} />
                <h3 className="font-bold">Load Error</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {error.message}
              </p>
              <div className="bg-muted p-3 rounded font-mono text-[10px] mb-4 overflow-auto max-h-40 whitespace-pre">
                {error.expected}
              </div>
              <button
                type="button"
                onClick={handleSelectFile}
                className="w-full bg-primary text-primary-foreground py-2 rounded font-bold text-[11px]"
              >
                LOAD DIFFERENT FILE
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
