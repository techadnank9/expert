import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callBoard } from '../api'
import { Header } from '../components/Header'
import { PosterSteps } from '../components/PosterSteps'
import type { Job } from '../types'

const DOMAINS = [
  ['medical-billing', 'Medical billing'],
  ['insurance-claims', 'Insurance claims'],
  ['benefits', 'Benefits'],
  ['immigration', 'Immigration paperwork'],
  ['tax', 'Tax'],
] as const

const POSTER = 'Cedar Street Clinic'

function parseDeadline(s: string) {
  const d = new Date(`${s} 17:00`)
  return isNaN(d.getTime()) ? new Date(Date.now() + 14 * 86400000).toISOString() : d.toISOString()
}

export function PostJob() {
  const nav = useNavigate()
  const [domain, setDomain] = useState<string>('medical-billing')
  const [outcome, setOutcome] = useState('Appeal a denied lumbar MRI claim, CPT 72148, denial code CO-50')
  const [details, setDetails] = useState('Patient had 8 weeks of PT before the MRI was ordered. Payer is Harborline Health. We have the denial letter, clinical notes and EOB.')
  const [deadline, setDeadline] = useState('Nov 14, 2026')
  const [pay, setPay] = useState('$45')
  const [review, setReview] = useState('I review first')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setErr(null)
    const job: Job = {
      id: String(4500 + Math.floor(Math.random() * 400)),
      title: outcome.trim(),
      domain,
      poster: POSTER,
      pay: Number(pay.replace(/[^0-9.]/g, '')) || 0,
      deadline: parseDeadline(deadline),
      estMinutes: 40,
      status: 'open',
      summary: details.trim(),
    }
    try {
      await callBoard('post', job)
      nav(`/poster/${job.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Header subtitle={`${POSTER}, poster account`} right={<PosterSteps step={1} />} />
      <div className="main">
        <form
          className="card col-main"
          style={{ padding: 24, gap: 20 }}
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="fact" style={{ gap: 4 }}>
            <div className="h1">Post a job</div>
            <div className="muted">Describe the outcome you need. A worker backed by a specialist bench will take it from here.</div>
          </div>
          <div className="field">
            <span className="field-label">Domain</span>
            <div className="row wrap">
              {DOMAINS.map(([k, label]) => (
                <button key={k} type="button" className={`btn btn-40 ${domain === k ? 'btn-dark' : ''}`} style={{ fontWeight: 500 }} onClick={() => setDomain(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="outcome" className="field-label">What outcome do you need?</label>
            <input id="outcome" className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="details" className="field-label">Context for the worker</label>
            <textarea id="details" className="input" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="field">
            <div className="field-label">Documents</div>
            <div style={{ border: '1px dashed #C9C5BA', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: '#FBFAF7' }}>
              <div className="kv"><span style={{ color: '#1C1C1E' }}>Denial letter.pdf</span><span className="sm muted" style={{ fontWeight: 400 }}>212 KB</span></div>
              <div className="kv"><span style={{ color: '#1C1C1E' }}>Clinical notes, PT visits.pdf</span><span className="sm muted" style={{ fontWeight: 400 }}>1.4 MB</span></div>
              <div className="kv"><span style={{ color: '#1C1C1E' }}>EOB.pdf</span><span className="sm muted" style={{ fontWeight: 400 }}>96 KB</span></div>
              <button type="button" className="btn btn-36" style={{ alignSelf: 'flex-start', padding: '0 12px' }}>Add files</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            <div className="field">
              <label htmlFor="deadline" className="field-label">Hard deadline</label>
              <input id="deadline" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pay" className="field-label">Pay to worker</label>
              <input id="pay" className="input" value={pay} onChange={(e) => setPay(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="review" className="field-label">Before sending to payer</label>
              <input id="review" className="input" value={review} onChange={(e) => setReview(e.target.value)} />
            </div>
          </div>
          <div className="row wrap center">
            <button type="submit" className="btn btn-dark" disabled={busy || !outcome.trim()}>{busy ? 'Posting...' : 'Post job'}</button>
            <button type="button" className="btn">Save draft</button>
            <span className="sm muted">Posting creates the case actor and its Relay channel. Documents are only visible inside that channel.</span>
          </div>
          {err && <div className="err">{err}</div>}
        </form>
        <div className="col col-side">
          <div className="card">
            <div className="label">WHAT HAPPENS NEXT</div>
            {[
              'A case actor is created and your documents are ingested. Alarms are set from the deadline.',
              'The job appears on the worker board. A qualified worker claims it, usually within an hour.',
              'The worker consults the specialist bench. You can watch the thread live.',
              'You review the deliverable with its full provenance, approve, and pay.',
            ].map((t, i) => (
              <div key={i} className="row" style={{ gap: 10 }}><span className="num">{i + 1}</span><span>{t}</span></div>
            ))}
          </div>
          <div className="card g10">
            <div className="label">BENCH FOR MEDICAL BILLING</div>
            <div className="kv"><span style={{ color: '#1C1C1E' }}>Policy agent</span><span className="sm muted" style={{ fontWeight: 400 }}>payer policy lookup</span></div>
            <div className="kv"><span style={{ color: '#1C1C1E' }}>Billing codes agent</span><span className="sm muted" style={{ fontWeight: 400 }}>CPT, modifiers, LCDs</span></div>
            <div className="kv"><span style={{ color: '#1C1C1E' }}>Appeals agent</span><span className="sm muted" style={{ fontWeight: 400 }}>drafting, deadlines</span></div>
          </div>
          <div className="note">Similar jobs this month: 61 posted, 57 resolved, median 2 days to a filed appeal.</div>
        </div>
      </div>
    </div>
  )
}
