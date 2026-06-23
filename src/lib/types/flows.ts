export interface FlowStep {
  userInstruction: string
}

export interface FlowDefinition {
  id: string
  name: string
  description: string
  createdAt: string
  steps: FlowStep[]
}
