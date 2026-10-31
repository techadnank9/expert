import { useCase } from '../api'
import { Header, LiveDot } from '../components/Header'
import { CaseTable, isHot } from '../components/CaseTable'
import { AlarmCard } from '../components/AlarmCard'
import { CASE_IDS } from '../fixtures'
import { countdown, fmtClock, isToday, useNow } from '../format'
import type { Case } from '../types'

const STATIC_FEED = [
  { at: '12:41', text: 'Appeals agent dissented on 4466, asked Policy for the COB clause' },
  { at: '12:38', text: 'Jon T. overrode bench on 4452, reason: payer accepted late filing before' },
  { at: '12:30', text: 'Ana L. resubmitted 4439' },
]

export function Supervisor() {
  // One hook per live case; the ids list is fixed so hook order is stable.
  const a = useCase(CASE_IDS[0])
  const b = useCase(CASE_IDS[1])
  const live = [
    { id: CASE_IDS[0], l: a },
    { id: CASE_IDS[1], l: b },
  ]
  const now = useNow()
  const cases = live.filter((x) => x.l.data) as { id: string; l: { data: Case } }[]
  const hot = cases.filter((x) => isHot(x.l.data))
  const escalated = cases.filter((x) => x.l.data.status === 'escalated').length
  const firedCount = cases.reduce((n, x) => n + x.l.data.alarms.filter((al) => al.fired).length, 0)
  const waiting = cases.filter((x) => x.l.data.status === 'recommended').length
  const offline = live.some((x) => x.l.offline)
  const connected = live.every((x) => x.l.connected)

  // Sort: hot first, then soonest next alarm.
  const nextAt = (c: Case) => Math.min(...c.alarms.filter((al) => !al.fired).map((al) => Date.parse(al.at)), Infinity)
  const ids = [...cases]
    .sort((x, y) => Number(isHot(y.l.data)) - Number(isHot(x.l.data)) || nextAt(x.l.data) - nextAt(y.l.data))
    .map((x) => x.id)
  const missing = live.filter((x) => !x.l.data).map((x) => x.id)

  const feed = cases
    .flatMap((x) => x.l.data.decisionLog.filter((e) => isToday(e.at, now)).map((e) => ({ at: fmtClock(e.at), text: `${e.event} on ${x.id}` })))
    .concat(STATIC_FEED)
    .sort((p, q) => q.at.localeCompare(p.at))
    .slice(0, 6)

  const upcoming = cases
    .flatMap((x) => x.l.data.alarms.filter((al) => !al.fired).map((al) => ({ id: x.id, al })))
    .sort((p, q) => p.al.at.localeCompare(q.al.at))[0]

  return (
    <div className="page">
      <Header
        subtitle="Supervisor desk, medical billing"
        center={
          <div className="hdr-center" style={{ flex: '1 1 240px', gap: 8 }}>
            <button className="btn btn-36 btn-dark" style={{ fontWeight: 500 }}>All cases</button>
            <button className="btn btn-36">Needs me</button>
            <button className="btn btn-36">Alarms</button>
          </div>
        }
        meta={
          <>
            <LiveDot offline={offline} connected={connected} />
            {offline ? 'bridge offline, showing fixtures' : 'live, 42 actors connected'}
          </>
        }
        me={{ initials: 'DK', tone: 'blue' }}
      />

      <div className="stack" style={{ gap: 24 }}>
        <div className="stats">
          <div className="stat"><div className="sm muted">Open cases</div><div className="stat-n">42</div><div className="sm muted">across 6 workers</div></div>
          <div className="stat"><div className="sm muted">Waiting on a human</div><div className="stat-n">{5 + waiting}</div><div className="sm muted">bench done, needs approve or override</div></div>
          <div className="stat amber">
            <div className="sm" style={{ color: '#8A4B00' }}>Alarms fired today</div>
            <div className="stat-n" style={{ color: '#5C3300' }}>{2 + firedCount}</div>
            <div className="sm" style={{ color: '#8A4B00' }}>{escalated} escalated to you</div>
          </div>
          <div className="stat"><div className="sm muted">Overrides this week</div><div className="stat-n">4</div><div className="sm muted">of 61 bench recommendations</div></div>
        </div>

        <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
          <div className="card flush" style={{ flex: '999 1 560px', minWidth: 0 }}>
            <div className="card-head">
              <div className="h2">Cases</div>
              <div className="sm muted">sorted by next alarm</div>
            </div>
            <CaseTable ids={[...ids, ...missing]} />
          </div>

          <div className="col" style={{ flex: '1 1 300px', maxWidth: 360 }}>
            {hot.map((x) => (
              <AlarmCard key={x.id} id={x.id} c={x.l.data} />
            ))}
            {hot.length === 0 && (
              <div className="alarm-card quiet">
                <div className="alarm-row">
                  <div className="h2">No alarms fired</div>
                  <span className="pill tight pill-grey">watching</span>
                </div>
                <div className="muted">
                  {upcoming
                    ? `Next: case ${upcoming.id} ${upcoming.al.kind === 'escalate' ? 'escalates' : 'nudges'} ${countdown(upcoming.al.at, now)}. The actor wakes itself; this card turns amber when it fires.`
                    : 'No pending alarms on live cases.'}
                </div>
              </div>
            )}

            <div className="card g10">
              <div className="label">LIVE ACROSS CASES</div>
              {feed.map((f, i) => (
                <div key={i} className="feed"><span>{f.at}</span><span>{f.text}</span></div>
              ))}
            </div>
            <div className="note">Overrides with a reason are the training signal. 4 this week, all with reasons, 2 from the same payer.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
