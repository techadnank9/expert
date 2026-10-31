import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { callCase, useCase } from '../api'
import { Header, LiveDot } from '../components/Header'
import { Thread } from '../components/Thread'
import { RecommendationCard } from '../components/RecommendationCard'
import { DeadlinesCard, DurableStatePanel } from '../components/DurableStatePanel'
import { AGENTS } from '../people'
import { ago, fmtDate, initials, money, useNow } from '../format'
import { statusOf } from '../people'
import { NotFound } from './NotFound'

export function Worker() {
  const { id = '4471' } = useParams()
  const live = useCase(id)
  const now = useNow()
  const [q, setQ] = useState('')
  const [asking, setAsking] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const c = live.data
  if (!c) return live.loading ? <div className="page" /> : <NotFound what={`Case ${id}`} />

  const st = statusOf(c.status)
  const worker = c.worker?.name ?? 'Maya Chen'

  const ask = async () => {
    const question = q.trim()
    if (!question) return
    setAsking(true)
    setErr(null)
    try {
      await callCase(id, 'ask', question)
      setQ('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="page">
      <Header
        subtitle="Medical billing desk"
        center={
          <div className="hdr-center">
            <div className="hdr-title">
              Claim {id}: {c.title.replace(/^Appeal\s+/i, '').replace(/^denied/i, 'denied')}
            </div>
            <span className={`pill ${st.pill}`}>{st.label}</span>
          </div>
        }
        meta={
          <>
            <LiveDot offline={live.offline} connected={live.connected} />
            actor case-{id}
            <br />
            {live.offline ? 'bridge offline, showing fixtures' : `state persisted ${ago(live.lastWrite, now)}`}
          </>
        }
        me={{ initials: initials(worker), tone: 'green' }}
      />

      <div className="main">
        <div className="col col-left">
          <div className="card">
            <div className="label">CASE</div>
            <div className="grid2">
              <div className="fact"><div className="sm muted">Payer</div><div className="medium">{c.facts.payer}</div></div>
              <div className="fact"><div className="sm muted">Amount</div><div className="medium">{money(c.facts.amount)}</div></div>
              <div className="fact"><div className="sm muted">Denial code</div><div className="medium">{c.facts.denialCode}</div></div>
              <div className="fact"><div className="sm muted">Date of service</div><div className="medium">{c.facts.dateOfService ? fmtDate(c.facts.dateOfService) : ''}</div></div>
            </div>
            <div className="fact"><div className="sm muted">Stated reason</div><div>{c.facts.reason}</div></div>
          </div>

          <DeadlinesCard c={c} />

          <div className="card g10">
            <div className="label">DOCUMENTS</div>
            {c.documents.map((d) => (
              <a key={d.name} href="#" className="doc" onClick={(e) => e.preventDefault()}>
                <span>{d.name}</span>
                <span className="sm muted">
                  {AGENTS[d.source] ? `pulled by ${AGENTS[d.source].name}` : `${d.pages} ${Number(d.pages) === 1 ? 'page' : 'pages'}`}
                </span>
              </a>
            ))}
            <button className="btn btn-40" style={{ marginTop: 4 }} onClick={() => window.alert('Upload is not wired in the hackathon build.')}>
              Upload document
            </button>
          </div>
        </div>

        <div className="card flush col-main" style={{ flex: '999 1 480px' }}>
          <div className="card-head">
            <div className="fact" style={{ gap: 0 }}>
              <div className="h2">The bench</div>
              <div className="sm muted">
                Agent Relay channel #{c.relay?.channel ?? `case-${id}`}
                {c.relay?.threadRootId ? ', thread: appeal question. ' : '. '}
                <a href="https://agentrelay.com" target="_blank" rel="noreferrer">Open in Relay</a>
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="pill pill-blue">Policy</span>
              <span className="pill pill-blue">Billing codes</span>
              <span className="pill pill-blue">Appeals</span>
            </div>
          </div>

          <Thread c={c}>
            {c.status === 'consulting' && (
              <div className="sm muted">Bench is working in #{c.relay?.channel ?? `case-${id}`}. Replies appear here as they land.</div>
            )}
            <RecommendationCard
              c={c}
              onApprove={() => callCase(id, 'approveRecommendation')}
              onOverride={(reason) => callCase(id, 'overrideRecommendation', reason)}
              onSendBack={(question) => callCase(id, 'ask', question)}
            />
            {['drafted', 'awaiting_poster', 'approved'].includes(c.status) && (
              <div className="row wrap center">
                <Link className="btn btn-40" to={`/poster/${id}/review`}>Poster review</Link>
                <span className="sm muted">See what the poster sees once the draft is submitted.</span>
              </div>
            )}
          </Thread>

          <form
            style={{ padding: '12px 20px 20px', borderTop: '1px solid #E2DFD6', display: 'flex', flexDirection: 'column', gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault()
              void ask()
            }}
          >
            <label htmlFor="followup" className="sm muted">
              {c.thread.some((m) => m.author === 'maya') ? 'Ask the bench a follow-up' : 'Ask the bench'}
            </label>
            <div className="row wrap">
              <input
                id="followup"
                className="input"
                style={{ flex: '1 1 240px' }}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. What if the payer says PT notes are incomplete?"
              />
              <button type="submit" className="btn btn-blue" disabled={asking || !q.trim()}>
                {asking ? 'Asking...' : 'Ask'}
              </button>
            </div>
            {err && <div className="err">{err}</div>}
          </form>
        </div>

        <DurableStatePanel
          id={id}
          c={c}
          live={live}
          onFire={(alarmId) => callCase(id, 'fireAlarm', alarmId)}
          onFireDue={() => callCase(id, 'fireDueAlarms')}
        />
      </div>
    </div>
  )
}
