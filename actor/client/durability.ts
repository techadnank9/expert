import { actors } from "./generated/index.js"
const id = process.argv[2]
const s = await actors.Case.get(id).getState()
console.log("status:", s.status, "| thread:", s.thread.length, "| agrees:", s.recommendation?.agrees.length, "| alarms:", s.alarms.map(a => a.kind + ":" + a.fired).join(","), "| log:", s.decisionLog.length)
process.exit(0)
