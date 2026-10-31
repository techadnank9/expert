import { Actor, Emittable, Persisted, type ActorSocket } from "terse-sdk/actor"

// ---------- Shared types (mirror CONTRACT.md) ----------

export type CaseStatus =
    | "open"
    | "claimed"
    | "consulting"
    | "recommended"
    | "drafted"
    | "awaiting_poster"
    | "approved"
    | "escalated"

export type Facts = { payer: string; amount: number; denialCode: string; dateOfService: string; reason: string }
export type Doc = { name: string; pages: number; source: string }
export type Alarm = { id: string; at: string; kind: "nudge" | "escalate"; fired: boolean }
export type RelayInfo = {
    channel: string
    threadRootId?: string
    recommendationId?: string
    webhookUrl?: string
    webhookToken?: string
}
export type ThreadMessage = {
    id: string
    author: string
    address?: string
    sessionRef?: string
    parentId?: string
    text: string
    at: string
    reactions: Record<string, string[]>
}
export type Recommendation = { summary: string; steps: string[]; sources: string[]; agrees: string[] }
export type LogEntry = { at: string; actor: string; event: string; reason?: string }
export type Pay = { amount: number; released: boolean }
export type Deliverable = { files: string[]; note: string; at: string } | null

export type CaseInput = {
    id: string
    title: string
    domain?: string
    poster: { name: string }
    facts: Facts
    documents?: Doc[]
    deadline: string
    pay: { amount: number }
    estMinutes?: number
    relay?: Partial<RelayInfo>
}

export type CaseState = {
    id: string
    title: string
    domain: string
    poster: { name: string }
    worker: { name: string } | null
    status: CaseStatus
    facts: Facts
    documents: Doc[]
    deadline: string
    alarms: Alarm[]
    relay: RelayInfo
    thread: ThreadMessage[]
    recommendation: Recommendation | null
    decisionLog: LogEntry[]
    pay: Pay
    deliverable: Deliverable
    pendingQuestion: string | null
}

type Meta = { userId: string }
type Incoming = { type: "ping" }
type Outgoing =
    | { type: "alarm_fired"; alarm: Alarm; caseId: string }
    | { type: "asked"; caseId: string; question: string }
    | { type: "event"; caseId: string; event: string; reason?: string }
type Socket = ActorSocket<Meta, Outgoing>

const now = () => new Date().toISOString()
const rid = () => Math.random().toString(36).slice(2, 10)

// ---------- Case actor: system of record for case state ----------

export class Case extends Actor<Meta, Incoming, Outgoing> {
    @Persisted @Emittable title = ""
    @Persisted @Emittable domain = "medical-billing"
    @Persisted @Emittable poster: { name: string } = { name: "" }
    @Persisted @Emittable worker: { name: string } | null = null
    @Persisted @Emittable status: CaseStatus = "open"
    @Persisted @Emittable facts: Facts = { payer: "", amount: 0, denialCode: "", dateOfService: "", reason: "" }
    @Persisted @Emittable documents: Doc[] = []
    @Persisted @Emittable deadline = ""
    @Persisted @Emittable alarms: Alarm[] = []
    @Persisted @Emittable relay: RelayInfo = { channel: "" }
    @Persisted @Emittable thread: ThreadMessage[] = []
    @Persisted @Emittable recommendation: Recommendation | null = null
    @Persisted @Emittable decisionLog: LogEntry[] = []
    @Persisted @Emittable pay: Pay = { amount: 0, released: false }
    @Persisted @Emittable deliverable: Deliverable = null
    @Persisted @Emittable pendingQuestion: string | null = null
    @Persisted @Emittable estMinutes = 45

    // ----- read -----

    async getState(): Promise<CaseState> {
        return {
            id: this.id,
            title: this.title,
            domain: this.domain,
            poster: this.poster,
            worker: this.worker,
            status: this.status,
            facts: this.facts,
            documents: this.documents,
            deadline: this.deadline,
            alarms: this.alarms,
            relay: this.relay,
            thread: this.thread,
            recommendation: this.recommendation,
            decisionLog: this.decisionLog,
            pay: this.pay,
            deliverable: this.deliverable,
            pendingQuestion: this.pendingQuestion,
        }
    }

    async exists(): Promise<boolean> {
        return this.title !== ""
    }

    // ----- lifecycle -----

    async create(input: CaseInput): Promise<CaseState> {
        if (this.title !== "") return this.getState()
        this.title = input.title
        this.domain = input.domain ?? "medical-billing"
        this.poster = input.poster
        this.facts = input.facts
        this.documents = input.documents ?? []
        this.deadline = input.deadline
        this.pay = { amount: input.pay.amount, released: false }
        this.estMinutes = input.estMinutes ?? 45
        this.relay = { channel: `case-${this.id}`, ...(input.relay ?? {}) }
        this.status = "open"
        await this.log("poster", "case_opened")
        return this.getState()
    }

