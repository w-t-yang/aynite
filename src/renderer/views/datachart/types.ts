export interface ChartDataItem {
  name: string
  [key: string]: string | number
}

export interface ChartData {
  title?: string
  data: ChartDataItem[]
  keys: string[]
}

export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  AREA = 'area',
  PIE = 'pie',
  RADAR = 'radar',
}
