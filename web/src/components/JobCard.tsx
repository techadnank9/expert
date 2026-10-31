import { useState } from 'react'
import type { Job } from '../types'
import { fmtShort } from '../format'

const DOMAIN: Record<string, { label: string; pill: string }> = {
  'medical-billing': { label: 'Medical billing', pill: 'pill-blue' },
  'insurance-claims': { label: 'Insurance claims', pill: 'pill-grey' },
  benefits: { label: 'Benefits', pill: 'pill-grey' },
  immigration: { label: 'Immigration paperwork', pill: 'pill-grey' },
  tax: { label: 'Tax', pill: 'pill-grey' },
}

export function domainOf(d: string) {
  return DOMAIN[d] ?? { label: d, pill: 'pill-grey' }
}

export function nameOf(x: string | { name: string } | undefined) {
  return typeof x === 'string' ? x : x?.name ?? ''
}

function est(mins: number) {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

interface Props {
  job: Job
  featured?: boolean
  onClaim: (job: Job) => Promise<unknown>
}

export function JobCard({ job, featured, onClaim }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const taken = job.status === 'claimed'
  const dom = domainOf(job.domain)

  const claim = async () => {
    setBusy(true)
    setErr(null)
    try {
      await onClaim(job)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`job${featured && !taken ? ' featured' : ''}${taken ? ' taken' : ''}`}>
      <div className="job-info">
        <div className="row wrap center">
          <span className="strong" style={{ fontSize: 15 }}>{job.title}</span>
          <span className={`pill tight ${dom.pill}`}>{dom.label}</span>
        </div>
        <div className="muted">
          {taken
            ? `Claimed by ${(nameOf(job.worker) || 'another worker').replace(/\.$/, '')}. Shown so you can see what moves fast.`
            : `${nameOf(job.poster)}. ${job.summary ?? ''}`}
        </div>
        <div className="job-meta">
          <span>Due {fmtShort(job.deadline)}</span>
          <span>Est. {est(job.estMinutes)}</span>
          {!taken && job.bench && <span>Bench: {job.bench.join(', ')}</span>}
          {!taken && job.similar !== undefined && <span>Similar jobs you did: {job.similar}</span>}
        </div>
        {err && <div className="err">{err}</div>}
      </div>
      <div className="job-side">
        <div className="price">${job.pay}</div>
        {taken ? (
          <span className="pill pill-grey" style={{ padding: '2px 10px' }}>Claimed</span>
        ) : (
          <button className={`btn btn-40 ${featured ? 'btn-dark' : ''}`} style={{ padding: '0 16px', fontWeight: 600 }} disabled={busy} onClick={claim}>
            {busy ? 'Claiming...' : 'Claim'}
          </button>
        )}
      </div>
    </div>
  )
}
