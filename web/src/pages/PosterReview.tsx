import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { callCase, useCase } from '../api'
import { Header } from '../components/Header'
import { PosterSteps } from '../components/PosterSteps'
import { agreeing } from '../components/RecommendationCard'
import { fmtWhen, money, sessionUrl, shortName, useNow } from '../format'
import { NotFound } from './NotFound'

export function PosterReview() {
  const { id = '4471' } = useParams()
  const live = useCase(id)
  const now = useNow(10000)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const c = live.data
  if (!c) return live.loading ? <div className="page" /> : <NotFound what={`Job ${id}`} />

  const worker = shortName(c.worker?.name ?? 'Maya Chen')
  const done = c.status === 'approved' || c.pay.released
  const fee = Math.round(c.pay.amount * 0.2 * 100) / 100
  const votes = agreeing(c)
  const approval = [...c.decisionLog].reverse().find((e) => /approved the recommendation/i.test(e.event))
  const policyMsg = c.thread.find((m) => m.author === 'policy' && m.sessionRef)
  const appealsMsg = [...c.thread].reverse().find((m) => m.author === 'appeals' && m.sessionRef)
  const posterApproval = [...c.decisionLog].reverse().find((e) => /poster approved/i.test(e.event))

  const approve = async () => {
    setBusy(true)
    setErr(null)
    try {
      await callCase(id, 'posterApprove')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const requestChanges = async () => {
    const text = window.prompt('What should change?')
    if (text && text.trim()) await callCase(id, 'appendThreadMessage', { author: 'poster', text: `Changes requested: ${text.trim()}`, at: new Date().toISOString(), reactions: {} })
  }

  return (
    <div className="page">
      <Header subtitle={`${c.poster.name}, poster account`} right={<PosterSteps step={3} />} />
      <div className="stack">
        <div className="fact" style={{ gap: 4 }}>
          <div className="h1">Review the deliverable</div>
          <div className="muted">
            {worker} submitted a level 1 appeal packet for job {id}. Approve to release ${c.pay.amount} and send it to {c.facts.payer}.
          </div>
        </div>
        <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
          <div className="col col-main">
            <div className="card flush">
              <div className="card-head">
                <div className="h2">Appeal letter, {c.facts.payer}, claim {id}</div>
                <div className="row">
                  <a href="#" style={{ fontSize: 13 }} onClick={(e) => e.preventDefault()}>Download PDF</a>
                  <a href="#" style={{ fontSize: 13 }} onClick={(e) => e.preventDefault()}>Packet (4 files)</a>
                </div>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: '22px' }}>
                <div>
                  To: {c.facts.payer}, Appeals Department
                  <br />
                  Re: Level 1 appeal, claim {id}, CPT 72148, denial code {c.facts.denialCode}
                </div>
                <div>
                  We request reconsideration of the denial dated Oct 24, 2026. Plan policy CG-0423, section 4.2, provides coverage for lumbar MRI without contrast when at least six weeks of conservative therapy are documented prior to imaging.{' '}
                  <span className="hl">The enclosed physical therapy records document eight weeks of treatment from Aug 4 to Sep 29, 2026</span>, exceeding the policy threshold.
                </div>
                <div>
                  The ordering physician's note dated Sep 30, 2026 records persistent radicular symptoms despite therapy and establishes medical necessity for advanced imaging.{' '}
                  <span className="hl">Enclosures: denial letter, PT visit log, physician note, policy excerpt.</span>
                </div>
                <div className="sm muted">Highlighted passages are backed by a bench citation. Hover one in the real product to see the source and the agent session that found it.</div>
              </div>
            </div>
            <div className="card g10">
              <div className="label">PROVENANCE</div>
              <div className="row wrap between"><span>Bench recommendation, {votes.length} of 3 agents agreed</span><a href="https://agentrelay.com" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>thread {c.relay?.threadRootId ?? ''}</a></div>
              <div className="row wrap between"><span>Policy CG-0423 s4.2 pulled by Policy agent</span>{policyMsg?.sessionRef && <a href={sessionUrl(policyMsg.sessionRef)} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>session</a>}</div>
              <div className="row wrap between"><span>PT dates verified against clinical notes p.3</span>{policyMsg?.sessionRef && <a href={sessionUrl(policyMsg.sessionRef)} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>session</a>}</div>
              <div className="row wrap between">
                <span>{approval ? 'Worker approved the recommendation, no overrides' : 'Worker has not approved the recommendation yet'}</span>
                {approval && <span className="muted" style={{ fontSize: 13 }}>{fmtWhen(approval.at, now)}</span>}
              </div>
              <div className="row wrap between"><span>Draft reviewed by Appeals agent, 2 edits</span>{appealsMsg?.sessionRef && <a href={sessionUrl(appealsMsg.sessionRef)} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>session</a>}</div>
            </div>
          </div>
          <div className="col col-side">
            <div className="card" style={{ border: '2px solid #1C1C1E' }}>
              <div className="label">YOUR DECISION</div>
              <div className="kv"><span>Pay to {worker}</span><span className="strong">{money(c.pay.amount)}</span></div>
              <div className="kv"><span>Platform fee</span><span className="strong">{money(fee)}</span></div>
              <div className="kv"><span>Claim at stake</span><span className="strong">{money(c.facts.amount)}</span></div>
              {done ? (
                <div className="outcome outcome-ok">
                  <strong>Approved{posterApproval ? `, ${fmtWhen(posterApproval.at, now)}` : ''}.</strong> {money(c.pay.amount)} released to {worker}, appeal sent to {c.facts.payer}.
                </div>
              ) : (
                <>
                  <button className="btn btn-dark" disabled={busy} onClick={() => void approve()}>{busy ? 'Approving...' : 'Approve, pay, and send to payer'}</button>
                  <button className="btn" disabled={busy} onClick={() => void requestChanges()}>Request changes</button>
                </>
              )}
              {err && <div className="err">{err}</div>}
              <div className="sm muted">Approval is one actor method: it releases pay, marks the job complete, posts to the thread, and schedules the Nov 10 follow-up alarm.</div>
            </div>
            <div className="card g10">
              <div className="label">AFTER YOU APPROVE</div>
              <div className="row" style={{ gap: 10 }}><span className="muted">Nov 10</span><span>Alarm checks for a payer response, nudges {worker} if quiet</span></div>
              <div className="row" style={{ gap: 10 }}><span className="muted">Nov 12</span><span>Escalates to a supervisor if still unresolved</span></div>
              <div className="row" style={{ gap: 10 }}><span className="muted">Then</span><span>You are notified of the payer's decision in this same case</span></div>
            </div>
            <div className="note">Rate the result after the payer responds. Ratings feed the worker's approval score and the bench's calibration.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
