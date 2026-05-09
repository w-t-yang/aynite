import { motion } from 'framer-motion'
import {
  AlertCircle,
  Network,
  RefreshCw,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useView } from '../ViewContext'
import type { MindMapData, MindMapNode } from './types'

const MOCK_DATA: MindMapData = {
  root: {
    id: 'root',
    label: 'Aynite Architecture',
    children: [
      {
        id: 'main',
        label: 'Main Process',
        children: [
          { id: 'm1', label: 'Window Management' },
          { id: 'm2', label: 'Config System' },
          { id: 'm3', label: 'Workspace Logic' },
          { id: 'm4', label: 'AI Bridge' },
        ],
      },
      {
        id: 'renderer',
        label: 'Renderer Process',
        children: [
          {
            id: 'hub',
            label: 'View Hub',
            children: [
              { id: 'h1', label: 'Tile Layout' },
              { id: 'h2', label: 'IPC Preload' },
            ],
          },
          {
            id: 'views',
            label: 'Micro-Apps',
            children: [
              { id: 'v1', label: 'StockChart' },
              { id: 'v2', label: 'DataChart' },
              { id: 'v3', label: 'GraphView' },
              { id: 'v4', label: 'MindMap' },
            ],
          },
        ],
      },
      {
        id: 'infra',
        label: 'Infrastructure',
        children: [
          { id: 'i1', label: 'Vite / Rollup' },
          { id: 'i2', label: 'Tailwind CSS' },
          { id: 'i3', label: 'Biome Linting' },
        ],
      },
    ],
  },
}

const EXPECTED_FORMAT = `{
  "root": {
    "id": "1",
    "label": "Topic",
    "children": [
      { "id": "2", "label": "Subtopic" }
    ]
  }
}`

interface PositionedNode extends MindMapNode {
  x: number
  y: number
  depth: number
  parentX?: number
  parentY?: number
}

