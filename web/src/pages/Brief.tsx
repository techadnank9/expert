import { Link, useParams } from 'react-router-dom'
import { useCase } from '../api'
import { Header } from '../components/Header'
import { AGENTS, BENCH } from '../people'
import { fmtShort, sessionUrl } from '../format'
import { NotFound } from './NotFound'

export function Brief() {
  const { id = '4471' } = useParams()
  const live = useCase(id)
  const c = live.data
  if (!c) return live.loading ? <div className="page" /> : <NotFound what={`Case ${id}`} />

  const firstBy = BENCH.map((h) => ({ h, m: [...c.thread].reverse().find((m) => m.author === h && !/post_recommendation/.test(m.text)) })).filter((x) => x.m)
  const sessions = new Set(c.thread.map((m) => m.sessionRef).filter(Boolean)).size
  const title = c.title.replace(/^Appeal\s+/i, '')

  return (
    <div className="page">
      <Header
        subtitle={`Job ${id}, claimed by you just now`}
        right={
          <div className="steps">
            <span className="pill pill-green">Claimed</span>
            <span className="pill pill-dark">Brief</span>
            <span className="pill pill-grey">Work</span>
            <span className="pill pill-grey">Submit</span>
          </div>
        }
      />
      <div className="main">
        <div className="col col-main">
          <div className="fact" style={{ gap: 4 }}>
            <div className="h1">You have this one. Here is your brief.</div>
            <div className="muted">The bench read the documents while you were claiming. Nothing below has been sent anywhere yet.</div>
          </div>
          <div className="card p20">
            <div className="label">WHAT THE POSTER NEEDS</div>
            <div style={{ fontSize: 15, lineHeight: '22px' }}>
              Appeal a {title.replace(/, CPT (\d+)/, ` claim (CPT $1, denial ${c.facts.denialCode})`)} for {c.poster.name}. Payer is {c.facts.payer}. Appeal is due {fmtShort(c.deadline)}. The poster wants to review the letter before it is sent.
            </div>
          </div>
          <div className="card p20">
            <div className="row wrap between center">
              <div className="label">WHAT THE BENCH ALREADY KNOWS</div>
              <span className="sm muted">pre-read in #{c.relay?.channel ?? `case-${id}`}, {sessions} sessions linked</span>
            </div>
            {firstBy.length === 0 && <div className="muted">The bench has not posted yet.</div>}
            {firstBy.map(({ h, m }) => (
              <div key={h} className="row" style={{ gap: 12 }}>
                <div className="avatar sm-av" style={{ background: AGENTS[h].bg }}>{AGENTS[h].initial}</div>
                <div>
                  <span className="strong">{AGENTS[h].short}:</span> {m!.text}{' '}
                  {m!.sessionRef && (
                    <a className="sm" href={sessionUrl(m!.sessionRef)} target="_blank" rel="noreferrer">view session</a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="card p20" style={{ gap: 12 }}>
            <div className="label">YOUR CHECKLIST</div>
            {[
              'Read the denial letter (2 pages)',
              'Confirm the PT dates in the clinical notes match what Policy agent found',
              'Ask the bench anything that is unclear, then approve or override its recommendation',
              'Review the drafted appeal letter and submit to the poster',
            ].map((t, i) => (
              <label key={t} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" defaultChecked={i === 0} style={{ marginTop: 3 }} />
                <span>{t}</span>
              </label>
            ))}
          </div>
          <div className="row wrap center">
            <Link to={`/case/${id}`} className="btn btn-dark">Start working</Link>
            <button className="btn" onClick={() => window.alert('Release is not wired in the hackathon build.')}>Release the job</button>
            <span className="sm muted">Release within 15 minutes with no penalty. After that the poster is notified.</span>
          </div>
        </div>
        <div className="col col-side">
          <div className="card g10">
            <div className="label">THIS JOB</div>
            <div className="kv"><span>Pay on approval</span><span className="strong">${c.pay.amount}</span></div>
            <div className="kv"><span>Estimated time</span><span>40 min</span></div>
            <div className="kv"><span>Appeal due</span><span>{fmtShort(c.deadline)}</span></div>
            <div className="kv"><span>Poster review</span><span>Yes</span></div>
            <div className="kv"><span>Case actor</span><span>Case:{id}</span></div>
          </div>
          <div className="card g10">
            <div className="label">DOCUMENTS</div>
            {c.documents.map((d) => (
              <a key={d.name} href="#" className="doc" style={{ padding: '4px 0' }} onClick={(e) => e.preventDefault()}>
                <span>{d.name}</span>
                <span className="sm muted">{AGENTS[d.source] ? 'pulled by bench' : `${d.pages} ${Number(d.pages) === 1 ? 'page' : 'pages'}`}</span>
              </a>
            ))}
          </div>
          <div className="note">You have done 23 appeals like this one. 17 were approved by the payer. The bench will flag anything that looks different from those.</div>
        </div>
      </div>
    </div>
  )
}
