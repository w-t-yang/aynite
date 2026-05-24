import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpDown,
  FolderOpen,
  RefreshCw,
  Share2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { iconBtn, ViewHeader } from '../../shared/basic/ViewHeader'
import { validateJsonSchema } from '../../shared/lib/schema-validator'
import type { DataViewGraph, DataViewGraphNode } from './types'

const COLORS = [
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--destructive)',
  'var(--primary)',
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
]

interface NodePos extends DataViewGraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

export function DataViewGraphView() {
  const [data, setData] = useState<DataViewGraph | null>(null)
  const [nodes, setNodes] = useState<NodePos[]>([])
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [viewConfig, setViewConfig] = useState<any>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<number>(null)
  const stabilizedRef = useRef(false)
  const stabilizationFrames = useRef(0)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const currentFile = useRef<string | null>(null)

  // Load view config
  useEffect(() => {
    ;(window as any).aynite
      ?.getConfig('view-config', { view: 'dataview-graph' })
      .then((cfg: any) => {
        if (cfg) setViewConfig(cfg)
      })
  }, [])

  const isPreview = useMemo(() => {
    const hash = window.location.hash.replace(/^#/, '')
    return new URLSearchParams(hash).get('preview') === '1'
  }, [])

  const initializeNodes = useCallback((graphData: DataViewGraph) => {
    const width = containerRef.current?.clientWidth || 800
    const height = containerRef.current?.clientHeight || 600

    // Place nodes in a tighter circle for faster convergence
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.35

    const newNodes = graphData.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / graphData.nodes.length
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      }
    })
    setNodes(newNodes)
  }, [])

  const loadInitialFile = useCallback(
    async (path: string) => {
      try {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)

        // Validate against config schema if available
        if (viewConfig?.expected_file_type?.schema) {
          const { valid, errors } = validateJsonSchema(
            json,
            viewConfig.expected_file_type.schema,
          )
          if (!valid) {
            throw new Error(`Invalid graph format: ${errors.join('; ')}`)
          }
        } else if (!json.nodes || !Array.isArray(json.nodes)) {
          throw new Error('Invalid graph format: missing nodes array')
        }

        setError(null)
        setData(json)
        initializeNodes(json)
        currentFile.current = path
      } catch (err) {
        console.error('Failed to load graph file:', err)
        const schemaStr = viewConfig?.expected_file_type?.schema
          ? JSON.stringify(viewConfig.expected_file_type.schema, null, 2)
          : '{ "nodes": [...] }'
        setError({
          message: `Failed to load file: ${path}. File might be missing or invalid.`,
          expected: schemaStr,
        })
      }
    },
    [initializeNodes, viewConfig?.expected_file_type?.schema],
  )

  const loadPlaybookFile = useCallback(async () => {
    try {
      const playbookPath = await (window as any).aynite.getConfig(
        'playbook-path',
      )
      if (!playbookPath) return
      const filePath = (window as any).aynite.joinPath(
        playbookPath,
        'aynite-view-dependencies.json',
      )
      await loadInitialFile(filePath)
    } catch (err) {
      console.error('Failed to load playbook file:', err)
    }
  }, [loadInitialFile])

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
      loadPlaybookFile()
    }
  }, [loadInitialFile, loadPlaybookFile])

  // Simulation Loop with fast stabilization (~1 second)
  const animate = useCallback(
    (_time: number) => {
      if (!data || nodes.length === 0) return

      const width = containerRef.current?.clientWidth || 800
      const height = containerRef.current?.clientHeight || 600
      const centerX = width / 2
      const centerY = height / 2

      // Boosted forces for fast convergence
      const kRepulsion = 5000
      const kAttraction = 0.03
      const kCenter = 0.03
      const damping = 0.1
      const idealEdgeLength = 300

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
            const force = kAttraction * (dist - idealEdgeLength)
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

      // Stabilization detection: check if total movement is below threshold
      setNodes((prevNodes) => {
        const totalEnergy = prevNodes.reduce(
          (sum, n) => sum + Math.abs(n.vx) + Math.abs(n.vy),
          0,
        )
        const isStable = totalEnergy < 3.0

        if (isStable) {
          stabilizationFrames.current++
        } else {
          stabilizationFrames.current = 0
          stabilizedRef.current = false
        }

        // After 5 consecutive stable frames, stop the loop
        if (stabilizationFrames.current > 5) {
          stabilizedRef.current = true
          if (requestRef.current) {
            cancelAnimationFrame(requestRef.current)
            requestRef.current = null
          }
          return prevNodes
        }

        requestRef.current = requestAnimationFrame(animate)
        return prevNodes
      })
    },
    [data, nodes.length, draggedNode],
  )

  useEffect(() => {
    // Restart simulation when data changes
    stabilizedRef.current = false
    stabilizationFrames.current = 0
    if (requestRef.current) cancelAnimationFrame(requestRef.current)
    requestRef.current = requestAnimationFrame(animate)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [animate])

  // Restart simulation on drag end
  const prevDraggedNode = useRef<string | null>(null)
  useEffect(() => {
    if (prevDraggedNode.current && !draggedNode) {
      // Drag just ended — restart simulation
      stabilizedRef.current = false
      stabilizationFrames.current = 0
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      requestRef.current = requestAnimationFrame(animate)
    }
    prevDraggedNode.current = draggedNode
  }, [draggedNode, animate])

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
      const schemaStr = viewConfig?.expected_file_type?.schema
        ? JSON.stringify(viewConfig.expected_file_type.schema, null, 2)
        : '{ "nodes": [...] }'
      setError({
        message: 'Failed to select or parse file.',
        expected: schemaStr,
      })
    }
  }

  const handleRefresh = useCallback(() => {
    if (currentFile.current) {
      loadInitialFile(currentFile.current)
    } else {
      loadPlaybookFile()
    }
  }, [loadInitialFile, loadPlaybookFile])

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
      {!isPreview && (
        <ViewHeader icon={<Share2 size={16} />} title="Graph Explorer">
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
            title="Load graph file"
          >
            <FolderOpen size={14} />
          </button>
        </ViewHeader>
      )}

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
                    stroke={isHighlighted ? 'var(--primary)' : 'var(--border)'}
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
                      stroke={
                        isHovered ? 'var(--primary-foreground)' : 'transparent'
                      }
                      strokeWidth={2}
                      className="transition-all duration-300"
                    />
                    <text
                      x={node.x}
                      y={node.y + radius + 14}
                      textAnchor="middle"
                      fill="var(--card-foreground)"
                      fontSize={Math.max(7, 11 / zoom)}
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                      opacity={isHovered ? 1 : 0.85}
                    >
                      {node.label}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-layout flex items-center gap-1 bg-popover/90 backdrop-blur-md border border-border rounded-full px-3 py-1.5 shadow-xl">
          <button
            type="button"
            onClick={() => setZoom((z) => z * 1.2)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => z / 1.2)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1)
              const container = containerRef.current
              if (container && nodes.length > 0) {
                const xs = nodes.map((n) => n.x)
                const width = Math.max(...xs) - Math.min(...xs) + 100
                const fitZ = Math.max(
                  0.1,
                  Math.min(container.clientWidth / width, 5),
                )
                setZoom(fitZ)
              }
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Fit Width"
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              const container = containerRef.current
              if (container && nodes.length > 0) {
                const ys = nodes.map((n) => n.y)
                const height = Math.max(...ys) - Math.min(...ys) + 100
                const fitZ = Math.max(
                  0.1,
                  Math.min(container.clientHeight / height, 5),
                )
                setZoom(fitZ)
              }
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Fit Height"
          >
            <ArrowUpDown size={14} />
          </button>
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
          <div className="absolute inset-0 z-modal flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
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