    async claim(worker: { name: string }): Promise<CaseState> {
        if (this.worker) throw new Error(`Case ${this.id} already claimed by ${this.worker.name}`)
        this.worker = worker
        this.status = "claimed"
        await this.log(worker.name, "claimed")
        return this.getState()
    }

    async setRelayInfo(info: Partial<RelayInfo>): Promise<CaseState> {
        this.relay = { ...this.relay, ...info }
        return this.getState()
    }

    // ----- consultation -----

    async ask(question: string): Promise<CaseState> {
        this.pendingQuestion = question
        this.status = "consulting"
        await this.log(this.worker?.name ?? "worker", "asked_bench", question)
        // The bridge listens for this and posts the question into #case-<id> as the worker.
        this.broadcast({ type: "asked", caseId: this.id, question })
        return this.getState()
    }

    async appendThreadMessage(msg: ThreadMessage): Promise<CaseState> {
        if (this.thread.some(m => m.id === msg.id)) return this.getState()
        this.thread = [...this.thread, { ...msg, reactions: msg.reactions ?? {} }]
        if (!this.relay.threadRootId && !msg.parentId && msg.author === (this.worker?.name ?? "maya")) {
            this.relay = { ...this.relay, threadRootId: msg.id }
        }
        if (this.pendingQuestion && msg.text === this.pendingQuestion && !msg.parentId) {
            this.relay = { ...this.relay, threadRootId: msg.id }
            this.pendingQuestion = null
        }
        return this.getState()
    }

    async addReaction(messageId: string, emoji: string, handle: string): Promise<CaseState> {
        this.thread = this.thread.map(m => {
            if (m.id !== messageId) return m
            const prev = m.reactions[emoji] ?? []
            if (prev.includes(handle)) return m
            return { ...m, reactions: { ...m.reactions, [emoji]: [...prev, handle] } }
        })
        if (messageId === this.relay.recommendationId && this.recommendation && (emoji === ":+1:" || emoji === "+1" || emoji === "👍")) {
            if (!this.recommendation.agrees.includes(handle)) {
                this.recommendation = { ...this.recommendation, agrees: [...this.recommendation.agrees, handle] }
            }
        }
        return this.getState()
    }

    async postRecommendation(rec: Omit<Recommendation, "agrees"> & { agrees?: string[]; messageId?: string; by?: string }): Promise<CaseState> {
        this.recommendation = { summary: rec.summary, steps: rec.steps, sources: rec.sources, agrees: rec.agrees ?? [] }
        if (rec.messageId) this.relay = { ...this.relay, recommendationId: rec.messageId }
        this.status = "recommended"
        await this.log(rec.by ?? "appeals", "recommendation_posted")
        return this.getState()
    }

    async approveRecommendation(): Promise<CaseState> {
        if (!this.recommendation) throw new Error("No recommendation to approve")
        this.status = "drafted"
        await this.log(this.worker?.name ?? "worker", "recommendation_approved")
        this.broadcast({ type: "event", caseId: this.id, event: "recommendation_approved" })
        return this.getState()
    }

    async overrideRecommendation(reason: string): Promise<CaseState> {
        this.status = "consulting"
        await this.log(this.worker?.name ?? "worker", "recommendation_overridden", reason)
        this.broadcast({ type: "event", caseId: this.id, event: "recommendation_overridden", reason })
        return this.getState()
    }

    // ----- deliverable -----

    async submitDeliverable(files: string[], note: string): Promise<CaseState> {
        this.deliverable = { files, note, at: now() }
        this.status = "awaiting_poster"
        await this.log(this.worker?.name ?? "worker", "deliverable_submitted", note)
        this.broadcast({ type: "event", caseId: this.id, event: "deliverable_submitted" })
        return this.getState()
    }

    async posterApprove(): Promise<CaseState> {
        this.status = "approved"
        this.pay = { ...this.pay, released: true }
        await this.log(this.poster.name, "poster_approved")
        this.broadcast({ type: "event", caseId: this.id, event: "poster_approved" })
        return this.getState()
    }

    async requestDocument(name: string, reason: string, by = "agent"): Promise<CaseState> {
        await this.log(by, "document_requested", `${name}: ${reason}`)
        return this.getState()
    }

    /** Dev only: clear the consultation so the demo can run again. Keeps identity, facts, docs, alarms, relay channel. */
    async devReset(): Promise<CaseState> {
        this.thread = []
        this.recommendation = null
        this.pendingQuestion = null
        this.deliverable = null
        this.relay = { channel: this.relay.channel, webhookUrl: this.relay.webhookUrl, webhookToken: this.relay.webhookToken }
        this.alarms = this.alarms.map(a => ({ ...a, fired: false }))
        this.status = this.worker ? "claimed" : "open"
        this.decisionLog = this.decisionLog.filter(e => e.event === "case_opened" || e.event === "claimed" || e.event === "alarm_scheduled")
        await this.log("system", "dev_reset")
        await this.rearm()
        return this.getState()
    }

