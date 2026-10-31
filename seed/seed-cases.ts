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
        poster: { name: "Patel Spine & Sports Clinic" },
        facts: { payer: "Aetna", amount: 1840, denialCode: "CO-50", dateOfService: "2026-09-12", reason: "Not deemed medically necessary; conservative therapy not documented" },
        documents: [
            { name: "Denial letter (Aetna EOB).pdf", pages: 2, source: "poster" },
            { name: "MRI order + clinical notes.pdf", pages: 6, source: "poster" },
            { name: "PT progress notes (8 weeks).pdf", pages: 11, source: "poster" },
            { name: "Aetna CPB 0236 Lumbar imaging.pdf", pages: 14, source: "bench" },
        ],
        deadline: iso(5 * 86400e3),
        pay: { amount: 60 },
        estMinutes: 45,
        worker: { name: "Maya Chen" },
        alarms: [
            { in: 2 * 3600e3, kind: "nudge" as const },
            { in: 4 * 86400e3, kind: "escalate" as const },
        ],
    },
    {
        id: "4398",
        title: "Appeal timely-filing denial, CPT 99214 x3",
        poster: { name: "Harbor Family Medicine" },
        facts: { payer: "UnitedHealthcare", amount: 612, denialCode: "CO-29", dateOfService: "2026-06-03", reason: "Claim filed after timely filing limit" },
        documents: [
            { name: "Denial letter (UHC).pdf", pages: 1, source: "poster" },
            { name: "Clearinghouse submission log.pdf", pages: 3, source: "poster" },
        ],
        deadline: iso(1 * 3600e3),
        pay: { amount: 45 },
        estMinutes: 30,
        worker: { name: "Jordan Alvarez" },
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
        for (const a of c.alarms) await actor.scheduleAlarm(iso(a.in), a.kind)
        console.log(`seeded case ${c.id} (${c.title}) with ${c.alarms.length} alarm(s), first in ${Math.round(c.alarms[0].in / 1000)}s`)
    }
    try {
        await board.post({ id: c.id, title: c.title, domain: "medical-billing", poster: c.poster.name, pay: c.pay.amount, deadline: c.deadline, estMinutes: c.estMinutes, facts: c.facts, documents: c.documents })
        await board.claim(c.id, c.worker).catch(() => {})
    } catch (e) { console.log("board:", (e as Error).message) }
}

// Open jobs on the board for the Find screen
const openJobs = [
    { id: "4502", title: "Appeal prior-auth denial, knee arthroscopy CPT 29881", poster: "Bayview Orthopedics", pay: 70, estMinutes: 50, facts: { payer: "Cigna", amount: 4200, denialCode: "CO-197", dateOfService: "2026-10-02", reason: "Precertification absent" } },
    { id: "4515", title: "Correct and resubmit bundled E/M with modifier 25", poster: "Dr. Lena Okafor, Dermatology", pay: 35, estMinutes: 25, facts: { payer: "BCBS CA", amount: 230, denialCode: "CO-97", dateOfService: "2026-10-14", reason: "Bundled into procedure" } },
]
for (const j of openJobs) {
    try { await board.post({ ...j, domain: "medical-billing", deadline: iso(3 * 86400e3) }) } catch {}
}
const b = await board.getState()
console.log(`board has ${b.jobs.length} jobs:`, b.jobs.map(j => `${j.id}:${j.status}`).join(" "))
process.exit(0)
