// Seeds the two demo cases into the Case actors and the Board.
// Usage: bun seed/seed-cases.ts [--alarm-seconds 60]   (needs `terse actor dev` running, or TERSE_ACTOR_URL + TERSE_API_KEY)
import { actors } from "../actor/client/generated/index.js"

const argIdx = process.argv.indexOf("--alarm-seconds")
const alarmSeconds = argIdx > -1 ? Number(process.argv[argIdx + 1]) : 60
const iso = (ms: number) => new Date(Date.now() + ms).toISOString()

const cases = [
    {
        id: "4471",
        title: "Appeal denied lumbar MRI, CPT 72148",
        poster: { name: "Cedar Street Clinic" },
        facts: { payer: "Harborline Health", amount: 1840, denialCode: "CO-50", dateOfService: "2026-10-02", reason: "Medical necessity not established for advanced imaging" },
        documents: [
            { name: "Denial letter.pdf", pages: 2, source: "poster" },
            { name: "Clinical notes, PT visits.pdf", pages: 6, source: "poster" },
            { name: "EOB.pdf", pages: 1, source: "poster" },
            { name: "Plan policy CG-0423.pdf", pages: 14, source: "pulled by Policy agent" },
        ],
        deadline: "2026-11-14T17:00:00-07:00",
        pay: { amount: 45 },
        estMinutes: 40,
        worker: { name: "Maya R." },
        alarms: [
            { at: "2026-11-10T09:00:00-08:00", kind: "nudge" as const },
            { at: "2026-11-12T09:00:00-08:00", kind: "escalate" as const },
        ],
    },
    {
        id: "4398",
        title: "Appeal denied PT units",
        poster: { name: "Harbor Family Medicine" },
        facts: { payer: "Harborline Health", amount: 620, denialCode: "CO-151", dateOfService: "2026-09-18", reason: "Units exceed plan frequency for 97110" },
        documents: [
            { name: "Denial letter.pdf", pages: 1, source: "poster" },
            { name: "Appeal filed Oct 20.pdf", pages: 3, source: "worker" },
        ],
        deadline: "2026-11-05T17:00:00-08:00",
        pay: { amount: 40 },
        estMinutes: 30,
        worker: { name: "Jon T." },
        alarms: [{ in: alarmSeconds * 1000, kind: "escalate" as const }],
    },
]

const board = actors.Board.get("main")
for (const c of cases) {
    const actor = actors.Case.get(c.id)
    if (await actor.exists()) {
        console.log(`case ${c.id} already exists, skipping create`)
    } else {
        await actor.create({ id: c.id, title: c.title, poster: c.poster, facts: c.facts, documents: c.documents, deadline: c.deadline, pay: c.pay, estMinutes: c.estMinutes })
        await actor.claim(c.worker)
        for (const a of c.alarms as any[]) await actor.scheduleAlarm(a.at ?? iso(a.in), a.kind)
        console.log(`seeded case ${c.id} (${c.title}) with ${c.alarms.length} alarm(s), `)
    }
    try {
        await board.post({ id: c.id, title: c.title, domain: "medical-billing", poster: c.poster.name, pay: c.pay.amount, deadline: c.deadline, estMinutes: c.estMinutes, facts: c.facts, documents: c.documents })
        await board.claim(c.id, c.worker).catch(() => {})
    } catch (e) { console.log("board:", (e as Error).message) }
}

// Open jobs on the board for the Find screen
const openJobs = [
    { id: "4466", title: "Coordination of benefits dispute, two payers", poster: "Northgate Family Practice", pay: 80, estMinutes: 75, facts: { payer: "Bluepine Mutual", amount: 2310, denialCode: "CO-22", dateOfService: "2026-10-06", reason: "Bluepine says secondary, Harborline says secondary too" } },
    { id: "4480", title: "Water damage claim, contractor estimate disputed", poster: "Homeowner", pay: 65, estMinutes: 60, facts: { payer: "Adjuster", amount: 9800, denialCode: "offer $6,200", dateOfService: "2026-10-12", reason: "Adjuster offered $6,200 against a $9,800 estimate" } },
]
for (const j of openJobs) {
    try { await board.post({ ...j, domain: "medical-billing", deadline: iso(3 * 86400e3) }) } catch {}
}
const b = await board.getState()
console.log(`board has ${b.jobs.length} jobs:`, b.jobs.map(j => `${j.id}:${j.status}`).join(" "))
process.exit(0)
