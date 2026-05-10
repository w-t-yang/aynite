export type DiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'gantt'
  | 'pie'
  | 'erDiagram'

export interface DiagramData {
  title?: string
  type: DiagramType
  definition: string
}
