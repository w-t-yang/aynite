import {
  AlertCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  Share2,
  Upload,
} from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useView } from '../ViewContext'
import type { GraphData, GraphNode } from './types'

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6366f1', // indigo
]

const MOCK_DATA: GraphData = {
  nodes: [
    { id: 'aynite', label: 'Aynite Core', group: 0, val: 20 },
    { id: 'renderer', label: 'Renderer', group: 1, val: 15 },
    { id: 'main', label: 'Main Process', group: 1, val: 15 },
    { id: 'bridge', label: 'IPC Bridge', group: 2, val: 12 },
    { id: 'views', label: 'Micro-apps', group: 3, val: 10 },
    { id: 'stock', label: 'StockChart', group: 3, val: 8 },
    { id: 'data', label: 'DataChart', group: 3, val: 8 },
    { id: 'graph', label: 'GraphView', group: 3, val: 12 },
    { id: 'plugin', label: 'Plugin System', group: 4, val: 10 },
    { id: 'theme', label: 'Theme Engine', group: 4, val: 8 },
    { id: 'config', label: 'Config Router', group: 2, val: 10 },
  ],
  links: [
    { source: 'aynite', target: 'renderer' },
    { source: 'aynite', target: 'main' },
    { source: 'renderer', target: 'bridge' },
    { source: 'main', target: 'bridge' },
    { source: 'bridge', target: 'views' },
    { source: 'views', target: 'stock' },
    { source: 'views', target: 'data' },
    { source: 'views', target: 'graph' },
    { source: 'aynite', target: 'plugin' },
    { source: 'renderer', target: 'theme' },
    { source: 'main', target: 'config' },
    { source: 'bridge', target: 'config' },
    { source: 'graph', target: 'renderer' },
  ],
}

const EXPECTED_FORMAT = `{
  "nodes": [
    { "id": "1", "label": "Node A", "group": 1 },
    { "id": "2", "label": "Node B", "group": 2 }
  ],
  "links": [
    { "source": "1", "target": "2" }
  ]
}`

interface NodePos extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

