// Shapes from CONTRACT.md / HANDOFF.md section 3. Keep in sync with actor/.

export type CaseStatus =
  | 'open'
  | 'claimed'
  | 'consulting'
  | 'recommended'
  | 'drafted'
  | 'awaiting_poster'
  | 'approved'
  | 'escalated'

export interface ThreadMessage {
  id: string
  author: string
  address?: string
  sessionRef?: string
  text: string
  at: string
  reactions: Record<string, string[]>
}

export interface Recommendation {
  summary: string
  steps: string[]
  sources: string[]
  agrees: string[]
}

export type AlarmKind = 'nudge' | 'escalate'

export interface Alarm {
  id: string
  at: string
  kind: AlarmKind
  fired: boolean
}

export interface DecisionLogEntry {
  at: string
  actor: string
  event: string
  reason?: string
}

export interface RelayInfo {
  channel: string
  threadRootId?: string
  recommendationId?: string
  webhookUrl?: string
  webhookToken?: string
}

export interface CaseFacts {
  payer: string
  amount: number | string
  denialCode: string
  dateOfService: string
  reason: string
}

export interface CaseDocument {
  name: string
  pages: number | string
  source: string
}

export interface Case {
  id: string
  title: string
  domain: string
  status: CaseStatus
  poster: { name: string }
  worker: { name: string } | null
  facts: CaseFacts
  documents: CaseDocument[]
  deadline: string
  alarms: Alarm[]
  relay: RelayInfo
  thread: ThreadMessage[]
  recommendation: Recommendation | null
  decisionLog: DecisionLogEntry[]
  pay: { amount: number; released: boolean }
}

export interface Job {
  id: string
  title: string
  domain: string
  poster: string | { name: string }
  pay: number
  deadline: string
  estMinutes: number
  status: 'open' | 'claimed'
  worker?: string | { name: string }
  // Display-only extras (not in CONTRACT.md); optional so bridge data still type-checks.
  summary?: string
  bench?: string[]
  similar?: number
}

export interface Board {
  jobs: Job[]
}
