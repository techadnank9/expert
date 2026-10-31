import { Link, useParams } from 'react-router-dom'
import { callCase, useCase } from '../api'
import { Header } from '../components/Header'
import { PosterSteps } from '../components/PosterSteps'
import { Thread } from '../components/Thread'
import { WorkspaceCard } from '../components/WorkspaceCard'
import { fmtShort, fmtWhen, initials, shortName, useNow } from '../format'
import type { CaseStatus } from '../types'
import { NotFound } from './NotFound'

const STAGE: Record<CaseStatus, number> = {
  open: 0, claimed: 1, consulting: 2, recommended: 2, escalated: 2, drafted: 3, awaiting_poster: 4, approved: 5,
}

export function PosterProgress() {
  const { id = '4471' } = useParams()
  const live = useCase(id)
  const now = useNow(10000)
  const c = live.data
  if (!c) return live.loading ? <div className="page" /> : <NotFound what={`Job ${id}`} />

  const stage = STAGE[c.status] ?? 0
  const worker = c.worker ? shortName(c.worker.name) : null
  const claimed = c.decisionLog.find((e) => /claim/i.test(e.event))
  const posted = c.decisionLog[0]
  const benchMsgs = c.thread.filter((m) => ['policy', 'billing', 'appeals'].includes(m.author)).length
  const nudge = c.alarms.find((a) => a.kind === 'nudge' && !a.fired)
  const color = (i: number) => (stage > i ? '#1E6B3A' : stage === i ? '#2F4BD6' : '#E2DFD6')
  const steps = [
    { t: 'Posted', d: posted ? `${fmtWhen(posted.at, now)}. Actor and channel created.` : 'Actor and channel created.' },
    { t: 'Claimed', d: worker ? `${claimed ? fmtWhen(claimed.at, now) : ''} by ${worker}, 94% approval rate.` : 'Waiting for a worker.' },
    { t: 'Bench consulting', d: `3 agents, ${benchMsgs} messages so far.` },
    { t: 'Deliverable drafted', d: 'Appeal letter and packet.' },
    { t: 'Your review', d: 'You chose to review before it goes to the payer.' },
  ]

  const addNote = async () => {
    const text = window.prompt('Note to the worker (lands in the thread as you):')
    if (text && text.trim()) await callCase(id, 'appendThreadMessage', { author: 'poster', text: text.trim(), at: new Date().toISOString(), reactions: {} })
  }

  return (
    <div className="page">
      <Header subtitle={`${c.poster.name}, poster account`} right={<PosterSteps step={2} />} />
      <div className="stack">
        <div className="row wrap between" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div className="fact" style={{ gap: 4 }}>
            <div className="h1">Job {id}: {c.title.charAt(0).toLowerCase() + c.title.slice(1).replace(/,\s*CPT.*$/i, '')}</div>
            <div className="muted">
              {worker ? `Claimed by ${worker}${claimed ? `, ${fmtWhen(claimed.at, now)}` : ''}. ` : 'Waiting for a worker to claim it. '}
              {stage === 2 ? 'Bench is consulting now.' : stage >= 3 ? 'The deliverable is ready for you.' : ''}
            </div>
          </div>
          <div className="row wrap">
            <button className="btn btn-40" onClick={() => void addNote()}>Add a note to the worker</button>
            <button className="btn btn-40" onClick={() => window.alert('Upload is not wired in the hackathon build.')}>Add documents</button>
            {stage >= 3 && <Link className="btn btn-40 btn-dark" to={`/poster/${id}/review`}>Review the deliverable</Link>}
          </div>
        </div>

        <div className="timeline">
          {steps.map((s, i) => (
            <div key={s.t} className="tl">
              <div className="tl-bar" style={{ background: color(i) }} />
              <div className="strong" style={{ fontSize: 13, color: stage >= i ? '#1C1C1E' : '#5F5E5A' }}>{s.t}</div>
              <div className="sm muted">{s.d}</div>
            </div>
          ))}
        </div>

        <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
          <div className="card flush col-main">
            <div className="card-head">
              <div className="fact" style={{ gap: 0 }}>
                <div className="h2">Live thread, read only</div>
                <div className="sm muted">#{c.relay?.channel ?? `case-${id}`} on Agent Relay. You see what the worker sees.</div>
              </div>
              <span className={`pill ${live.offline ? 'pill-grey' : 'pill-blue'}`}>{live.offline ? 'offline' : 'live'}</span>
            </div>
            <Thread c={c} flat showAddress={false}>
              <div style={{ background: '#F6F5F1', borderRadius: 8, padding: '10px 14px', fontSize: 13, lineHeight: '18px', color: '#5F5E5A' }}>
                Posters can read but not post in the bench thread. Use "Add a note to the worker" above; it lands in the thread as you.
              </div>
            </Thread>
          </div>
          <div className="col col-side">
            <div className="card">
              <div className="label">YOUR WORKER</div>
              {c.worker ? (
                <>
                  <div className="row center" style={{ gap: 12 }}>
                    <div className="me me-green" style={{ width: 44, height: 44, flex: '0 0 44px', fontSize: 14 }}>{initials(c.worker.name)}</div>
                    <div className="fact" style={{ gap: 0 }}>
                      <div className="strong">{shortName(c.worker.name)}</div>
                      <div className="sm muted">Former front desk lead, 212 jobs, 94% approved first pass</div>
                    </div>
                  </div>
                  <div className="kv"><span>Medical billing jobs</span><span>148</span></div>
                  <div className="kv"><span>Appeals won</span><span>71%</span></div>
                </>
              ) : (
                <div className="muted">Not claimed yet. It is on the worker board now.</div>
              )}
            </div>
            <WorkspaceCard id={id} c={c} readOnly />
            <div className="card g10">
              <div className="label">DEADLINES</div>
              <div className="kv"><span style={{ color: '#1C1C1E' }}>Appeal due</span><span>{fmtShort(c.deadline)}</span></div>
              <div className="kv"><span style={{ color: '#1C1C1E' }}>Draft promised</span><span>Nov 2</span></div>
              <div className="kv"><span style={{ color: '#1C1C1E' }}>Alarm if quiet</span><span>{nudge ? fmtShort(nudge.at) : 'not set'}</span></div>
            </div>
            <div className="note">You will be notified when the draft is ready to review. Nothing goes to {c.facts.payer} without your approval.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