export function GraphPage() {
  const { themes, activeThemeId } = useView()
  const [data, setData] = useState<GraphData | null>(null)
  const [nodes, setNodes] = useState<NodePos[]>([])
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<number>(null)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  const initializeNodes = useCallback((graphData: GraphData) => {
    const width = containerRef.current?.clientWidth || 800
    const height = containerRef.current?.clientHeight || 600

    const newNodes = graphData.nodes.map((node) => ({
      ...node,
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
    }))
    setNodes(newNodes)
  }, [])

  const loadMockData = useCallback(() => {
    setData(MOCK_DATA)
    initializeNodes(MOCK_DATA)
    setIsMock(true)
  }, [initializeNodes])

  const loadInitialFile = useCallback(
    async (path: string) => {
      try {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)

        if (!json.nodes || !Array.isArray(json.nodes)) {
          throw new Error('Invalid graph format: missing nodes array')
        }

        setError(null)
        setData(json)
        initializeNodes(json)
        setIsMock(false)
      } catch (err) {
        console.error('Failed to load graph file:', err)
        setError({
          message: `Failed to load file: ${path}. File might be missing or invalid.`,
          expected: EXPECTED_FORMAT,
        })
        loadMockData()
      }
    },
    [initializeNodes, loadMockData],
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

  // Simulation Loop
  const animate = useCallback(
    (_time: number) => {
      if (!data || nodes.length === 0) return

      const width = containerRef.current?.clientWidth || 800
      const height = containerRef.current?.clientHeight || 600
      const centerX = width / 2
      const centerY = height / 2

      const kRepulsion = 1500
      const kAttraction = 0.05
      const kCenter = 0.01
      const damping = 0.9

      setNodes((prevNodes) => {
        const nextNodes = prevNodes.map((n) => ({ ...n }))
        const nodeMap = new Map(nextNodes.map((n) => [n.id, n]))

        for (let i = 0; i < nextNodes.length; i++) {
          const node = nextNodes[i]

          // Skip dragged node physics or keep it attached to mouse
          if (node.id === draggedNode) continue

          // Repulsion
          for (let j = 0; j < nextNodes.length; j++) {
            if (i === j) continue
            const other = nextNodes[j]
            const dx = node.x - other.x
            const dy = node.y - other.y
            const distSq = dx * dx + dy * dy + 1
            const force = kRepulsion / distSq
            node.vx += (dx / Math.sqrt(distSq)) * force
            node.vy += (dy / Math.sqrt(distSq)) * force
          }

          // Centering
          node.vx += (centerX - node.x) * kCenter
          node.vy += (centerY - node.y) * kCenter
        }

        // Attraction (Links)
        data.links.forEach((link) => {
          const source = nodeMap.get(
            typeof link.source === 'string'
              ? link.source
              : (link.source as any).id,
          )
          const target = nodeMap.get(
            typeof link.target === 'string'
              ? link.target
              : (link.target as any).id,
          )
          if (source && target) {
            const dx = target.x - source.x
            const dy = target.y - source.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist === 0) return
            const force = kAttraction * (dist - 100)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            if (source.id !== draggedNode) {
              source.vx += fx
              source.vy += fy
            }
            if (target.id !== draggedNode) {
              target.vx -= fx
              target.vy -= fy
            }
          }
        })

        // Update positions
        nextNodes.forEach((node) => {
          if (node.id === draggedNode) return
          node.x += node.vx
          node.y += node.vy
          node.vx *= damping
          node.vy *= damping
        })

        return nextNodes
      })

      requestRef.current = requestAnimationFrame(animate)
    },
    [data, nodes.length, draggedNode],
  )

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [animate])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Graph JSON',
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
    if (e.button !== 0) return // Only left click
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !draggedNode) {
      setOffset((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }))
    } else if (draggedNode) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - offset.x) / zoom
        const y = (e.clientY - rect.top - offset.y) / zoom
        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggedNode ? { ...n, x, y, vx: 0, vy: 0 } : n,
          ),
        )
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDraggedNode(null)
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
            <Share2 size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Graph Explorer
            </span>
          </div>
          <div className="h-4 w-px bg-border"></div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => z * 1.2)}
              className="p-1 hover:bg-muted rounded"
            >
              <Maximize2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => z / 1.2)}
              className="p-1 hover:bg-muted rounded"
            >
              <Minimize2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1)
                setOffset({ x: 0, y: 0 })
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <RefreshCw size={12} />
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
            <span className="text-[10px] font-bold uppercase">Load Graph</span>
          </button>
        </div>
      </div>

      <section
        ref={containerRef}
        aria-label="Graph Visualization"
        className="flex-1 relative bg-background cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {isMock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
            <span className="text-[12vw] font-black rotate-12">GRAPH MOCK</span>
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
            aria-label="Network Graph"
          >
            <title>Network Graph Visualization</title>
            <g>
              {data?.links.map((link, _i) => {
                const s = nodes.find(
                  (n) =>
                    n.id ===
                    (typeof link.source === 'string'
                      ? link.source
                      : (link.source as any).id),
                )
                const t = nodes.find(
                  (n) =>
                    n.id ===
                    (typeof link.target === 'string'
                      ? link.target
                      : (link.target as any).id),
                )
                if (!s || !t) return null
                const isHighlighted =
                  hoveredNode === s.id || hoveredNode === t.id
                return (
                  <line
                    key={`${s.id}-${t.id}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={
                      isHighlighted
                        ? 'var(--primary)'
                        : isDark
                          ? '#334155'
                          : '#cbd5e1'
                    }
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeOpacity={isHighlighted ? 1 : 0.4}
                    className="transition-all duration-300"
                  />
                )
              })}

              {nodes.map((node) => {
                const color = COLORS[node.group || 0 % COLORS.length]
                const radius = node.val || 10
                const isHovered = hoveredNode === node.id
                const isConnected =
                  hoveredNode &&
                  data?.links.some(
                    (l) =>
                      (l.source === node.id && l.target === hoveredNode) ||
                      (l.target === node.id && l.source === hoveredNode),
                  )

                return (
                  <g
                    key={node.id}
                    role="menuitem"
                    tabIndex={0}
                    aria-label={`Node ${node.label}`}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setDraggedNode(node.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setHoveredNode(node.id)
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isHovered ? radius * 1.5 : radius}
                      fill={color}
                      fillOpacity={isHovered || isConnected ? 1 : 0.6}
                      stroke={isHovered ? 'white' : 'transparent'}
                      strokeWidth={2}
                      className="transition-all duration-300"
                    />
                    {(isHovered || zoom > 0.8) && (
                      <text
                        x={node.x}
                        y={node.y + radius + 15}
                        textAnchor="middle"
                        fill={isDark ? '#e2e8f0' : '#1e293b'}
                        fontSize={12 / zoom}
                        className="font-bold pointer-events-none select-none drop-shadow-sm"
                      >
                        {node.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {/* Info Overlay */}
        <div className="absolute bottom-4 right-4 bg-popover/80 backdrop-blur-md border border-border p-3 rounded-xl shadow-2xl pointer-events-none">
          <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
            Graph Stats
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-primary">{nodes.length}</span>{' '}
              <span className="text-[10px] text-muted-foreground">Nodes</span>
            </div>
            <div>
              <span className="text-primary">{data?.links.length || 0}</span>{' '}
              <span className="text-[10px] text-muted-foreground">Edges</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-md w-full bg-popover border border-destructive/20 rounded-xl shadow-2xl p-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertCircle size={24} />
                <h3 className="font-bold">Graph Load Error</h3>
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
