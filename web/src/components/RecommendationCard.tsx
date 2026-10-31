import { useState } from 'react'
import type { Case } from '../types'
import { AGENTS, BENCH } from '../people'
import { fmtWhen, shortName } from '../format'

interface Props {
  c: Case
  onApprove: () => Promise<unknown>
  onOverride: (reason: string) => Promise<unknown>
  /** Kept for callers; the verification flow uses Request another check instead. */
  onSendBack?: (question: string) => Promise<unknown>
}

function ThumbsUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  )
}

/** Votes = recommendation.agrees plus any :+1: reactions on the recommendation message. */
export function agreeing(c: Case): string[] {
  const set = new Set<string>(c.recommendation?.agrees ?? [])
  const recMsg = c.thread.find((m) => m.id === c.relay?.recommendationId)
  for (const [emoji, who] of Object.entries(recMsg?.reactions ?? {})) {
    if (/\+1|thumbsup/.test(emoji)) who.forEach((w) => set.add(w))
  }
  return [...set].filter((h) => (BENCH as readonly string[]).includes(h))
}

export function RecommendationCard({ c, onApprove, onOverride }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const rec = c.recommendation
  if (!rec) return null

  const votes = agreeing(c)
  const total = BENCH.length
  const decided = ['drafted', 'awaiting_poster', 'approved'].includes(c.status)
  const approval = [...c.decisionLog].reverse().find((e) => /approved the recommendation/i.test(e.event))
  const override = [...c.decisionLog].reverse().find((e) => /overr/i.test(e.event))
  const overridden = !decided && override && c.status !== 'recommended'
  const worker = c.worker?.name ?? 'the worker'

  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const override_ = () => {
    const reason = window.prompt('What should the bench check again? This is posted to the thread and saved as training signal.')
    if (reason && reason.trim()) void run('override', () => onOverride(reason.trim()))
  }

  return (
    <div className={`rec${decided ? ' approved' : ''}`}>
      <div className="row wrap between center">
        <div className="fact">
          <div className="h2">Verification verdict: {rec.summary}</div>
          <div className="sm muted">
            posted via action post_recommendation
            {c.relay?.recommendationId && `, reply ${c.relay.recommendationId}`}
            {c.relay?.threadRootId && ` in thread ${c.relay.threadRootId}`}
          </div>
        </div>
        <div className={`agree${votes.length < total ? ' partial' : ''}`} title={votes.map((v) => AGENTS[v]?.name ?? v).join(', ')}>
          <ThumbsUp />
          <span>
            {votes.length} of {total} verified
          </span>
          <span style={{ display: 'flex', gap: 2 }}>
            {votes.map((v) => (
              <span key={v} className="dot" style={{ background: AGENTS[v]?.bg ?? '#5F5E5A' }}>
                {AGENTS[v]?.initial ?? v[0]}
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="col" style={{ gap: 6 }}>
        <div className="label">FIXES / CHECKS</div>
        {rec.steps.map((s, i) => (
          <div key={i} className="row">
            <span className="muted">{i + 1}.</span>
            <span>{s}</span>
          </div>
        ))}
      </div>

      {rec.sources.length > 0 && (
        <div className="sm muted">
          Sources:{' '}
          {rec.sources.map((s, i) => (
            <span key={s}>
              <a href="#" onClick={(e) => e.preventDefault()}>
                {s}
              </a>
              {i < rec.sources.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}

      {decided ? (
        <div className="outcome outcome-ok">
          <strong>Accepted and sent to the business</strong> by {shortName(worker)}
          {approval ? `, ${fmtWhen(approval.at)}` : ''}. Check reaction added on {c.relay?.recommendationId ?? 'the verdict'}, decision written to the actor.
        </div>
      ) : overridden ? (
        <div className="outcome outcome-override">
          <strong>Another check requested</strong> by {shortName(worker)}
          {override?.reason ? `: "${override.reason}"` : ''}. Reason posted to the thread and persisted.
        </div>
      ) : (
        <>
          <div className="row wrap">
            <button className="btn btn-dark" disabled={!!busy} onClick={() => run('approve', onApprove)}>
              {busy === 'approve' ? 'Sending...' : 'Accept and send to business'}
            </button>
            <button className="btn" disabled={!!busy} onClick={override_}>
              {busy === 'override' ? 'Saving...' : 'Request another check'}
            </button>
          </div>
          <div className="sm muted">
            The bench checked your work; votes are Agent Relay reactions. Accept adds a check reaction on {c.relay?.recommendationId ?? 'the verdict'}, writes the decision to the actor and sends the work to the business for review. Request another check asks what to re-check; the reason is posted to the thread and persisted as training signal.
          </div>
        </>
      )}
      {err && <div className="err">{err}</div>}
    </div>
  )
}
