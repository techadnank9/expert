// Seeds a believable history: older cases (approved, overridden, paid) and a few more open jobs on the board.
// Usage: bun seed/seed-history.ts  (uses TERSE_ACTOR_URL/TERSE_API_KEY from env when set)
import { actors } from "../actor/client/generated/index.js"

const day = 86400e3
const ago = (d: number) => new Date(Date.now() - d * day).toISOString()
const board = actors.Board.get("main")

const history = [
  { id: "4466", title: "Coordination of benefits dispute, two payers", poster: "Northgate Family Practice", payer: "Bluepine Mutual", amount: 2310, code: "CO-22", dos: "2026-10-06", reason: "Bluepine says secondary, Harborline says secondary too", pay: 80, worker: "Maya R.", daysAgo: 9, end: "approved", verdict: "Verified: COB letter correctly cites the birthday rule and the Harborline EOB; ready to send." },
  { id: "4452", title: "Timely filing denial, CPT 99213", poster: "Harbor Family Medicine", payer: "Bluepine Mutual", amount: 410, code: "CO-29", dos: "2026-06-11", reason: "Claim filed after timely filing limit", pay: 40, worker: "Jon T.", daysAgo: 12, end: "overridden", verdict: "Not verified: clearinghouse acceptance report is missing; attach it before filing." },
  { id: "4439", title: "Duplicate claim denial, resubmit with modifier", poster: "Cedar Street Clinic", payer: "Harborline Health", amount: 95, code: "CO-18", dos: "2026-09-28", reason: "Exact duplicate claim/service", pay: 30, worker: "Ana L.", daysAgo: 14, end: "approved", verdict: "Verified: modifier 76 applies, corrected claim is complete." },
  { id: "4421", title: "Prior auth missing, retro authorization request", poster: "Bayview Orthopedics", payer: "Cedarpoint Plan", amount: 3900, code: "CO-197", dos: "2026-09-19", reason: "Precertification absent", pay: 70, worker: "Ana L.", daysAgo: 18, end: "approved", verdict: "Verified: retro-auth request cites the emergency exception in the plan policy." },
  { id: "4407", title: "Bundled E/M denial, modifier 25 appeal", poster: "Dr. Lena Okafor, Dermatology", payer: "BCBS CA", amount: 230, code: "CO-97", dos: "2026-09-02", reason: "Bundled into procedure", pay: 35, worker: "Maya R.", daysAgo: 23, end: "approved", verdict: "Verified: separate E/M documented, modifier 25 justified." },
  { id: "4388", title: "Out-of-network emergency claim, balance billing dispute", poster: "Homeowner (patient advocate)", payer: "Harborline Health", amount: 5800, code: "CO-242", dos: "2026-08-15", reason: "Services not provided by network provider", pay: 90, worker: "Jon T.", daysAgo: 30, end: "approved", verdict: "Verified: No Surprises Act applies; letter cites the correct sections." },
]

for (const h of history) {
  const c = actors.Case.get(h.id)
  if (await c.exists()) { console.log(`case ${h.id} exists, skipping`); continue }
  await c.create({ id: h.id, title: h.title, poster: { name: h.poster }, facts: { payer: h.payer, amount: h.amount, denialCode: h.code, dateOfService: h.dos, reason: h.reason }, documents: [{ name: "Denial letter.pdf", pages: 2, source: "poster" }, { name: "Clinical notes.pdf", pages: 4, source: "poster" }], deadline: ago(h.daysAgo - 20), pay: { amount: h.pay }, estMinutes: 40 })
  await c.claim({ name: h.worker })
  await c.submitDeliverable([], `Appeal letter draft for ${h.title}. Cites ${h.code} and the payer policy; requests reprocessing of $${h.amount}.`)
  await c.appendThreadMessage({ id: `${h.id}-p`, author: "policy", sessionRef: `hist-${h.id}-policy`, text: "Checked the policy sections cited in the draft against the plan document. VERIFIED", at: ago(h.daysAgo), reactions: {} })
  await c.appendThreadMessage({ id: `${h.id}-b`, author: "billing", sessionRef: `hist-${h.id}-billing`, text: "Codes, dates and amounts match the EOB and the claim form. VERIFIED", at: ago(h.daysAgo), reactions: {} })
  await c.appendThreadMessage({ id: `${h.id}-a`, author: "appeals", sessionRef: `hist-${h.id}-appeals`, text: `**Recommendation**\n${h.verdict}`, at: ago(h.daysAgo), reactions: {} })
  await c.postRecommendation({ summary: h.verdict, steps: h.end === "overridden" ? ["Attach the clearinghouse acceptance report", "Resubmit for verification"] : ["Send to the payer", "Record the confirmation number"], sources: ["Denial letter.pdf p.1", "Clinical notes.pdf p.2"], messageId: `${h.id}-a`, by: "appeals" })
  for (const who of ["policy", "billing", "appeals"]) await c.addReaction(`${h.id}-a`, ":+1:", who)
  if (h.end === "overridden") await c.overrideRecommendation("Worker attached the acceptance report and resubmitted")
  else { await c.approveRecommendation(); await c.posterApprove() }
  try { await board.post({ id: h.id, title: h.title, domain: "medical-billing", poster: h.poster, pay: h.pay, deadline: ago(h.daysAgo - 20), estMinutes: 40 }); await board.claim(h.id, { name: h.worker }) } catch {}
  console.log(`seeded history case ${h.id}: ${h.end}`)
}
const more = [
  { id: "4502", title: "Appeal prior-auth denial, knee arthroscopy CPT 29881", poster: "Bayview Orthopedics", pay: 70, estMinutes: 50 },
  { id: "4515", title: "Correct and resubmit bundled E/M with modifier 25", poster: "Dr. Lena Okafor, Dermatology", pay: 35, estMinutes: 25 },
  { id: "4521", title: "Respond to IRS CP2000 notice, 1099 mismatch", poster: "Taxing", pay: 60, estMinutes: 45 },
]
for (const j of more) { try { await board.post({ ...j, domain: j.id === "4521" ? "tax" : "medical-billing", deadline: new Date(Date.now() + 4 * day).toISOString() }) } catch {} }
const b = await board.getState(); console.log(`board: ${b.jobs.length} jobs`, b.jobs.map(j => `${j.id}:${j.status}`).join(" "))
process.exit(0)
