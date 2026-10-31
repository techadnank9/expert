import { actors } from "./generated/index.js"

const id = "smoke-" + Date.now().toString(36)
const c = actors.Case.get(id)
let s = await c.create({
    id, title: "Appeal denied lumbar MRI, CPT 72148", poster: { name: "Patel Spine Clinic" },
    facts: { payer: "Aetna", amount: 1840, denialCode: "CO-50", dateOfService: "2026-09-12", reason: "Not medically necessary" },
    documents: [{ name: "Denial letter.pdf", pages: 2, source: "poster" }], deadline: new Date(Date.now() + 86400e3).toISOString(), pay: { amount: 60 },
})
console.log("create ->", s.status, s.relay.channel, s.decisionLog.length)
s = await c.claim({ name: "Maya Chen" }); console.log("claim ->", s.status, s.worker?.name)
try { await c.claim({ name: "Other" }); console.log("BUG: double claim allowed") } catch (e) { console.log("double claim rejected:", (e as Error).message.slice(0, 60)) }
s = await c.ask("Can we appeal CO-50 on medical necessity with the MRI order and PT notes?"); console.log("ask ->", s.status, s.pendingQuestion?.slice(0, 20))
s = await c.appendThreadMessage({ id: "m1", author: "maya", text: "Can we appeal CO-50 on medical necessity with the MRI order and PT notes?", at: new Date().toISOString(), reactions: {} })
s = await c.appendThreadMessage({ id: "m2", author: "policy", sessionRef: "sess-abc", parentId: "m1", text: "Yes. Aetna CPB 0236 section II.B requires 6 weeks conservative therapy; PT notes p.3 show 8 weeks.", at: new Date().toISOString(), reactions: {} })
console.log("thread ->", s.thread.length, "root:", s.relay.threadRootId, "pending:", s.pendingQuestion)
s = await c.postRecommendation({ summary: "File level-1 appeal citing CPB 0236 II.B", steps: ["Attach PT notes p.3", "Cite CPB 0236 II.B"], sources: ["Denial letter.pdf p.1", "CPB 0236 II.B"], messageId: "m2", by: "appeals" })
s = await c.addReaction("m2", ":+1:", "policy"); s = await c.addReaction("m2", ":+1:", "billing"); s = await c.addReaction("m2", ":+1:", "appeals")
console.log("rec ->", s.status, "agrees:", s.recommendation?.agrees)
s = await c.scheduleAlarm(new Date(Date.now() + 3000).toISOString(), "escalate")
s = await c.scheduleAlarm(new Date(Date.now() + 3600e3).toISOString(), "nudge")
console.log("alarms ->", s.alarms.map(a => a.kind + ":" + a.fired))
const grant = await actors.Case.prepareWebsocket({ actorId: id, metadata: { userId: "smoke" } })
console.log("ws url ->", grant.websocketUrl.slice(0, 50) + "...")
const ws = new WebSocket(grant.websocketUrl)
ws.onmessage = ev => { const m = JSON.parse(String(ev.data)); console.log("WS", m.type, m.type === "alarm_fired" ? m.alarm.kind : m.type === "state_update" ? Object.keys(m.changes) : "") }
await new Promise(r => setTimeout(r, 6000))
s = await c.getState()
console.log("after 6s -> status:", s.status, "alarms:", s.alarms.map(a => a.kind + ":" + a.fired))
ws.close()
process.exit(0)
