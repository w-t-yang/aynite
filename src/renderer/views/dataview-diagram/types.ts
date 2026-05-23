type DataViewDiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'gantt'
  | 'pie'
  | 'erDiagram'

interface DataViewDiagram {
  title?: string
  type: DataViewDiagramType
  definition: string
}

export type { DataViewDiagram }
