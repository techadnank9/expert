import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { provisionWorkspace, saveWorkspace, savedWorkspace } from '../api'
import { Header } from '../components/Header'
import { AgentRows, FilesAndSessions, ShellBlock, WorkspaceStatusPill, useWorkspace } from '../components/WorkspaceCard'

const DEMO_DOCS = [
  { name: 'Denial letter.pdf', size: '212 KB' },
  { name: 'Clinical notes, PT visits.pdf', size: '1.4 MB' },
  { name: 'EOB.pdf', size: '96 KB' },
]

export function OnboardSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="steps">
      {['1 Onboard', '2 Post', '3 Review'].map((l, i) => (
        <span key={l} className={`pill ${i + 1 === step ? 'pill-dark' : i + 1 < step ? 'pill-green' : 'pill-grey'}`}>{l}</span>
      ))}
    </div>
  )
}

export function Onboard() {
  const [name, setName] = useState('Cedar Street Clinic')
  const [docs, setDocs] = useState(DEMO_DOCS)
  const [slug, setSlug] = useState<string | null>(() => savedWorkspace())
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ws = useWorkspace(slug, 3000)

  useEffect(() => {
    if (ws?.offline) setOffline(true)
  }, [ws?.offline])

  const provision = async () => {
    setBusy(true)
    setErr(null)
    try {
      const rec = await provisionWorkspace(name.trim())
      setOffline(!!rec.offline)
      saveWorkspace(rec.slug)
      setSlug(rec.slug)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const addFile = () => setDocs((d) => [...d, { name: `Untitled document ${d.length - DEMO_DOCS.length + 1}.pdf`, size: 'pending' }])

  return (
    <div className="page">
      <Header subtitle={`${name.trim() || 'New business'}, poster account`} right={<OnboardSteps step={1} />} />
      <div className="main">
        <form
          className="card col-main"
          style={{ padding: 24, gap: 20 }}
          onSubmit={(e) => {
            e.preventDefault()
            void provision()
          }}
        >
          <div className="fact" style={{ gap: 4 }}>
            <div className="h1">Onboard your business</div>
            <div className="muted">You get your own VM. Your documents and your bench agents live there. Workers you hire are granted access to it when they claim a job.</div>
          </div>
          <div className="field">
            <label htmlFor="biz" className="field-label">Business name</label>
            <input id="biz" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <div className="field-label">Documents to load into the workspace</div>
            <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: '#FBFAF7' }}>
              {docs.map((d) => (
                <div key={d.name} className="kv"><span style={{ color: 'var(--ink)' }}>{d.name}</span><span className="sm muted" style={{ fontWeight: 400 }}>{d.size}</span></div>
              ))}
              <button type="button" className="btn btn-36" style={{ alignSelf: 'flex-start', padding: '0 12px' }} onClick={addFile}>Add files</button>
            </div>
          </div>
          <div className="row wrap center">
            <button type="submit" className="btn btn-dark" disabled={busy || !name.trim()}>
              {busy ? 'Provisioning...' : slug ? 'Provision again' : 'Provision my workspace'}
            </button>
            <span className="sm muted">Creates a Superserve sandbox and starts the policy, billing codes and appeals agents inside it.</span>
          </div>
          {err && <div className="err">{err}</div>}
        </form>

        <div className="col col-side">
          {slug ? (
            <div className="card g10">
              <div className="row between center">
                <div className="label">YOUR WORKSPACE</div>
                {ws && <WorkspaceStatusPill status={ws.status} />}
              </div>
              <div className="kv"><span>Slug</span><span className="mono">{slug}</span></div>
              <div className="kv"><span>VM id</span><span className="mono">{ws?.vmId || '...'}</span></div>
              {ws?.owner && <div className="kv"><span>Owner</span><span>{ws.owner}</span></div>}
              {ws && ws.status !== 'ready' && <div className="sm muted">Booting the VM. Checking every 3 seconds.</div>}
              <div className="sm muted">Bench agents</div>
              <AgentRows agents={ws?.agents ?? []} />
              {ws && <FilesAndSessions ws={ws} />}
              <div className="sm muted">Open a shell in the VM</div>
              <ShellBlock cmd={ws?.shell ?? `superserve shell ${slug}`} />
              {offline && <div className="sm muted">Bridge offline, simulated workspace.</div>}
              <Link className="btn btn-40 btn-dark" to={`/post?workspace=${encodeURIComponent(slug)}`}>Next: post a job</Link>
            </div>
          ) : (
            <div className="card">
              <div className="label">WHAT YOU GET</div>
              {[
                'A private VM for your business. Your documents are copied in once.',
                'Three bench agents run inside it and keep their session logs there.',
                'When a worker claims your job, they are granted access to the VM and work there.',
              ].map((t, i) => (
                <div key={i} className="row" style={{ gap: 10 }}><span className="num">{i + 1}</span><span>{t}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
