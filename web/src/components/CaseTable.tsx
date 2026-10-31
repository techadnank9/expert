import { Link } from 'react-router-dom'
import type { Case } from '../types'
import { useCase } from '../api'
import { countdown, fmtShort, fmtWhen, money, shortName, useNow } from '../format'
import { statusOf } from '../people'
import { agreeing } from './RecommendationCard'

export function isHot(c: Case) {
  return c.status === 'escalated' || c.alarms.some((a) => a.fired)
}

/** Decorative rows copied from Supervisor.html so the table reads like a real desk. */
const STATIC_ROWS = [
  { id: '4466', title: 'coordination of benefits', sub: 'Bluepine Mutual, $2,310', worker: 'Maya R.', pill: 'pill-blue', status: 'Bench consulting', bench: '2 of 3, Appeals dissents', next: 'Nov 8, nudge' },
  { id: '4452', title: 'timely filing', sub: 'Bluepine Mutual, $410', worker: 'Jon T.', pill: 'pill-grey', status: 'Overridden by worker', bench: 'Recommended write-off', next: 'Nov 6, nudge' },
  { id: '4439', title: 'duplicate claim', sub: 'Harborline Health, $95', worker: 'Ana L.', pill: 'pill-green', status: 'Resubmitted', bench: '3 of 3 agree', next: 'Nov 14, close check' },
  { id: '4421', title: 'prior auth missing', sub: 'Cedarpoint Plan, $3,900', worker: 'Ana L.', pill: 'pill-grey', status: 'Idle, actor hibernating', bench: 'Retro auth requested', next: 'Nov 18, follow up' },
]

function LiveRow({ id }: { id: string }) {
  const { data: c } = useCase(id)
  const now = useNow()
  if (!c) {
    return (
      <tr>
        <td colSpan={6} className="muted">Case {id}: loading</td>
      </tr>
    )
  }
  const hot = isHot(c)
  const st = statusOf(c.status)
  const escalation = [...c.decisionLog].reverse().find((e) => /escalat/i.test(e.event))
  const statusText = c.status === 'escalated' ? `Escalated${escalation?.reason ? `, ${escalation.reason}` : ''}` : st.label
  const votes = agreeing(c)
  const bench = c.recommendation
    ? `${votes.length} of 3 agree, ${c.recommendation.summary.toLowerCase().includes('appeal') ? 'appeal' : c.recommendation.summary}`
    : ([...c.decisionLog].reverse().find((e) => e.actor !== 'case-actor')?.event ?? 'No question yet')
  const fired = [...c.alarms].filter((a) => a.fired).sort((a, b) => b.at.localeCompare(a.at))[0]
  const next = [...c.alarms].filter((a) => !a.fired).sort((a, b) => a.at.localeCompare(b.at))[0]
  const short = c.title.replace(/^Appeal\s+/i, '').replace(/,\s*CPT.*$/i, '')

  return (
    <tr className={hot ? 'hot' : undefined}>
      <td>
        <div className="medium">{id}: {short.charAt(0).toLowerCase() + short.slice(1)}</div>
        <div className="sm muted">{c.facts.payer}, {money(c.facts.amount, false)}</div>
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>{c.worker ? shortName(c.worker.name) : 'unclaimed'}</td>
      <td>
        <span className={`pill tight ${c.status === 'escalated' ? 'pill-amber-strong' : st.pill}`}>{statusText}</span>
      </td>
      <td>{bench}</td>
      <td>
        {fired ? (
          <span className="medium" style={{ color: '#8A4B00' }}>Fired {fmtWhen(fired.at, now)}</span>
        ) : next ? (
          Date.parse(next.at) - now < 3600_000 ? (
            <span className="medium">{next.kind}, {countdown(next.at, now)}</span>
          ) : (
            `${fmtShort(next.at)}, ${next.kind}`
          )
        ) : (
          'none'
        )}
      </td>
      <td>
        <Link to={`/case/${id}`} className="medium">Open</Link>
      </td>
    </tr>
  )
}

export function CaseTable({ ids }: { ids: readonly string[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="cases">
        <thead>
          <tr>
            <th>Case</th>
            <th>Worker</th>
            <th>Status</th>
            <th>Bench</th>
            <th>Next alarm</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => (
            <LiveRow key={id} id={id} />
          ))}
          {STATIC_ROWS.map((r) => (
            <tr key={r.id}>
              <td>
                <div className="medium">{r.id}: {r.title}</div>
                <div className="sm muted">{r.sub}</div>
              </td>
              <td>{r.worker}</td>
              <td><span className={`pill tight ${r.pill}`}>{r.status}</span></td>
              <td>{r.bench}</td>
              <td>{r.next}</td>
              <td><a href="#" className="medium" onClick={(e) => e.preventDefault()}>Open</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
