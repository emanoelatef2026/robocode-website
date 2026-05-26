// AI module types — Phase 7+ placeholder
// Do not implement until Phase 9

export interface AiAgentType {
  name: string
  trigger: 'manual' | 'scheduled' | 'event'
  description: string
}

export interface AiInteractionLog {
  agentType: string
  inputTokens: number
  outputTokens: number
  model: string
  latencyMs: number
  costUsd: number
}
