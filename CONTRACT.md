# Shared contract (all tracks read this; do not change without updating STATUS.md)

Source of truth for types: HANDOFF.md section 3. Summary:

## Case state (one Terse actor per case, id like "4471")
status: 'open' | 'claimed' | 'consulting' | 'recommended' | 'drafted' | 'awaiting_poster' | 'approved' | 'escalated'
thread[]: { id, author, address?, sessionRef?, text, at, reactions: Record<emoji, handle[]> }
recommendation: { summary, steps: string[], sources: string[], agrees: string[] } | null
alarms[]: { id, at (ISO), kind: 'nudge' | 'escalate', fired: boolean }
decisionLog[]: { at, actor, event, reason? }
relay: { channel, threadRootId?, recommendationId?, webhookUrl?, webhookToken? }
facts: { payer, amount, denialCode, dateOfService, reason }
documents[]: { name, pages, source }
poster: { name }, worker: { name } | null, deadline (ISO), pay: { amount, released }, title, domain

## Case actor methods (HTTP via generated client, all return the full state)
create(input), claim(worker), ask(question), appendThreadMessage(msg), postRecommendation(rec),
approveRecommendation(), overrideRecommendation(reason), submitDeliverable(files, note), posterApprove(),
scheduleAlarm(at, kind), fireAlarm(id), fireDueAlarms(), escalate(reason), getState()

## Board actor (id "main")
jobs[]: { id, title, domain, poster, pay, deadline, estMinutes, status: 'open'|'claimed', worker? }
post(job), claim(jobId, worker), getState()

## WebSocket to browser
Browser does NOT use the Terse generated client. `bridge/` runs a Bun HTTP server on :8788:
  GET  /api/case/:id            -> Case state JSON
  GET  /api/board               -> Board state JSON
  POST /api/case/:id/:method    -> body = JSON array of args, calls actor method, returns state
  POST /api/board/:method       -> same
  GET  /api/case/:id/ws-url     -> { websocketUrl } from actors.Case.prepareWebsocket
  GET  /api/board/ws-url        -> { websocketUrl }
Browser opens websocketUrl directly. Terse sends { type: 'state', state } on connect and
{ type: 'state_update', changes } after each change. Web merges changes into state.
Until the bridge is up, web uses fixtures in web/src/fixtures.ts that match the shapes above.

## Relay conventions
channel per case: `case-<id>` (SDK takes '#case-4471'). Agents: policy, billing, appeals. System: case-actor. Humans: maya (worker), dana (supervisor).
Actions: post_recommendation, schedule_alarm, request_document (Zod, availableTo the three agents).
Reactions = votes (':+1:'). Worker approval = ':white_check_mark:' + approveRecommendation().