export function MindMapPage() {
  const { themes, activeThemeId } = useView()
  const [data, setData] = useState<MindMapData | null>(null)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)

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

        if (!json.root?.label) {
          throw new Error('Invalid mindmap format: missing root node or label')
        }

        setError(null)
        setData(json)
        setIsMock(false)
      } catch (err) {
        console.error('Failed to load mindmap file:', err)
        setError({
          message: `Failed to load file: ${path}. File might be missing or invalid.`,
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
      } catch (e) {
        console.error('Failed to parse tile data:', e)
      }
    }

    if (initialFile) {
      loadInitialFile(initialFile)
    } else {
      loadMockData()
    }
  }, [loadInitialFile, loadMockData])

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const positionedNodes = useMemo(() => {
    if (!data) return []

    const nodes: PositionedNode[] = []
    const _nodeWidth = 180
    const _nodeHeight = 60
    const levelSpacing = 250
    const siblingSpacing = 80

    const layout = (
      node: MindMapNode,
      depth: number,
      x: number,
      startY: number,
      parentX?: number,
      parentY?: number,
    ): number => {
      const isCollapsed = collapsedNodes.has(node.id)
      const children = !isCollapsed && node.children ? node.children : []

      let totalHeight = 0
      if (children.length === 0) {
        totalHeight = siblingSpacing
      } else {
        children.forEach((child) => {
          totalHeight += layout(
            child,
            depth + 1,
            x + levelSpacing,
            startY + totalHeight,
            x,
            startY,
          )
        })
      }

      const y = startY + totalHeight / 2
      nodes.push({ ...node, x, y, depth, parentX, parentY })

      // Update the node's y in the nodes array after children are layouted
      const index = nodes.findIndex(
        (n) => n.id === node.id && n.depth === depth,
      )
      if (index !== -1) {
        nodes[index].y = y
      }

      return totalHeight
    }

    layout(data.root, 0, 100, 0)

    // Center vertically based on total layout height
    const minY = Math.min(...nodes.map((n) => n.y))
    const maxY = Math.max(...nodes.map((n) => n.y))
    const centerOffset = (maxY - minY) / 2 + minY

    return nodes.map((n) => ({
      ...n,
      y: n.y - centerOffset + (containerRef.current?.clientHeight || 600) / 2,
    }))
  }, [data, collapsedNodes])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select MindMap JSON',
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
    } catch (_err) {
      setError({
        message: 'Failed to select or parse file.',
        expected: EXPECTED_FORMAT,
      })
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    const delta = -e.deltaY
    const scaleFactor = 1.1
    const nextZoom = delta > 0 ? zoom * scaleFactor : zoom / scaleFactor
    setZoom(Math.min(Math.max(nextZoom, 0.1), 5))
  }

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      <div className="h-10 border-b border-border flex items-center px-4 gap-4 bg-muted/30 justify-between shrink-0 relative z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-primary">
            <Network size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              MindMap View
            </span>
          </div>
          <div className="h-4 w-px bg-border"></div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => z * 1.1)}
              title="Zoom In"
              className="p-1 hover:bg-muted rounded"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => z / 1.1)}
              title="Zoom Out"
              className="p-1 hover:bg-muted rounded"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1)
                setOffset({ x: 0, y: 0 })
              }}
              title="Reset"
              className="p-1 hover:bg-muted rounded"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectFile}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-1.5"
          >
            <Upload size={14} />{' '}
            <span className="text-[10px] font-bold uppercase">
              Load MindMap
            </span>
          </button>
        </div>
      </div>

      <section
        ref={containerRef}
        aria-label="Mind Map Visualization"
        className="flex-1 relative bg-background cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {isMock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
            <span className="text-[12vw] font-black rotate-12">
              MIND MAP MOCK
            </span>
          </div>
        )}

        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <svg
            className="w-full h-full overflow-visible"
            role="img"
            aria-label="Mind Map"
          >
            <title>Mind Map Visualization</title>
            <g role="menu">
              {positionedNodes.map((node) => {
                if (node.parentX === undefined || node.parentY === undefined)
                  return null

                // Curved connection path
                const dx = node.x - node.parentX
                const cp1x = node.parentX + dx / 2
                const cp2x = node.parentX + dx / 2
                const path = `M ${node.parentX} ${node.parentY} C ${cp1x} ${node.parentY}, ${cp2x} ${node.y}, ${node.x} ${node.y}`

                return (
                  <path
                    key={`link-${node.id}`}
                    d={path}
                    fill="none"
                    stroke={isDark ? '#334155' : '#cbd5e1'}
                    strokeWidth={2}
                    className="transition-all duration-300"
                  />
                )
              })}

              {positionedNodes.map((node) => (
                <motion.g
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleCollapse(node.id)
                  }}
                  className="cursor-pointer"
                  role="menuitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      toggleCollapse(node.id)
                    }
                  }}
                  aria-label={`Node ${node.label}`}
                >
                  <rect
                    x={node.x - 70}
                    y={node.y - 20}
                    width={140}
                    height={40}
                    rx={8}
                    fill={
                      node.depth === 0
                        ? 'var(--primary)'
                        : isDark
                          ? '#1e293b'
                          : '#ffffff'
                    }
                    stroke={node.depth === 0 ? 'transparent' : 'var(--border)'}
                    strokeWidth={1}
                    className="shadow-sm"
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    dy=".35em"
                    textAnchor="middle"
                    fill={
                      node.depth === 0
                        ? 'var(--primary-foreground)'
                        : isDark
                          ? '#e2e8f0'
                          : '#1e293b'
                    }
                    fontSize={12}
                    className="font-bold pointer-events-none select-none"
                  >
                    {node.label}
                  </text>
                  {node.children && node.children.length > 0 && (
                    <circle
                      cx={node.x + 70}
                      cy={node.y}
                      r={6}
                      fill={
                        collapsedNodes.has(node.id)
                          ? 'var(--primary)'
                          : isDark
                            ? '#334155'
                            : '#cbd5e1'
                      }
                      className="transition-colors duration-300"
                    />
                  )}
                </motion.g>
              ))}
            </g>
          </svg>
        </div>

        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-md w-full bg-popover border border-destructive/20 rounded-xl shadow-2xl p-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertCircle size={24} />
                <h3 className="font-bold">MindMap Load Error</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {error.message}
              </p>
              <div className="bg-muted p-3 rounded font-mono text-[10px] mb-4 overflow-auto max-h-40">
                {error.expected}
              </div>
              <button
                type="button"
                onClick={handleSelectFile}
                className="w-full bg-primary text-primary-foreground py-2 rounded font-bold"
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
