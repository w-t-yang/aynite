import {
  AlertCircle,
  AreaChart as AreaChartIcon,
  BarChart3,
  ChevronDown,
  LineChart,
  PieChart as PieChartIcon,
  Radar,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  RadarChart,
  LineChart as ReLineChart,
  Radar as ReRadar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useView } from '../ViewContext'
import { type ChartData, ChartType } from './types'

const COLORS = [
  'var(--primary)',
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--destructive)',
  '#8b5cf6',
  '#ec4899',
  '#6366f1',
]

const MOCK_DATA: ChartData = {
  title: 'Sample Business Performance',
  keys: ['Revenue', 'Profit', 'Expenses'],
  data: [
    { name: 'Mon', Revenue: 4000, Profit: 2400, Expenses: 1600 },
    { name: 'Tue', Revenue: 3000, Profit: 1398, Expenses: 1602 },
    { name: 'Wed', Revenue: 2000, Profit: 9800, Expenses: 2200 },
    { name: 'Thu', Revenue: 2780, Profit: 3908, Expenses: 2000 },
    { name: 'Fri', Revenue: 1890, Profit: 4800, Expenses: 2181 },
    { name: 'Sat', Revenue: 2390, Profit: 3800, Expenses: 2500 },
    { name: 'Sun', Revenue: 3490, Profit: 4300, Expenses: 2100 },
  ],
}

const EXPECTED_FORMAT = `{
  "title": "My Data Chart",
  "keys": ["Value1", "Value2"],
  "data": [
    { "name": "A", "Value1": 10, "Value2": 20 },
    { "name": "B", "Value1": 15, "Value2": 25 }
  ]
}`

export function DataChartPage() {
  const { themes, activeThemeId } = useView()
  const [chartType, setChartType] = useState<ChartType>(ChartType.BAR)
  const [data, setData] = useState<ChartData | null>(null)
  const [error, setError] = useState<{
    message: string
    expected: string
  } | null>(null)
  const [isMock, setIsMock] = useState(false)
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false)

  const tileId = useMemo(() => {
    const hash = window.location.hash
    const match = hash.match(/tileId=([^&]+)/)
    return match ? match[1] : null
  }, [])

  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const themeType = currentTheme?.type || 'dark'

  const loadMockData = useCallback(() => {
    setData(MOCK_DATA)
    setIsMock(true)
  }, [])

  const loadInitialFile = useCallback(
    async (path: string) => {
      try {
        const content = await (window as any).aynite.readFile(path)
        const json = JSON.parse(content)

        if (!json.data || !Array.isArray(json.data) || !json.keys) {
          throw new Error('Invalid data format: missing data array or keys')
        }

        setError(null)
        setData(json)
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
        console.error('Failed to parse tile data from hash:', e)
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
        title: 'Select Data JSON',
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
    } catch (err) {
      console.error('Failed to select file:', err)
      setError({
        message: 'Failed to select or parse JSON file.',
        expected: EXPECTED_FORMAT,
      })
    }
  }

  const renderChart = () => {
    if (!data) return null

    const commonProps = {
      data: data.data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    }

    const gridColor =
      themeType === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    const textColor = 'var(--muted-foreground)'

    switch (chartType) {
      case ChartType.BAR:
        return (
          <BarChart {...commonProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke={textColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={textColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                borderColor: 'var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--popover-foreground)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            {data.keys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )
      case ChartType.LINE:
        return (
          <ReLineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              stroke={textColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={textColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                borderColor: 'var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            {data.keys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </ReLineChart>
        )
      case ChartType.AREA:
        return (
          <AreaChart {...commonProps}>
            <defs>
              {data.keys.map((key, i) => (
                <linearGradient
                  key={`grad-${key}`}
                  id={`grad-${i}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={COLORS[i % COLORS.length]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={COLORS[i % COLORS.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              stroke={textColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={textColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                borderColor: 'var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            {data.keys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                fillOpacity={1}
                fill={`url(#grad-${i})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        )
      case ChartType.PIE:
        return (
          <PieChart>
            <Pie
              data={data.data}
              dataKey={data.keys[0]}
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                borderColor: 'var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
          </PieChart>
        )
      case ChartType.RADAR:
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.data}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fill: textColor, fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                borderColor: 'var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {data.keys.map((key, i) => (
              <ReRadar
                key={key}
                name={key}
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: '10px' }} />
          </RadarChart>
        )
      default:
        return null
    }
  }

  const chartIcons = {
    [ChartType.BAR]: <BarChart3 size={14} />,
    [ChartType.LINE]: <LineChart size={14} />,
    [ChartType.AREA]: <AreaChartIcon size={14} />,
    [ChartType.PIE]: <PieChartIcon size={14} />,
    [ChartType.RADAR]: <Radar size={14} />,
  }

  return (
    <div className="w-full h-full flex flex-col bg-background transition-colors overflow-hidden">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-4 bg-muted/30 justify-between shrink-0 relative z-30">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTypeMenuOpen(!isTypeMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {chartIcons[chartType]} {chartType.toUpperCase()}{' '}
              <ChevronDown size={12} />
            </button>

            {isTypeMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 w-full h-full bg-transparent border-none cursor-default"
                  onClick={() => setIsTypeMenuOpen(false)}
                  aria-label="Close menu"
                />
                <div className="absolute top-full left-0 mt-1 w-40 bg-popover border border-border rounded-lg shadow-xl z-20 overflow-hidden py-1 backdrop-blur-md">
                  {Object.values(ChartType).map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => {
                        setChartType(type)
                        setIsTypeMenuOpen(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors ${
                        chartType === type
                          ? 'text-primary'
                          : 'text-popover-foreground'
                      }`}
                    >
                      {chartIcons[type]} {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="text-xs font-bold text-muted-foreground tracking-tight truncate max-w-[200px]">
            {data?.title || 'Data Chart'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSelectFile}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-1.5"
          title="Load JSON File"
        >
          <Upload size={14} />{' '}
          <span className="text-[10px] font-bold uppercase">Load JSON</span>
        </button>
      </div>

      <section
        aria-label="Data Chart"
        className="flex-1 relative overflow-hidden bg-background"
      >
        {/* Mock Watermark */}
        {isMock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
            <span className="text-[10vw] font-black tracking-tighter rotate-12 whitespace-nowrap">
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
                  Expected Format:
                </h4>
                <pre className="bg-muted p-4 rounded-lg text-[10px] font-mono overflow-x-auto border border-border whitespace-pre">
                  {error.expected}
                </pre>
              </div>
              <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Upload size={16} /> LOAD ANOTHER FILE
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-full p-4">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
