import { useState, type ReactNode } from 'react'
import type { Alarm, Case } from '../types'
import type { Live } from '../api'
import { ago, countdown, daysUntil, fmtDate, fmtShort, fmtTime12, fmtWhen, useNow } from '../format'
import { statusOf } from '../people'

const ALARM_LABEL: Record<string, string> = {
  nudge: 'Alarm: nudge if no payer reply',
  escalate: 'Alarm: escalate to supervisor',
}

const RELAY_DASH = (import.meta.env.VITE_RELAY_OBSERVER_URL as string | undefined) ?? 'https://agentrelay.com'
const DEV = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev')

/** Left column card in the Worker view: deadline plus every alarm with a live countdown. */
export function DeadlinesCard({ c }: { c: Case }) {
  const now = useNow()
  const days = daysUntil(c.deadline, now)
  return (
    <div className="card">
      <div className="label">DEADLINES AND ALARMS</div>
      <div className="alarm-row">
        <div className="fact">
          <div className="medium">Appeal due</div>
          <div className="sm muted">{fmtDate(c.deadline)}</div>
        </div>
        <span className="pill pill-amber">{days} {days === 1 ? 'day' : 'days'}</span>
      </div>
      {c.alarms.map((a) => (
        <AlarmLine key={a.id} a={a} now={now} />
      ))}
    </div>
  )
}

function AlarmLine({ a, now }: { a: Alarm; now: number }) {
  return (
    <div className="alarm-row">
      <div className="fact">
        <div className="medium">{ALARM_LABEL[a.kind] ?? `Alarm: ${a.kind}`}</div>
        <div className="sm muted">
          {a.fired ? `fired ${fmtWhen(a.at, now)}` : `fires ${fmtShort(a.at)}, ${fmtTime12(a.at)} (${countdown(a.at, now)})`}
        </div>
      </div>
      <span className={`pill ${a.fired ? 'pill-amber' : 'pill-grey'}`}>{a.fired ? 'fired' : 'scheduled'}</span>
    </div>
  )
}

interface PanelProps {
  id: string
  c: Case
  live: Live<Case>
  onFire: (alarmId: string) => Promise<unknown>
  onFireDue: () => Promise<unknown>
  /** Optional card rendered at the top of the column (e.g. the workspace VM). */
  top?: ReactNode
}

/** Right column of the Worker view: decision log, durable state, dev alarm controls. */
export function DurableStatePanel({ id, c, live, onFire, onFireDue, top }: PanelProps) {
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const pending = c.alarms.filter((a) => !a.fired)
  const st = statusOf(c.status)
  const log = [...c.decisionLog].reverse()

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col col-right">
      {top}
      <div className="card">
        <div className="label">DECISION LOG</div>
        {log.length === 0 && <div className="muted">Nothing yet.</div>}
        {log.slice(0, 8).map((e, i) => (
          <div key={`${e.at}-${i}`} className="fact">
            <div className="medium">{e.event}</div>
            <div className="sm muted">
              {fmtWhen(e.at, now)}
              {e.actor && e.actor !== 'intake' ? `, ${e.actor}` : e.actor === 'intake' ? ', intake' : ''}
              {e.reason ? `. Reason: ${e.reason}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="card g10">
        <div className="label">DURABLE STATE</div>
        <div className="kv"><span>Actor</span><span>Case:{id}</span></div>
        <div className="kv"><span>Status</span><span className={`pill tight ${st.pill}`}>{c.status}</span></div>
        <div className="kv"><span>Persisted fields</span><span>{Object.keys(c).filter((k) => k !== 'id').length}</span></div>
        <div className="kv">
          <span>Connection</span>
          <span>{live.offline ? 'offline, fixtures' : live.connected ? 'live WebSocket' : 'REST only'}</span>
        </div>
        <div className="kv"><span>Pending alarms</span><span>{pending.length}</span></div>
        <div className="kv">
          <span>Relay channel</span>
          <a href={RELAY_DASH} target="_blank" rel="noreferrer" style={{ fontWeight: 500, textDecoration: 'none' }}>
            #{c.relay?.channel ?? `case-${id}`}
          </a>
        </div>
        <div className="kv"><span>Open thread</span><span>{c.relay?.threadRootId ?? 'none'}</span></div>
        <div className="kv"><span>Last write</span><span>{ago(live.lastWrite, now)}</span></div>

        {DEV && <div className="dev">
          <div className="sm muted">Dev only: alarms</div>
          {c.alarms.map((a) => (
            <div key={a.id} className="alarm-row sm">
              <span>
                {a.kind}, {a.fired ? 'fired' : countdown(a.at, now)}
              </span>
              <button className="btn btn-28" disabled={busy || a.fired} onClick={() => run(() => onFire(a.id))}>
                fire
              </button>
            </div>
          ))}
          <button className="btn btn-36 btn-amber" disabled={busy} onClick={() => run(onFireDue)}>
            Fire alarms now
          </button>
          <div className="sm muted">Calls fireDueAlarms(): only alarms whose time has passed fire. Use "fire" to force one.</div>
          {err && <div className="err">{err}</div>}
        </div>}
      </div>

      <div className="note">Supervisor Dana K. is viewing this case. Any note she adds shows here immediately.</div>
    </div>
  )
}
