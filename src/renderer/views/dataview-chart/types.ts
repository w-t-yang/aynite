interface DataViewChartItem {
  name: string
  [key: string]: string | number
}

interface DataViewChart {
  title?: string
  data: DataViewChartItem[]
  keys: string[]
}

export type { DataViewChart }

export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  AREA = 'area',
  PIE = 'pie',
  RADAR = 'radar',
}
