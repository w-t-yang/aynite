import {
  AlertCircle,
  Check,
  Clipboard,
  Eye,
  EyeOff,
  Palette,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { iconBtn, ViewHeader } from '../../shared/basic/ViewHeader'
import { useView } from '../ViewContext'
import type { ThemeData } from './types'

const MOCK_DATA: ThemeData = {
  id: 'aurora-night',
  name: 'Aurora Night',
  type: 'dark',
  colors: {
    background: '#0f1729',
    foreground: '#e2e8f0',
    primary: '#38bdf8',
    'primary-foreground': '#0f1729',
    muted: '#1e293b',
    'muted-foreground': '#94a3b8',
    border: '#334155',
    card: '#1a2332',
    'card-foreground': '#e2e8f0',
    info: '#60a5fa',
    success: '#34d399',
    warning: '#fbbf24',
    destructive: '#f87171',
    popover: '#1a2332',
    'popover-foreground': '#e2e8f0',
  },
}

const EXPECTED_FORMAT = `{
  "id": "my-theme",
  "name": "My Theme",
  "type": "light | dark",
  "colors": {
    "background": "#1a1a2e",
    "foreground": "#e0e0e0",
    "primary": "#7c3aed",
    ...
  }
}`

const COLOR_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: 'Core',
    keys: ['background', 'foreground', 'border'],
  },
  {
    label: 'Brand',
    keys: ['primary', 'primary-foreground'],
  },
  {
    label: 'Surface',
    keys: [
      'muted',
      'muted-foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
    ],
  },
  {
    label: 'Semantic',
    keys: ['info', 'success', 'warning', 'destructive'],
  },
]

export function ThemeStudioPage() {
  const { themes, activeThemeId } = useView()
  const [data, setData] = useState<ThemeData | null>(null)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [editedColors, setEditedColors] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const [showJson, setShowJson] = useState(false)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const _isDark = currentTheme?.type === 'dark'

  const loadMockData = useCallback(() => {
    setData(MOCK_DATA)
    setEditedColors(MOCK_DATA.colors)
    setIsMock(true)
  }, [])

  const loadInitialFile = useCallback(
    async (path: string) => {
      try {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)

        if (!json.id || !json.colors || typeof json.colors !== 'object') {
          throw new Error('Invalid theme format: missing id or colors')
        }

        setError(null)
        setData(json)
        setEditedColors(json.colors)
        setIsMock(false)
      } catch (err) {
        console.error('Failed to load theme file:', err)
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

  // Live preview: apply edited colors to :root
  useEffect(() => {
    const root = document.documentElement
    for (const [key, value] of Object.entries(editedColors)) {
      root.style.setProperty(`--${key}`, value)
    }
    return () => {
      for (const key of Object.keys(editedColors)) {
        root.style.removeProperty(`--${key}`)
      }
    }
  }, [editedColors])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Theme JSON',
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

  const handleColorChange = (key: string, value: string) => {
    setEditedColors((prev) => ({ ...prev, [key]: value }))
  }

  const handleApplyTheme = async () => {
    if (!data) return
    try {
      const key = 'activeTheme'
      await (window as any).aynite.setConfig(key, {
        ...data,
        colors: editedColors,
      })
    } catch (e) {
      console.error('Failed to apply theme:', e)
    }
  }

  const handleExportJson = async () => {
    if (!data) return
    const exportData = { ...data, colors: editedColors }
    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeColors = data ? editedColors : {}
  const _allColorKeys = data ? Object.keys(data.colors) : []

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      {/* Toolbar */}
      <ViewHeader icon={<Palette size={16} />} title="Theme Studio">
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className={iconBtn(
            showJson ? 'bg-primary text-primary-foreground' : '',
          )}
          title={showJson ? 'Hide JSON' : 'Show JSON'}
        >
          {showJson ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          type="button"
          onClick={handleExportJson}
          className={iconBtn()}
          title="Export theme as JSON"
        >
          {copied ? (
            <Check size={14} className="text-success" />
          ) : (
            <Clipboard size={14} />
          )}
        </button>
        <button
          type="button"
          onClick={handleApplyTheme}
          className={iconBtn(
            'bg-primary text-primary-foreground hover:opacity-90',
          )}
          title="Apply theme"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={handleSelectFile}
          className={iconBtn()}
          title="Load theme file"
        >
          <Upload size={14} />
        </button>
      </ViewHeader>

      {/* Content */}
      <section className="flex-1 flex overflow-hidden relative bg-background">
        {isMock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.05] z-base">
            <span className="text-[12vw] font-black rotate-12">THEME MOCK</span>
          </div>
        )}

        {data ? (
          <>
            {/* Color Picker Grid */}
            <div
              className={`overflow-y-auto p-4 ${showJson ? 'w-1/2' : 'w-full'}`}
            >
              {data && (
                <div className="mb-4 px-1">
                  <h2 className="text-lg font-bold text-foreground">
                    {data.name || 'Untitled Theme'}
                  </h2>
                  <span
                    className={`text-[10px] font-bold uppercase ${data.type === 'dark' ? 'text-info' : 'text-warning'}`}
                  >
                    {data.type}
                  </span>
                </div>
              )}

              <div className="space-y-6">
                {COLOR_GROUPS.map((group) => (
                  <div key={group.label}>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                      {group.label}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {group.keys.map((key) => {
                        const val = activeColors[key]
                        if (!val) return null
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-3 bg-muted/30 rounded-lg p-2 border border-border/30"
                          >
                            <div className="relative shrink-0">
                              <input
                                type="color"
                                value={val}
                                onChange={(e) =>
                                  handleColorChange(key, e.target.value)
                                }
                                className="w-8 h-8 rounded-md cursor-pointer border-0 p-0"
                                style={{ background: 'none' }}
                              />
                              <div
                                className="absolute inset-0 rounded-md border border-border/50 pointer-events-none"
                                style={{ background: val }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-medium text-foreground truncate">
                                {key}
                              </div>
                              <input
                                type="text"
                                value={val}
                                onChange={(e) =>
                                  handleColorChange(key, e.target.value)
                                }
                                className="w-full bg-transparent text-[10px] font-mono text-muted-foreground border-none outline-none p-0"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* JSON Preview Panel */}
            {showJson && (
              <div className="w-1/2 border-l border-border bg-muted/20 overflow-auto">
                <div className="p-4">
                  <pre className="text-[11px] font-mono text-foreground whitespace-pre">
                    {JSON.stringify({ ...data, colors: editedColors }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Palette size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium opacity-40">
                Load a theme JSON file to edit
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-modal flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-md w-full bg-popover border border-destructive/20 rounded-xl shadow-2xl p-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertCircle size={24} />
                <h3 className="font-bold">Theme Load Error</h3>
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
