import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PAST_JOBS } from '../fixtures'
import { fmtDate, money } from '../format'
import { callBoard, useBoard } from '../api'
import { Header, LiveDot } from '../components/Header'
import { JobCard } from '../components/JobCard'
import type { Job } from '../types'

const WORKER = { name: 'Maya Chen' }

export function BoardPage() {
  const live = useBoard()
  const nav = useNavigate()
  const [tab, setTab] = useState<'open' | 'mine'>(() => (new URLSearchParams(window.location.search).get('tab') === 'mine' ? 'mine' : 'open'))
  const earned = PAST_JOBS.reduce((n, j) => n + j.pay, 0)
  const paid = PAST_JOBS.filter((j) => j.status !== 'Verified and sent').reduce((n, j) => n + j.pay, 0)
  const jobs = live.data?.jobs ?? []
  const open = jobs.filter((j) => j.status === 'open')
  const sorted = [...open].sort((a, b) => a.deadline.localeCompare(b.deadline) || b.pay - a.pay)
  // Deadline then pay, but keep the demo job (4471) on top when it is open.
  const ordered = [...sorted.filter((j) => j.id === '4471'), ...sorted.filter((j) => j.id !== '4471'), ...jobs.filter((j) => j.status !== 'open')]
  const mine = jobs.filter((j) => j.status === 'claimed' && (typeof j.worker === 'string' ? j.worker : j.worker?.name) === WORKER.name).length

  const claim = async (job: Job) => {
    await callBoard('claim', job.id, WORKER)
    nav(`/case/${job.id}/brief`)
  }

  return (
    <div className="page">
      <Header
        subtitle="Worker board"
        center={
          <div className="hdr-center" style={{ flex: '1 1 240px', gap: 8 }}>
            <button className={`btn btn-36${tab === 'open' ? ' btn-dark' : ''}`} style={{ fontWeight: 500 }} onClick={() => setTab('open')}>Open jobs</button>
            <button className={`btn btn-36${tab === 'mine' ? ' btn-dark' : ''}`} style={{ fontWeight: 500 }} onClick={() => setTab('mine')}>My jobs ({PAST_JOBS.length + mine})</button>
            <button className="btn btn-36">Earnings</button>
          </div>
        }
        meta={
          <>
            <LiveDot offline={live.offline} connected={live.connected} />
            Maya C.
            <br />
            {live.offline ? 'board offline, fixtures' : '$412 this week'}
          </>
        }
        me={{ initials: 'MC', tone: 'green' }}
      />
      <div className="main">
        <div className="col col-side" style={{ maxWidth: 280, flex: '1 1 240px' }}>
          <div className="card">
            <div className="label">FILTERS</div>
            <div className="field">
              <label htmlFor="q" className="sm muted">Search</label>
              <input id="q" className="input" style={{ height: 40 }} type="text" placeholder="payer, code, keyword" />
            </div>
            <div className="col" style={{ gap: 8 }}>
              <div className="sm muted">Domain</div>
              <label className="check"><input type="checkbox" defaultChecked /><span>Medical billing</span></label>
              <label className="check"><input type="checkbox" defaultChecked /><span>Insurance claims</span></label>
              <label className="check"><input type="checkbox" /><span>Benefits</span></label>
              <label className="check"><input type="checkbox" /><span>Immigration paperwork</span></label>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <div className="sm muted">Show</div>
              <label className="check"><input type="checkbox" defaultChecked /><span>Jobs I qualify for</span></label>
              <label className="check"><input type="checkbox" /><span>Stretch jobs, bench carries more</span></label>
            </div>
          </div>
          <div className="card g10">
            <div className="label">YOUR STANDING</div>
            <div className="kv"><span>Verified first pass</span><span>94%</span></div>
            <div className="kv"><span>Unlocked domains</span><span>2 of 5</span></div>
            <div className="kv"><span>Next unlock</span><span>Benefits, 6 jobs</span></div>
          </div>
        </div>
        {tab === 'mine' ? (
        <div className="col col-main" style={{ gap: 12 }}>
          <div className="row wrap between center">
            <div className="strong" style={{ fontSize: 18, lineHeight: '24px' }}>My jobs</div>
            <div className="sm muted">completed in Oct 2026</div>
          </div>
          <div className="card g10">
            <div className="row wrap between center">
              <div className="fact" style={{ gap: 0 }}>
                <div className="sm muted">Earnings, Oct 2026</div>
                <div className="strong" style={{ fontSize: 22, lineHeight: '28px' }}>{money(earned)}</div>
              </div>
              <div className="sm muted">
                {money(paid)} paid out, {money(earned - paid)} pending business review · {PAST_JOBS.length} jobs, {PAST_JOBS.filter((j) => j.status === 'Fix requested once').length} needed one fix
              </div>
            </div>
          </div>
          <div className="card flush">
            {PAST_JOBS.map((j, i) => (
              <div key={j.id} className="row wrap between center" style={{ padding: '14px 20px', borderTop: i ? '1px solid #E2DFD6' : undefined, gap: 12 }}>
                <div className="fact" style={{ gap: 2, flex: '1 1 280px', minWidth: 0 }}>
                  <div className="medium">{j.title}</div>
                  <div className="sm muted">{j.business} · job {j.id} · completed {fmtDate(j.completed)}</div>
                </div>
                <span className={`pill ${j.status === 'Paid' ? 'pill-green' : j.status === 'Verified and sent' ? 'pill-blue' : 'pill-amber'}`}>{j.status}</span>
                <span className="strong" style={{ width: 56, textAlign: 'right' }}>{money(j.pay)}</span>
              </div>
            ))}
          </div>
          <div className="sm muted">Every job here was done by you and verified by the bench before it went to the business.</div>
        </div>
        ) : (
        <div className="col col-main" style={{ gap: 12 }}>
          <div className="row wrap between center">
            <div className="strong" style={{ fontSize: 18, lineHeight: '24px' }}>
              {open.length} open {open.length === 1 ? 'job' : 'jobs'}
            </div>
            <div className="sm muted">sorted by deadline, then pay</div>
          </div>
          {live.loading && !live.data && <div className="muted">Loading board...</div>}
          {ordered.map((j, i) => (
            <JobCard key={j.id} job={j} featured={i === 0} onClaim={claim} />
          ))}
          <div className="sm muted">
            Claiming is one actor method, so two workers can never hold the same job. The board itself is a Durable Actor that every worker's browser subscribes to, which is why a claim disappears from everyone's list instantly.
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
