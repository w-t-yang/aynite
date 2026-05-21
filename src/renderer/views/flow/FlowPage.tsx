import {
  Background,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Viewport,
} from '@xyflow/react'
import {
  AlertCircle,
  FolderOpen,
  Maximize2,
  RefreshCw,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@xyflow/react/dist/style.css'
import { iconBtn, ViewHeader } from '../../shared/basic/ViewHeader'
import { validateJsonSchema } from '../../shared/lib/schema-validator'
import { useView } from '../ViewContext'
import type { FlowData } from './types'

const MOCK_DATA: FlowData = {
  nodes: [
    {
      id: 'input-1',
      type: 'input',
      position: { x: 50, y: 100 },
      data: { label: 'User Request' },
    },
    {
      id: 'process-1',
      type: 'default',
      position: { x: 300, y: 50 },
      data: { label: 'Validate Input' },
    },
    {
      id: 'process-2',
      type: 'default',
      position: { x: 300, y: 200 },
      data: { label: 'Process Data' },
    },
    {
      id: 'decision-1',
      type: 'default',
      position: { x: 550, y: 125 },
      data: { label: 'Check Quality?' },
    },
    {
      id: 'output-1',
      type: 'output',
      position: { x: 800, y: 50 },
      data: { label: 'Approved' },
    },
    {
      id: 'output-2',
      type: 'output',
      position: { x: 800, y: 200 },
      data: { label: 'Rejected' },
    },
  ],
  edges: [
    { id: 'e-input-validate', source: 'input-1', target: 'process-1' },
    { id: 'e-input-process', source: 'input-1', target: 'process-2' },
    {
      id: 'e-validate-decision',
      source: 'process-1',
      target: 'decision-1',
    },
    { id: 'e-process-decision', source: 'process-2', target: 'decision-1' },
    {
      id: 'e-decision-approved',
      source: 'decision-1',
      target: 'output-1',
      label: 'Pass',
    },
    {
      id: 'e-decision-rejected',
      source: 'decision-1',
      target: 'output-2',
      label: 'Fail',
    },
  ],
}

function FlowCanvas() {
  const { themes, activeThemeId } = useView()
  const reactFlow = useReactFlow()
  const [data, setData] = useState<FlowData | null>(null)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [viewConfig, setViewConfig] = useState<any>(null)
  const [isMock, setIsMock] = useState(false)

  const currentFile = useRef<string | null>(null)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const isPreview = useMemo(() => {
    const hash = window.location.hash.replace(/^#/, '')
    return new URLSearchParams(hash).get('preview') === '1'
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  // Load view config
  useEffect(() => {
    ;(window as any).aynite
      ?.getConfig('view-config', { view: 'flow' })
      .then((cfg: any) => {
        if (cfg) setViewConfig(cfg)
      })
  }, [])

  const loadMockData = useCallback(() => {
    setData(MOCK_DATA)
    setIsMock(true)
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
            throw new Error(`Invalid flow format: ${errors.join('; ')}`)
          }
        } else if (!json.nodes || !Array.isArray(json.nodes)) {
          throw new Error('Invalid flow format: missing nodes array')
        }

        setError(null)
        setData(json)
        currentFile.current = path
        setIsMock(false)
      } catch (err) {
        console.error('Failed to load flow file:', err)
        const schemaStr = viewConfig?.expected_file_type?.schema
          ? JSON.stringify(viewConfig.expected_file_type.schema, null, 2)
          : '{ "nodes": [...] }'
        setError({
          message: `Failed to load file. File might be missing or invalid.`,
          expected: schemaStr,
        })
        loadMockData()
      }
    },
    [loadMockData, viewConfig?.expected_file_type?.schema],
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

  // Apply viewport when data changes
  useEffect(() => {
    if (data?.viewport) {
      setTimeout(() => {
        reactFlow.setViewport(data.viewport as Viewport, { duration: 200 })
      }, 50)
    }
  }, [data, reactFlow])

  const handleSelectFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Flow JSON',
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
      loadMockData()
    }
  }, [loadInitialFile, loadMockData])

  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  useEffect(() => {
    if (!data) {
      setNodes([])
      setEdges([])
      return
    }

    const defaultNodeStyle = (type?: string): React.CSSProperties => {
      if (type === 'input')
        return {
          background: isDark ? '#1e40af' : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 700,
          fontSize: 12,
        }
      if (type === 'output')
        return {
          background: isDark ? '#065f46' : '#10b981',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 700,
          fontSize: 12,
        }
      return {
        background: isDark ? '#1e293b' : '#f8fafc',
        border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
        borderRadius: 8,
        padding: '8px 16px',
        fontSize: 12,
        fontWeight: 600,
      }
    }

    setNodes(
      data.nodes.map((n) => ({
        id: n.id,
        type:
          n.type === 'input'
            ? 'input'
            : n.type === 'output'
              ? 'output'
              : 'default',
        position: n.position,
        data: { label: (n.data?.label as string) || n.id },
        style: defaultNodeStyle(n.type),
      })),
    )

    setEdges(
      data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: 'smoothstep',
        label: e.label,
        animated: true,
        style: { stroke: isDark ? '#475569' : '#94a3b8', strokeWidth: 2 },
        labelStyle: { fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: isDark ? '#1e293b' : '#f8fafc' },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
      })),
    )
  }, [data, isDark])

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      {!isPreview && (
        <ViewHeader icon={<Workflow size={16} />} title="Flow Editor">
          <button
            type="button"
            onClick={() => reactFlow.zoomIn()}
            className={iconBtn()}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => reactFlow.zoomOut()}
            className={iconBtn()}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={() => reactFlow.fitView({ duration: 200 })}
            className={iconBtn()}
            title="Fit View"
          >
            <Maximize2 size={14} className="rotate-45" />
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
            title="Load flow file"
          >
            <FolderOpen size={14} />
          </button>
        </ViewHeader>
      )}

      {/* Canvas */}
      <section className="flex-1 relative">
        {isMock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] dark:opacity-[0.05] z-base">
            <span className="text-[12vw] font-black rotate-12">FLOW MOCK</span>
          </div>
        )}

        {data ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            attributionPosition="bottom-right"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color={isDark ? '#334155' : '#cbd5e1'}
              gap={20}
              size={1}
            />
          </ReactFlow>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Workflow size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium opacity-40">
                Load a flow JSON file to visualize
              </p>
            </div>
          </div>
        )}

        {/* Stats overlay */}
        {data && (
          <div className="absolute bottom-4 left-4 bg-popover/80 backdrop-blur-md border border-border p-2.5 rounded-xl shadow-2xl pointer-events-none z-layout">
            <div className="flex gap-4 text-[10px]">
              <div>
                <span className="text-primary font-bold">
                  {data.nodes.length}
                </span>{' '}
                <span className="text-muted-foreground">Nodes</span>
              </div>
              <div>
                <span className="text-primary font-bold">
                  {data.edges.length}
                </span>{' '}
                <span className="text-muted-foreground">Edges</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-modal flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-md w-full bg-popover border border-destructive/20 rounded-xl shadow-2xl p-6">
              <div className="flex items-center gap-3 text-destructive mb-4">
                <AlertCircle size={24} />
                <h3 className="font-bold">Flow Load Error</h3>
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

export function FlowPage() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
