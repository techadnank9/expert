import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Case } from '../types'
import { callCase } from '../api'
import { fmtWhen, useNow } from '../format'

const DEFAULT_BODY =
  'No payer response 10 days after the appeal was filed. The actor woke itself, re-checked the portal through the Billing agent, found nothing, and escalated.'

/** Amber card on the Supervisor view for a case whose alarm fired or that escalated. */
export function AlarmCard({ id, c }: { id: string; c: Case }) {
  const now = useNow(5000)
  const [busy, setBusy] = useState(false)
  const firedAlarm = [...c.alarms].filter((a) => a.fired).sort((a, b) => b.at.localeCompare(a.at))[0]
  const when = firedAlarm?.at ?? [...c.decisionLog].reverse().find((e) => /escalat/i.test(e.event))?.at
  const lastActorMsg = [...c.thread].reverse().find((m) => m.author === 'case-actor' && /alarm|escalat/i.test(m.text))
  const suggestion = [...c.thread].reverse().find((m) => /call the payer/i.test(m.text))
  const taken = c.worker?.name === 'Dana K.'

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="alarm-card">
      <div className="alarm-row">
        <div className="h2">Alarm fired: case {id}</div>
        {when && <span className="pill tight pill-amber">{fmtWhen(when, now)}</span>}
      </div>
      <div>{c.id === '4398' || id === '4398' || !lastActorMsg ? DEFAULT_BODY : lastActorMsg.text}</div>
      <div className="sm muted">
        Posted to #{c.relay?.channel ?? `case-${id}`} by case-actor through the inbound webhook, so the full history is in one thread.{' '}
        <a href="https://agentrelay.com" target="_blank" rel="noreferrer">Open in Relay</a>
      </div>
      <div className="sm muted">
        Bench suggests: {suggestion ? suggestion.text : 'call the payer appeals line, reference number HL-2210-4398.'}
      </div>
      <div className="row wrap">
        {taken ? (
          <Link className="btn btn-40 btn-dark" to={`/case/${id}`}>Open case</Link>
        ) : (
          <button className="btn btn-40 btn-dark" disabled={busy} onClick={() => act(() => callCase(id, 'claim', { name: 'Dana K.' }))}>
            Take the case
          </button>
        )}
        <button
          className="btn btn-40"
          disabled={busy}
          onClick={() => act(() => callCase(id, 'scheduleAlarm', new Date(Date.now() + 2 * 86400000).toISOString(), 'escalate'))}
        >
          Snooze 2 days
        </button>
      </div>
    </div>
  )
}
