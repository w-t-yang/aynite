export interface SpellItem {
  name: string
  description: string
  path: string
  error: string | null
  parameters?: any[]
  example?: string
}
