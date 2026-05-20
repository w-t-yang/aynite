interface ChartDataItem {
  name: string
  [key: string]: string | number
}

interface ChartData {
  title?: string
  data: ChartDataItem[]
  keys: string[]
}

export type { ChartData }

export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  AREA = 'area',
  PIE = 'pie',
  RADAR = 'radar',
}
