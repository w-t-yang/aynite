interface ThemeData {
  id: string
  name: string
  type: 'light' | 'dark'
  colors: Record<string, string>
}

export type { ThemeData }
