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
  workspace: Workspace | null
}

export type WorkspaceStatus = 'provisioning' | 'ready' | 'paused' | 'error'

export interface WorkspaceAgent {
  role: string
  running: boolean
  sessionRef?: string
}

/** Business workspace VM (a Superserve sandbox). Bench agents run inside it. */
export interface Workspace {
  provider: 'superserve'
  slug: string
  vmId: string
  status: WorkspaceStatus
  agents: WorkspaceAgent[]
  owner: string
  grantedTo: string[]
  createdAt: string
}

/** GET /api/workspace/:slug */
export interface WorkspaceDetail {
  slug: string
  vmId: string
  status: WorkspaceStatus
  owner: string
  agents: WorkspaceAgent[]
  files: { path: string; size?: number }[]
  sessions: { id: string; role?: string; updatedAt?: string }[]
  shell: string
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
  workspace?: string
}

export interface Board {
  jobs: Job[]
}
