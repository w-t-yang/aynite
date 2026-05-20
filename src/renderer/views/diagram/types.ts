type DiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'gantt'
  | 'pie'
  | 'erDiagram'

interface DiagramData {
  title?: string
  type: DiagramType
  definition: string
}

export type { DiagramData }
