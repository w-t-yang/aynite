import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  Upload,
  X,
} from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppEvent, useAppOperation, useView } from '../ViewContext'
import { aggregateData, enrichDataWithIndicators } from './indicators'
import { DEFAULT_INDICATORS, type StockData, TimeInterval } from './types'

// Custom Shape for Candlestick
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload, upColor, downColor } = props

  if (!payload) return null

  const { open, close, high, low } = payload
  const isUp = close >= open
  const color = isUp ? upColor : downColor
  const cx = x + width / 2

  const range = high - low
  const pixelRatio = range === 0 ? 0 : height / range

  const openOffset = (high - open) * pixelRatio
  const closeOffset = (high - close) * pixelRatio

  const bodyY = y + Math.min(openOffset, closeOffset)
  const bodyH = Math.abs(openOffset - closeOffset)

  return (
    <g>
      <line
        x1={cx}
        y1={y}
        x2={cx}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      <rect
        x={x}
        y={bodyY}
        width={width}
        height={Math.max(1, bodyH)}
        fill={color}
      />
    </g>
  )
}

const CustomTooltip = ({
  active,
  payload,
  label,
  theme,
  upColor,
  downColor,
}: any) => {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload

  return (
    <div
      className={`p-3 border rounded shadow-xl backdrop-blur-md text-xs font-mono z-50
      ${theme === 'dark' ? 'bg-[#1e293b]/95 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800'}
    `}
    >
      <div className="font-bold mb-2 border-b border-slate-500/20 pb-1 text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-3">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Open</span>{' '}
          <span>{data.open.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">High</span>{' '}
          <span>{data.high.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Low</span>{' '}
          <span>{data.low.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Close</span>{' '}
          <span
            style={{ color: data.close >= data.open ? upColor : downColor }}
          >
            {data.close.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2 border-b border-slate-500/20 pb-2">
        <span className="text-slate-500 dark:text-slate-400">Volume</span>
        <span>{(data.volume / 1000000).toFixed(2)}M</span>
      </div>

      <div className="space-y-1">
        {payload.map((entry: any, _index: number) => {
          if (['Price', 'Volume', 'Histogram'].includes(entry.name)) return null
          if (Array.isArray(entry.value)) return null

          return (
            <div
              key={entry.name}
              className="flex justify-between items-center gap-4"
            >
              <span
                style={{ color: entry.color }}
                className="flex items-center gap-1 font-semibold"
              >
                {entry.name}
              </span>
              <span>
                {typeof entry.value === 'number'
                  ? entry.value.toFixed(2)
                  : entry.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const generateMockData = (count = 300): StockData[] => {
  const data: StockData[] = []
  let price = 150 + Math.random() * 50
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - (count - i))

    const open = price + (Math.random() - 0.5) * 5
    const close = open + (Math.random() - 0.5) * 10
    const high = Math.max(open, close) + Math.random() * 5
    const low = Math.min(open, close) - Math.random() * 5
    const volume = Math.floor(Math.random() * 10000000) + 1000000

    data.push({
      time: date.toISOString().split('T')[0],
      open,
      high,
      low,
      close,
      volume,
      sma20: price + Math.random() * 2, // Mock indicators
      rsi: 40 + Math.random() * 20,
    })
    price = close
  }
  return data
}

export function StockChart() {
  const { themes, activeThemeId } = useView()
  const executeOperation = useAppOperation()
  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const themeType = currentTheme?.type || 'dark'

  const [rawHistory, setRawHistory] = useState<StockData[]>([])
  const [data, setData] = useState<StockData[]>([])
  const [symbol, setSymbol] = useState<string>('AAPL')
  const [timeframe, setTimeframe] = useState<string>('1d')
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS)
  const [compareData, setCompareData] = useState<StockData[] | null>(null)
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null)
  const [isMock, setIsMock] = useState(false)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  // UI State
  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState(false)
  const [_isComparePromptOpen, _setIsComparePromptOpen] = useState(false)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const _fileInputRef = useRef<HTMLInputElement>(null)

  const EXPECTED_FORMAT = `{
  "symbol": "AAPL",
  "data": [
    { "time": "2024-01-01", "open": 150.0, "high": 155.0, "low": 148.0, "close": 152.0, "volume": 1000000 }
  ]
}
OR
{
  "metadata": { "symbol": "AAPL" },
  "history": [
    { "date": "2024-01-01", "open": 150.0, ... }
  ]
}`

  const parseJsonData = useCallback((json: any, defaultSymbol: string) => {
    let parsedData: StockData[] = []
    let parsedSymbol = defaultSymbol

    if (json.history && Array.isArray(json.history)) {
      parsedData = json.history.map((d: any) => ({
        ...d,
        time: d.time || d.date,
      }))
      if (json.metadata?.symbol) parsedSymbol = json.metadata.symbol
    } else if (json.data && Array.isArray(json.data)) {
      parsedData = json.data.map((d: any) => ({
        ...d,
        time: d.time || d.date,
      }))
      if (json.symbol) parsedSymbol = json.symbol
    } else if (Array.isArray(json)) {
      parsedData = json.map((d: any) => ({ ...d, time: d.time || d.date }))
    }
    return { data: parsedData, symbol: parsedSymbol }
  }, [])

  const loadMockData = useCallback(() => {
    setSymbol('SIMULATED AAPL')
    setRawHistory(generateMockData(300))
    setIsMock(true)
  }, [])

  const loadInitialFile = useCallback(
    async (path: string) => {
      try {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)
        const { data: parsedData, symbol: parsedSymbol } = parseJsonData(
          json,
          symbol,
        )

        if (parsedData.length === 0) throw new Error('No data found')

        setSymbol(parsedSymbol)
        setRawHistory(parsedData)
        setIsMock(false)
      } catch (err) {
        console.error('Failed to load initial file:', err)
        setError({
          message: `Failed to load file: ${path}. File might be missing or in an invalid format.`,
          expected: EXPECTED_FORMAT,
        })
        loadMockData()
      }
    },
    [symbol, parseJsonData, loadMockData],
  )

  // Initial load from tile config
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
        console.error('Failed to parse tile data from hash:', e)
      }
    }

    if (initialFile) {
      loadInitialFile(initialFile)
    } else {
      loadMockData()
    }
  }, [loadInitialFile, loadMockData])

  // Listen for data updates
  useAppEvent('chart-data', (payload: any) => {
    setError(null)
    if (payload.data) {
      const mappedData = payload.data.map((item: any) => ({
        ...item,
        time: item.time || item.date,
      }))
      setRawHistory(mappedData)
      setIsMock(false)
    }
    if (payload.symbol) setSymbol(payload.symbol)
    if (payload.timeframe) setTimeframe(payload.timeframe)
    if (payload.indicators)
      setIndicators((prev) => ({ ...prev, ...payload.indicators }))
    if (payload.compareData) {
      const mappedCompare = payload.compareData.map((item: any) => ({
        ...item,
        time: item.time || item.date,
      }))
      setCompareData(enrichDataWithIndicators(mappedCompare))
    }
    if (payload.compareSymbol) setCompareSymbol(payload.compareSymbol)
  })

  const handleSelectSystemFile = async () => {
    try {
      const path = await (window as any).aynite.selectFile({
        title: 'Select Stock Data JSON',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (path) {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)
        const { data: parsedData, symbol: parsedSymbol } = parseJsonData(
          json,
          symbol,
        )

        if (parsedData.length === 0 || !parsedData[0].close) {
          throw new Error('Invalid data structure')
        }

        setError(null)
        setSymbol(parsedSymbol)
        setRawHistory(parsedData)
        setIsMock(false)

        // Save to tile config for persistence
        if (tileId) {
          ;(window as any).aynite.setConfig('tile-data', {
            tileId,
            data: { file: path },
          })
        }
      }
    } catch (err) {
      console.error('Failed to select or parse file:', err)
      setError({
        message: 'Failed to select or parse JSON file.',
        expected: EXPECTED_FORMAT,
      })
    }
  }

  // Process data whenever rawHistory or timeframe changes
  useEffect(() => {
    if (!rawHistory || rawHistory.length === 0) return

    // 1. Aggregate based on timeframe
    const aggregated = aggregateData(rawHistory, timeframe)

    // 2. Enrich with indicators
    const enriched = enrichDataWithIndicators(aggregated)

    setData(enriched)
  }, [rawHistory, timeframe])

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf)
    // Request new data from parent if in an active trading context
    executeOperation('fetch-chart-data', { symbol, interval: tf })

    // For mock demonstration
    if (isMock) {
      loadMockData()
    }
  }

  const toggleIndicator = (key: keyof typeof indicators) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // --- Pan & Zoom State ---
  const [visibleCount, setVisibleCount] = useState(100)
  const [startIndex, setStartIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // Colors based on theme
  const textColor = themeType === 'dark' ? '#94a3b8' : '#64748b'
  const gridColor = themeType === 'dark' ? '#1e293b' : '#e2e8f0'

  const COLOR_UP = 'var(--success)'
  const COLOR_DOWN = 'var(--destructive)'
  const COLOR_VOL_UP = 'var(--success)'
  const COLOR_VOL_DOWN = 'var(--destructive)'

  useEffect(() => {
    if (data && data.length > 0) {
      setStartIndex(Math.max(0, data.length - visibleCount))
    }
  }, [data?.length, data, visibleCount])

  useEffect(() => {
    if (!data) return
    if (startIndex + visibleCount > data.length) {
      setStartIndex(Math.max(0, data.length - visibleCount))
    }
  }, [visibleCount, data, startIndex])

  const handleWheel = (e: React.WheelEvent) => {
    if (!data || data.length === 0) return
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
    let newCount = Math.floor(visibleCount * zoomFactor)
    newCount = Math.max(20, Math.min(newCount, data.length))
    newCount = Math.min(newCount, 500)

    const diff = newCount - visibleCount
    let newStart = startIndex - Math.floor(diff / 2)
    newStart = Math.max(0, Math.min(newStart, data.length - newCount))

    setVisibleCount(newCount)
    setStartIndex(newStart)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStartX(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !data || data.length === 0) return

    if (rafRef.current) return

    rafRef.current = requestAnimationFrame(() => {
      const deltaX = dragStartX - e.clientX
      const width = containerRef.current?.clientWidth || 1000
      const pixelsPerBar = width / visibleCount
      const barsMoved = Math.round(deltaX / pixelsPerBar)

      if (barsMoved !== 0) {
        let newStart = startIndex + barsMoved
        newStart = Math.max(0, Math.min(newStart, data.length - visibleCount))

        if (newStart !== startIndex) {
          setStartIndex(newStart)
          setDragStartX(e.clientX)
        }
      }
      rafRef.current = null
    })
  }

  const _pixelsPerBar = useMemo(() => {
    const width = containerRef.current?.clientWidth || 1000
    return width / visibleCount
  }, [visibleCount])

  const handleMouseUp = () => {
    setIsDragging(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const visibleData = useMemo(() => {
    if (!data) return []
    return data.slice(startIndex, startIndex + visibleCount)
  }, [data, startIndex, visibleCount])

  const chartData = useMemo(() => {
    if (!compareData) return visibleData

    const mainPrices = visibleData.map((d) => d.close)
    const comparePrices = compareData
      .slice(startIndex, startIndex + visibleCount)
      .map((d) => d.close)

    if (mainPrices.length === 0 || comparePrices.length === 0)
      return visibleData

    const mainMin = Math.min(...mainPrices)
    const mainMax = Math.max(...mainPrices)
    const compareMin = Math.min(...comparePrices)
    const compareMax = Math.max(...comparePrices)

    const mainRange = mainMax - mainMin
    const compareRange = compareMax - compareMin

    if (compareRange === 0) return visibleData

    return visibleData.map((d, i) => {
      const absoluteIndex = startIndex + i
      const compareClose = compareData[absoluteIndex]?.close
      const normalizedCompare =
        compareClose !== undefined
          ? ((compareClose - compareMin) / compareRange) * mainRange + mainMin
          : undefined

      return {
        ...d,
        compareClose: normalizedCompare,
      }
    })
  }, [visibleData, compareData, startIndex, visibleCount])

  const { dataMin, dataMax } = useMemo(() => {
    if (chartData.length === 0) return { dataMin: 0, dataMax: 100 }

    let min = Math.min(...chartData.map((d) => d.low))
    let max = Math.max(...chartData.map((d) => d.high))

    if (indicators.bollinger) {
      const bLower = Math.min(
        ...chartData
          .filter((d) => d.bollingerLower != null)
          .map((d) => d.bollingerLower as number),
      )
      if (Number.isFinite(bLower)) min = Math.min(min, bLower)
      const bUpper = Math.max(
        ...chartData
          .filter((d) => d.bollingerUpper != null)
          .map((d) => d.bollingerUpper as number),
      )
      if (Number.isFinite(bUpper)) max = Math.max(max, bUpper)
    }

    const range = max - min
    const padding = range * 0.05

    return { dataMin: min - padding, dataMax: max + padding }
  }, [chartData, indicators])

  const priceAxisDomain = useMemo(() => {
    const range = dataMax - dataMin
    if (range === 0) return [dataMin - 1, dataMax + 1]
    const fullAxisRange = range / 0.75
    const axisMin = dataMax - fullAxisRange
    return [axisMin, dataMax]
  }, [dataMin, dataMax])

  const volumeDomain = useMemo(() => {
    if (!chartData.length) return [0, 100]
    const maxVol = Math.max(...chartData.map((d) => d.volume))
    return [0, maxVol * 4]
  }, [chartData])

  const macdDomain = useMemo(() => {
    if (!indicators.macd || !chartData.length) return [-10, 10]
    const values = chartData
      .flatMap((d) => [d.macdLine, d.signalLine, d.histogram])
      .filter((v) => v != null) as number[]
    if (values.length === 0) return [-10, 10]

    let min = Math.min(...values)
    let max = Math.max(...values)
    const range = max - min
    const padding = range * 0.1
    min -= padding
    max += padding
    return [min, min + (max - min) * 4]
  }, [chartData, indicators.macd])

  const stochDomain = [0, 400]
  const rsiDomain = [0, 400]
  const atrDomain = [0, 10]
  const cciDomain = [-200, 600]

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm animate-pulse">
          Waiting for Chart Data...
        </div>
      </div>
    )
  }

  const latest = data[data.length - 1]

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      {/* Chart Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-4 bg-muted/30 justify-between shrink-0 relative z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[10px] font-bold">
            {[
              TimeInterval.D1,
              TimeInterval.W1,
              TimeInterval.M1,
              TimeInterval.Y1,
            ].map((tf) => (
              <button
                type="button"
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={`px-2 py-1 rounded transition-colors uppercase ${
                  timeframe === tf
                    ? 'text-primary-foreground bg-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-border"></div>

          {/* Indicators Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsIndicatorMenuOpen(!isIndicatorMenuOpen)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Activity size={14} /> INDICATORS <ChevronDown size={12} />
            </button>

            {isIndicatorMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 w-full h-full bg-transparent border-none cursor-default"
                  onClick={() => setIsIndicatorMenuOpen(false)}
                  aria-label="Close menu"
                />
                <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-lg shadow-xl z-20 overflow-hidden py-1 max-h-[70vh] overflow-y-auto backdrop-blur-md">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase opacity-50">
                    Trend & Moving Averages
                  </div>
                  {[
                    { id: 'sma5', label: 'SMA 5' },
                    { id: 'sma10', label: 'SMA 10' },
                    { id: 'sma20', label: 'SMA 20' },
                    { id: 'sma50', label: 'SMA 50' },
                    { id: 'sma100', label: 'SMA 100' },
                    { id: 'sma200', label: 'SMA 200' },
                    { id: 'ema12', label: 'EMA 12' },
                    { id: 'ema26', label: 'EMA 26' },
                    { id: 'ema50', label: 'EMA 50' },
                    { id: 'ema200', label: 'EMA 200' },
                    { id: 'vwap', label: 'VWAP' },
                    { id: 'sar', label: 'Parabolic SAR' },
                  ].map((ind) => (
                    <button
                      type="button"
                      key={ind.id}
                      onClick={() => toggleIndicator(ind.id as any)}
                      className="w-full text-left px-4 py-1.5 text-xs hover:bg-muted flex justify-between items-center text-popover-foreground"
                    >
                      {ind.label}{' '}
                      {indicators[ind.id as keyof typeof indicators] && (
                        <Check size={12} className="text-primary" />
                      )}
                    </button>
                  ))}

                  <div className="border-t border-border my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase opacity-50">
                    Channels & Bands
                  </div>
                  {[
                    { id: 'bollinger', label: 'Bollinger Bands' },
                    { id: 'donchian', label: 'Donchian Channels' },
                    { id: 'keltner', label: 'Keltner Channels' },
                  ].map((ind) => (
                    <button
                      type="button"
                      key={ind.id}
                      onClick={() => toggleIndicator(ind.id as any)}
                      className="w-full text-left px-4 py-1.5 text-xs hover:bg-muted flex justify-between items-center text-popover-foreground"
                    >
                      {ind.label}{' '}
                      {indicators[ind.id as keyof typeof indicators] && (
                        <Check size={12} className="text-primary" />
                      )}
                    </button>
                  ))}

                  <div className="border-t border-border my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase opacity-50">
                    Oscillators
                  </div>
                  {[
                    { id: 'macd', label: 'MACD' },
                    { id: 'rsi', label: 'RSI' },
                    { id: 'stoch', label: 'Stochastic' },
                    { id: 'cci', label: 'CCI' },
                    { id: 'atr', label: 'ATR' },
                  ].map((ind) => (
                    <button
                      type="button"
                      key={ind.id}
                      onClick={() => toggleIndicator(ind.id as any)}
                      className="w-full text-left px-4 py-1.5 text-xs hover:bg-muted flex justify-between items-center text-popover-foreground"
                    >
                      {ind.label}{' '}
                      {indicators[ind.id as keyof typeof indicators] && (
                        <Check size={12} className="text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectSystemFile}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-1.5"
            title="Load JSON File"
          >
            <Upload size={14} />{' '}
            <span className="text-[10px] font-bold">LOAD JSON</span>
          </button>
        </div>
      </div>

      <section
        aria-label="Stock Chart"
        ref={containerRef}
        className={`flex-1 relative select-none group overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'} bg-background transition-colors`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Mock Watermark */}
        {isMock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
            <span className="text-[15vw] font-black tracking-tighter rotate-12 whitespace-nowrap">
              SIMULATED DATA
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <div className="max-w-xl w-full bg-popover border-2 border-destructive/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-destructive/10 p-4 flex items-start gap-4 border-b border-destructive/20">
                <div className="bg-destructive text-destructive-foreground p-2 rounded-lg">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-destructive">Invalid Data</h3>
                  <p className="text-sm text-muted-foreground">
                    {error.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4">
                <h4 className="text-xs font-bold text-muted-foreground mb-2 uppercase">
                  Expected Format Examples:
                </h4>
                <pre className="bg-muted p-4 rounded-lg text-[10px] font-mono overflow-x-auto border border-border whitespace-pre">
                  {error.expected}
                </pre>
              </div>
              <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={handleSelectSystemFile}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Upload size={16} /> LOAD ANOTHER FILE
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
            {symbol}
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
              {timeframe}
            </span>
          </h2>
          <div className="flex items-center gap-4 text-xs font-mono mt-1">
            <span className="text-muted-foreground">
              O{' '}
              <span
                style={{
                  color: latest.close >= latest.open ? COLOR_UP : COLOR_DOWN,
                }}
              >
                {latest.open.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              H{' '}
              <span
                style={{
                  color: latest.close >= latest.open ? COLOR_UP : COLOR_DOWN,
                }}
              >
                {latest.high.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              L{' '}
              <span
                style={{
                  color: latest.close >= latest.open ? COLOR_UP : COLOR_DOWN,
                }}
              >
                {latest.low.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              C{' '}
              <span
                style={{
                  color: latest.close >= latest.open ? COLOR_UP : COLOR_DOWN,
                }}
              >
                {latest.close.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Vol{' '}
              <span className="text-foreground">
                {(latest.volume / 1000000).toFixed(2)}M
              </span>
            </span>
          </div>
        </div>

        {compareSymbol && (
          <div className="absolute top-4 right-20 z-10 pointer-events-none">
            <div className="flex items-center gap-2 bg-muted/80 px-3 py-1 rounded-full border border-border">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="font-bold text-yellow-600 dark:text-yellow-400 text-xs">
                {compareSymbol}
              </span>
            </div>
          </div>
        )}

        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          debounce={50}
        >
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke={gridColor}
              vertical={true}
              horizontal={true}
              strokeDasharray="3 3"
              opacity={0.5}
            />

            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: textColor, fontSize: 10 }}
              minTickGap={50}
              height={20}
              padding={{ left: 0, right: 0 }}
            />

            <YAxis
              yAxisId="volume"
              orientation="left"
              domain={volumeDomain}
              hide
            />
            <YAxis
              yAxisId="macd"
              orientation="right"
              domain={macdDomain}
              hide
            />
            <YAxis yAxisId="rsi" orientation="right" domain={rsiDomain} hide />
            <YAxis
              yAxisId="stoch"
              orientation="right"
              domain={stochDomain}
              hide
            />
            <YAxis yAxisId="cci" orientation="right" domain={cciDomain} hide />
            <YAxis yAxisId="atr" orientation="right" domain={atrDomain} hide />

            <YAxis
              yAxisId="price"
              domain={priceAxisDomain}
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: textColor, fontSize: 11, fontFamily: 'monospace' }}
              tickFormatter={(value) => Number(value).toFixed(2)}
              width={24}
              allowDecimals={true}
              type="number"
            />

            <Tooltip
              cursor={{
                stroke: textColor,
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
              content={
                <CustomTooltip
                  theme={themeType}
                  upColor={COLOR_UP}
                  downColor={COLOR_DOWN}
                />
              }
            />

            <Bar
              dataKey="volume"
              yAxisId="volume"
              name="Volume"
              isAnimationActive={false}
              barSize={4}
              opacity={0.3}
            >
              {chartData.map((entry, _index) => (
                <Cell
                  key={`cell-${entry.time}`}
                  fill={
                    entry.close >= entry.open ? COLOR_VOL_UP : COLOR_VOL_DOWN
                  }
                />
              ))}
            </Bar>

            {indicators.macd && (
              <>
                <Bar
                  dataKey="histogram"
                  yAxisId="macd"
                  name="Histogram"
                  isAnimationActive={false}
                  barSize={4}
                >
                  {chartData.map((entry, _index) => (
                    <Cell
                      key={`hist-${entry.time}`}
                      fill={(entry.histogram || 0) >= 0 ? COLOR_UP : COLOR_DOWN}
                      fillOpacity={0.5}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="macd"
                  type="monotone"
                  dataKey="macdLine"
                  stroke="#2962ff"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                  name="MACD"
                />
                <Line
                  yAxisId="macd"
                  type="monotone"
                  dataKey="signalLine"
                  stroke="#ff6d00"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                  name="Signal"
                />
              </>
            )}

            {indicators.rsi && (
              <>
                <Line
                  yAxisId="rsi"
                  type="monotone"
                  dataKey="rsi"
                  stroke="#a855f7"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  name="RSI"
                />
                <ReferenceLine
                  yAxisId="rsi"
                  y={70}
                  stroke="#a855f7"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  yAxisId="rsi"
                  y={30}
                  stroke="#a855f7"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
              </>
            )}

            {indicators.cci && (
              <>
                <Line
                  yAxisId="cci"
                  type="monotone"
                  dataKey="cci"
                  stroke="#06b6d4"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  name="CCI"
                />
                <ReferenceLine
                  yAxisId="cci"
                  y={100}
                  stroke="#06b6d4"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  yAxisId="cci"
                  y={-100}
                  stroke="#06b6d4"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  yAxisId="cci"
                  y={0}
                  stroke="#06b6d4"
                  strokeDasharray="3 3"
                  strokeOpacity={0.3}
                />
              </>
            )}

            {indicators.atr && (
              <Line
                yAxisId="atr"
                type="monotone"
                dataKey="atr"
                stroke="#f43f5e"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="ATR"
              />
            )}

            {indicators.stoch && (
              <>
                <Line
                  yAxisId="stoch"
                  type="monotone"
                  dataKey="stochK"
                  stroke="#fb923c"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  name="%K"
                />
                <Line
                  yAxisId="stoch"
                  type="monotone"
                  dataKey="stochD"
                  stroke="#fdba74"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                  name="%D"
                />
                <ReferenceLine
                  yAxisId="stoch"
                  y={80}
                  stroke="#fb923c"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
                <ReferenceLine
                  yAxisId="stoch"
                  y={20}
                  stroke="#fb923c"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
              </>
            )}

            {indicators.bollinger && (
              <>
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="bollingerUpper"
                  stroke="#8b5cf6"
                  strokeOpacity={0.5}
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="bollingerLower"
                  stroke="#8b5cf6"
                  strokeOpacity={0.5}
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                />
              </>
            )}

            <Bar
              dataKey={(d) => [d.low, d.high]}
              yAxisId="price"
              shape={
                <CandlestickShape upColor={COLOR_UP} downColor={COLOR_DOWN} />
              }
              isAnimationActive={false}
              name="Price"
              barSize={6}
            />

            {indicators.sma5 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="sma5"
                stroke="#06b6d4"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="SMA 5"
              />
            )}
            {indicators.sma10 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="sma10"
                stroke="#0ea5e9"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="SMA 10"
              />
            )}
            {indicators.sma20 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="sma20"
                stroke="#2962ff"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="SMA 20"
              />
            )}
            {indicators.sma50 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="sma50"
                stroke="#6366f1"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="SMA 50"
              />
            )}
            {indicators.sma100 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="sma100"
                stroke="#22c55e"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="SMA 100"
              />
            )}
            {indicators.sma200 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="sma200"
                stroke="#10b981"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="SMA 200"
              />
            )}

            {indicators.ema12 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ema12"
                stroke="#eab308"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="EMA 12"
              />
            )}
            {indicators.ema26 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ema26"
                stroke="#ff9800"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="EMA 26"
              />
            )}
            {indicators.ema50 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ema50"
                stroke="#f59e0b"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="EMA 50"
              />
            )}
            {indicators.ema200 && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="ema200"
                stroke="#ef4444"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
                name="EMA 200"
              />
            )}

            {indicators.vwap && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="vwap"
                stroke="#e11d48"
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                isAnimationActive={false}
                name="VWAP"
              />
            )}

            {indicators.donchian && (
              <>
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="donchianHigh"
                  stroke="#0ea5e9"
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  isAnimationActive={false}
                  name="DC High"
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="donchianLow"
                  stroke="#0ea5e9"
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  isAnimationActive={false}
                  name="DC Low"
                />
              </>
            )}

            {indicators.keltner && (
              <>
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="keltnerMiddle"
                  stroke="#14b8a6"
                  dot={false}
                  strokeWidth={1}
                  isAnimationActive={false}
                  name="Keltner Mid"
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="keltnerUpper"
                  stroke="#14b8a6"
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  isAnimationActive={false}
                  name="Keltner Upper"
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="keltnerLower"
                  stroke="#14b8a6"
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  isAnimationActive={false}
                  name="Keltner Lower"
                />
              </>
            )}

            {indicators.sar && (
              <Scatter
                yAxisId="price"
                dataKey="sar"
                fill="#3b82f6"
                shape="circle"
                isAnimationActive={false}
                name="SAR"
              />
            )}

            {compareData && (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="compareClose"
                stroke="#facc15"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
                name={compareSymbol || 'Compare'}
              />
            )}

            <ReferenceLine
              yAxisId="price"
              y={latest.close}
              stroke={latest.close >= latest.open ? COLOR_UP : COLOR_DOWN}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