    // ----- alarms: one hardware alarm, many logical alarms -----

    async scheduleAlarm(at: string, kind: "nudge" | "escalate" = "nudge"): Promise<CaseState> {
        const alarm: Alarm = { id: rid(), at, kind, fired: false }
        this.alarms = [...this.alarms, alarm].sort((a, b) => a.at.localeCompare(b.at))
        await this.log("system", "alarm_scheduled", `${kind} at ${at}`)
        await this.rearm()
        return this.getState()
    }

    async fireAlarm(id: string): Promise<CaseState> {
        const alarm = this.alarms.find(a => a.id === id)
        if (!alarm || alarm.fired) return this.getState()
        this.alarms = this.alarms.map(a => (a.id === id ? { ...a, fired: true } : a))
        if (alarm.kind === "escalate") {
            this.status = "escalated"
            await this.log("system", "escalated", `alarm ${alarm.kind} fired at ${now()}`)
        } else {
            await this.log("system", "nudged", `alarm ${alarm.kind} fired at ${now()}`)
        }
        // The bridge mirrors this into #case-<id> through the inbound webhook as author case-actor.
        this.broadcast({ type: "alarm_fired", alarm: { ...alarm, fired: true }, caseId: this.id })
        await this.rearm()
        return this.getState()
    }

    async fireDueAlarms(): Promise<CaseState> {
        const due = this.alarms.filter(a => !a.fired && Date.parse(a.at) <= Date.now())
        for (const a of due) await this.fireAlarm(a.id)
        return this.getState()
    }

    async onAlarm(): Promise<void> {
        await this.fireDueAlarms()
    }

    async escalate(reason: string): Promise<CaseState> {
        this.status = "escalated"
        await this.log("system", "escalated", reason)
        this.broadcast({ type: "event", caseId: this.id, event: "escalated", reason })
        return this.getState()
    }

    private async rearm(): Promise<void> {
        const next = this.alarms.find(a => !a.fired)
        if (next) this.alarm.set(Date.parse(next.at))
        else this.alarm.delete()
    }

    private async log(actor: string, event: string, reason?: string): Promise<void> {
        const entry: LogEntry = { at: now(), actor, event }
        if (reason) entry.reason = reason
        this.decisionLog = [...this.decisionLog, entry]
    }

    // ----- sockets -----

    async onConnect(socket: Socket): Promise<void> {
        this.setWebSocketAutoResponse({ request: "ping", response: "pong" })
    }

    async onMessage(socket: Socket, _message: Incoming): Promise<void> {
        // State is delivered through @Emittable; nothing else needed.
    }
}

// ---------- Board actor: global list of open jobs, claim is atomic ----------

export type Job = {
    id: string
    title: string
    domain: string
    poster: string
    pay: number
    deadline: string
    estMinutes: number
    status: "open" | "claimed"
    worker?: string
    facts?: Facts
    documents?: Doc[]
}

export class Board extends Actor<Meta, Incoming, { type: "posted"; job: Job } | { type: "claimed"; job: Job }> {
    @Persisted @Emittable jobs: Job[] = []

    async getState(): Promise<{ jobs: Job[] }> {
        return { jobs: this.jobs }
    }

    async post(job: Omit<Job, "status" | "worker"> & { id?: string }): Promise<Job> {
        const id = job.id ?? String(4000 + Math.floor(Math.random() * 999))
        if (this.jobs.some(j => j.id === id)) return this.jobs.find(j => j.id === id)!
        const full: Job = { ...job, id, status: "open" }
        this.jobs = [...this.jobs, full]
        // The bridge sees this broadcast and creates the Case actor + Relay channel.
        this.broadcast({ type: "posted", job: full })
        return full
    }

    async claim(jobId: string, worker: { name: string }): Promise<Job> {
        const job = this.jobs.find(j => j.id === jobId)
        if (!job) throw new Error(`No job ${jobId}`)
        if (job.status === "claimed") throw new Error(`Job ${jobId} already claimed by ${job.worker}`)
        const claimed: Job = { ...job, status: "claimed", worker: worker.name }
        this.jobs = this.jobs.map(j => (j.id === jobId ? claimed : j))
        this.broadcast({ type: "claimed", job: claimed })
        return claimed
    }

    async remove(jobId: string): Promise<void> {
        this.jobs = this.jobs.filter(j => j.id !== jobId)
    }

    async onMessage(): Promise<void> {}
}
