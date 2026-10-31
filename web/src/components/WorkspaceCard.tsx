import { useEffect, useState } from 'react'
import { callCase, getWorkspace, type WorkspaceView } from '../api'
import type { Case, WorkspaceAgent, WorkspaceStatus } from '../types'

const OBSERVER = (import.meta.env.VITE_RELAY_OBSERVER_URL as string | undefined) ?? ''
const ROLE_LABEL: Record<string, string> = { policy: 'Policy agent', billing: 'Billing codes agent', appeals: 'Appeals agent' }

export function sessionHref(id: string) {
  return OBSERVER ? `${OBSERVER}#session=${encodeURIComponent(id)}` : '#'
}

export function roleLabel(role: string) {
  return ROLE_LABEL[role] ?? `${role.charAt(0).toUpperCase()}${role.slice(1)} agent`
}

function size(n?: number) {
  if (n === undefined) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`
  if (n >= 1000) return `${Math.round(n / 1000)} KB`
  return `${n} B`
}

/** Polls GET /api/workspace/:slug every `ms` until the VM is ready (then every 15 s). Falls back to a simulated view offline. */
export function useWorkspace(slug: string | null | undefined, ms = 3000) {
  const [ws, setWs] = useState<WorkspaceView | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!slug) {
      setWs(null)
      return
    }
    let dead = false
    void getWorkspace(slug).then((d) => {
      if (!dead) setWs(d)
    })
    return () => {
      dead = true
    }
  }, [slug, tick])
  const ready = ws?.status === 'ready'
  useEffect(() => {
    if (!slug) return
    const t = setTimeout(() => setTick((n) => n + 1), ready ? 15000 : ms)
    return () => clearTimeout(t)
  }, [slug, tick, ready, ms])
  return ws
}

export function WorkspaceStatusPill({ status }: { status: WorkspaceStatus }) {
  const tone = status === 'ready' ? 'pill-green' : status === 'error' ? 'pill-amber-strong' : status === 'paused' ? 'pill-grey' : 'pill-amber'
  return <span className={`pill tight ${tone}`}>{status}</span>
}

export function AgentRows({ agents }: { agents: WorkspaceAgent[] }) {
  if (agents.length === 0) return <div className="sm muted">No agents yet.</div>
  return (
    <>
      {agents.map((a) => (
        <div key={a.role} className="kv">
          <span style={{ color: 'var(--ink)' }}>
            <span className={`run-dot${a.running ? ' on' : ''}`} />
            {roleLabel(a.role)}
          </span>
          <span className="sm muted" style={{ fontWeight: 400 }}>{a.running ? 'running' : 'stopped'}</span>
        </div>
      ))}
    </>
  )
}

export function ShellBlock({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy the command:', cmd)
    }
  }
  return (
    <div className="code">
      <code>$ {cmd}</code>
      <button type="button" className="btn btn-28" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  )
}

export function FilesAndSessions({ ws, max }: { ws: WorkspaceView; max?: number }) {
  const files = max ? ws.files.slice(0, max) : ws.files
  const sessions = max ? ws.sessions.slice(0, max) : ws.sessions
  return (
    <>
      <div className="fact" style={{ gap: 4 }}>
        <div className="sm muted">Files</div>
        {files.length === 0 && <div className="sm muted">None yet.</div>}
        {files.map((f) => (
          <div key={f.path} className="kv sm"><span className="mono" style={{ color: 'var(--ink)' }}>{f.path}</span><span className="muted" style={{ fontWeight: 400 }}>{size(f.size)}</span></div>
        ))}
        {max && ws.files.length > max && <div className="sm muted">+{ws.files.length - max} more</div>}
      </div>
      <div className="fact" style={{ gap: 4 }}>
        <div className="sm muted">Agent sessions</div>
        {sessions.length === 0 && <div className="sm muted">None yet.</div>}
        {sessions.map((s) => (
          <div key={s.id} className="kv sm">
            <a className="mono" href={sessionHref(s.id)} target={OBSERVER ? '_blank' : undefined} rel="noreferrer" onClick={(e) => { if (!OBSERVER) e.preventDefault() }}>{s.id}</a>
            <span className="muted" style={{ fontWeight: 400 }}>{s.role ? roleLabel(s.role) : ''}</span>
          </div>
        ))}
      </div>
    </>
  )
}

interface Props {
  id: string
  c: Case
  /** Poster view: no buttons. */
  readOnly?: boolean
  /** Name used for "Request access as ...". */
  workerName?: string
}

/** Case-level view of the business VM: who can get in, which agents run there, files, sessions, shell. */
export function WorkspaceCard({ id, c, readOnly, workerName = 'Maya R.' }: Props) {
  const w = c.workspace
  const detail = useWorkspace(w?.slug)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const run = async (method: string, ...args: unknown[]) => {
    setBusy(true)
    setErr(null)
    try {
      await callCase(id, method, ...args)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErr(/404|not found/i.test(msg) ? `Bridge does not support ${method} yet.` : msg)
    } finally {
      setBusy(false)
    }
  }

  if (!w) {
    return (
      <div className="card g10">
        <div className="label">WORKSPACE VM</div>
        <div className="muted">No workspace yet.</div>
        {!readOnly && (
          <>
            <button className="btn btn-36" disabled={busy} onClick={() => void run('startBench')}>
              {busy ? 'Starting...' : 'Start bench in a workspace'}
            </button>
            <div className="sm muted">Boots the business VM and launches the policy, billing codes and appeals agents inside it.</div>
          </>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    )
  }

  const status = detail?.status ?? w.status
  const agents = detail?.agents.length ? detail.agents : w.agents
  const granted = w.grantedTo.includes(workerName) || (!!c.worker && w.grantedTo.includes(c.worker.name))
  const anyRunning = agents.some((a) => a.running)

  return (
    <div className="card g10">
      <div className="row between center">
        <div className="label">WORKSPACE VM</div>
        <WorkspaceStatusPill status={status} />
      </div>
      <div className="kv"><span>Slug</span><span className="mono">{w.slug}</span></div>
      <div className="kv"><span>VM id</span><span className="mono">{detail?.vmId || w.vmId}</span></div>
      <div className="kv"><span>Owner</span><span>{w.owner}</span></div>
      <AgentRows agents={agents} />
      <div className="sm">
        <span className="muted">Access: </span>
        {w.grantedTo.length ? `granted to ${w.grantedTo.join(', ')}` : 'owner only'}
      </div>
      {!readOnly && !granted && (
        <button className="btn btn-36 btn-dark" disabled={busy} onClick={() => void run('grantWorkspace', workerName)}>
          {busy ? 'Requesting...' : `Request access as ${workerName}`}
        </button>
      )}
      {!readOnly && !anyRunning && (
        <button className="btn btn-36" disabled={busy} onClick={() => void run('startBench')}>Start bench in this workspace</button>
      )}
      {detail && <FilesAndSessions ws={detail} max={4} />}
      {detail?.ideUrl ? (
        <div className="fact" style={{ gap: 6 }}>
          <a className="btn btn-dark btn-36" href={detail.ideUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'stretch', justifyContent: 'center' }}>Open workstation (VS Code in the VM)</a>
          {detail.idePassword && <div className="sm muted">Password: <span className="mono" style={{ color: 'var(--ink)' }}>{detail.idePassword}</span></div>}
        </div>
      ) : (
        <div className="sm muted">Workstation opens here once the VM finishes provisioning.</div>
      )}
      <details className="sm muted"><summary style={{ cursor: 'pointer' }}>Advanced: shell access</summary><ShellBlock cmd={detail?.shell ?? `superserve shell ${w.slug}`} /></details>
      {detail?.offline && <div className="sm muted">Bridge offline, simulated workspace view.</div>}
      {err && <div className="err">{err}</div>}
    </div>
  )
}
