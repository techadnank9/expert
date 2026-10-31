import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import '../howitworks.css'

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

function useReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-hw-reveal]'))
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || typeof IntersectionObserver === 'undefined') {
      items.forEach((i) => i.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    items.forEach((i) => io.observe(i))
    return () => io.disconnect()
  }, [])
  return root
}

type Step = { t: string; who: string; tone: 'blue' | 'purple' | 'green' | 'amber' | 'ink'; b: ReactNode }
const FLOW: Step[] = [
  {
    t: 'The business onboards',
    who: 'Business · /onboard',
    tone: 'ink',
    b: <>The bridge provisions a Superserve VM for that business. It installs Codex CLI, the Agent Relay MCP server and code-server (VS Code in the browser), and copies the business documents in. The agents and their session logs live there from now on.</>,
  },
  {
    t: 'A job is posted',
    who: 'Board actor · Terse',
    tone: 'blue',
    b: <>The Board actor creates a Case actor and opens a Relay channel <code>#case-&lt;id&gt;</code> with an inbound webhook for the bridge.</>,
  },
  {
    t: 'A worker claims it',
    who: 'Worker · /board',
    tone: 'blue',
    b: <>The claim is atomic: first caller wins. The worker is granted access to the business VM and opens VS Code in the browser.</>,
  },
  {
    t: 'The worker does the work',
    who: 'Worker · Business VM',
    tone: 'purple',
    b: <>The worker drafts the deliverable in the workspace and submits it for verification. Three Codex agents inside the VM (policy, billing codes, appeals) read it against the documents.</>,
  },
  {
    t: 'Agents verify with sources',
    who: 'Agent Relay thread',
    tone: 'purple',
    b: <>Each agent replies VERIFIED or FIX NEEDED in one thread, with citations and a <code>session_ref</code>. The appeals agent posts the <strong>verdict</strong>.</>,
  },
  {
    t: 'Agents vote',
    who: 'Relay reactions',
    tone: 'green',
    b: <>Thumbs-up reactions on the verdict are the votes. 3 of 3 means the work is verified.</>,
  },
  {
    t: 'The worker decides',
    who: 'Worker · case actor',
    tone: 'green',
    b: <>The worker fixes what was flagged and resubmits, or accepts the verdict and sends the work to the business. Either way it is written to the decision log in the Case actor.</>,
  },
  {
    t: 'The business reviews and pays',
    who: 'Business · review',
    tone: 'ink',
    b: <>The business reads the verified work with its sources and pays. If a deadline slips, Terse alarms nudge and then escalate to the Supervisor view.</>,
  },
]

type Sponsor = { name: string; role: string; tone: string; items: string[] }
const SPONSORS: Sponsor[] = [
  {
    name: 'Terse Durable Actors',
    role: 'State and time',
    tone: 'blue',
    items: [
      'One Business actor per onboarded business (workspace, uploads, access), the Board actor, and one Case actor per job',
      '@Persisted / @Emittable state streamed over WebSocket',
      'Alarms that nudge, then escalate on deadlines',
      'Hosted deploy; state survives kill and restart',
    ],
  },
  {
    name: 'Agent Relay',
    role: 'Where agents and people talk',
    tone: 'purple',
    items: [
      'One workspace, one channel per case',
      'Threads, with reactions as votes',
      'Inbound webhooks into the bridge',
      'Observer link for read-only viewing',
      'session_ref provenance on every agent reply',
      'MCP server inside each business VM',
    ],
  },
  {
    name: 'Superserve',
    role: 'The business workstation',
    tone: 'green',
    items: [
      'One VM per business',
      'code-server workstation on a preview URL',
      'Agents, documents and session logs inside',
      'Also hosts the Bun bridge',
    ],
  },
  {
    name: 'OpenAI',
    role: 'The agents',
    tone: 'amber',
    items: [
      'gpt-5 family through Codex CLI',
      'Three agents: policy, billing codes, appeals',
      'Run inside the VM, next to the documents',
    ],
  },
]

const SAFE: { t: string; b: string; tone: string }[] = [
  { t: 'Provenance', tone: 'blue', b: 'Every agent reply cites the business documents and carries a session_ref you can trace back to the session log on the VM.' },
  { t: 'Votes', tone: 'purple', b: 'Three agents with different jobs must agree. Their thumbs-up reactions are counted; anything short of 3 of 3 is visible.' },
  { t: 'Human approval', tone: 'green', b: 'Nothing is final until the worker approves or overrides, and the business reviews before paying.' },
  { t: 'Durable decision log', tone: 'amber', b: 'Business records, decisions, alarms and approvals live in Terse actors (Business, Board, Case), so the record survives restarts and is mirrored into the channel.' },
]

function Diagram() {
  return (
    <svg className="hw-svg" viewBox="0 0 1000 560" role="img" aria-labelledby="hw-diag-t hw-diag-d">
      <title id="hw-diag-t">HireXpert architecture</title>
      <desc id="hw-diag-d">
        Browsers for business, worker and supervisor talk to the web app on Vercel, which talks to the Bun bridge on
        Superserve. The bridge drives Terse Business, Board and Case actors, and exchanges messages with the Agent Relay case
        channel, which connects to Codex agents in the business VM on Superserve.
      </desc>
      <defs>
        <marker id="hw-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#0a0a0a" />
        </marker>
        <marker id="hw-ah-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#0569ff" />
        </marker>
      </defs>

      {/* edges, top row */}
      <path className="hw-edge" d="M222 105 H274" markerEnd="url(#hw-ah)" />
      <path className="hw-edge" d="M472 105 H524" markerEnd="url(#hw-ah)" />
      <path className="hw-edge" d="M722 105 H774" markerStart="url(#hw-ah)" markerEnd="url(#hw-ah)" />
      <text className="hw-elabel" x="748" y="92" textAnchor="middle">WS</text>
      {/* bridge <-> relay */}
      <path className="hw-edge hw-edge-b" d="M623 172 V296" markerStart="url(#hw-ah-b)" markerEnd="url(#hw-ah-b)" />
      <text className="hw-elabel" x="634" y="228">webhook in</text>
      <text className="hw-elabel" x="634" y="246">events out</text>
      {/* relay <-> vm */}
      <path className="hw-edge hw-edge-b" d="M722 370 H774" markerStart="url(#hw-ah-b)" markerEnd="url(#hw-ah-b)" />
      <text className="hw-elabel" x="748" y="357" textAnchor="middle">MCP</text>
      {/* bridge -> vm provisioning */}
      <path className="hw-edge hw-edge-dash" d="M700 172 C 760 210, 860 220, 878 296" markerEnd="url(#hw-ah)" />
      <text className="hw-elabel" x="868" y="218">provision</text>
      {/* browser -> vm VS Code */}
      <path className="hw-edge hw-edge-dash" d="M122 172 V510 H874 V496" markerEnd="url(#hw-ah)" />
      <text className="hw-elabel" x="140" y="500">worker opens VS Code in the browser (preview URL)</text>

      {/* Browser */}
      <g>
        <rect className="hw-box" x="22" y="38" width="200" height="134" rx="18" />
        <text className="hw-bt" x="42" y="72">Browser</text>
        <text className="hw-bs" x="42" y="98">business</text>
        <text className="hw-bs" x="42" y="120">worker</text>
        <text className="hw-bs" x="42" y="142">supervisor</text>
      </g>
      {/* Vercel */}
      <g>
        <rect className="hw-box" x="274" y="38" width="198" height="134" rx="18" />
        <text className="hw-bt" x="294" y="72">Web</text>
        <text className="hw-bs" x="294" y="98">React on Vercel</text>
        <text className="hw-bs" x="294" y="120">/onboard · /board</text>
        <text className="hw-bs" x="294" y="142">/case · /supervisor</text>
      </g>
      {/* Bridge */}
      <g>
        <rect className="hw-box hw-box-ink" x="524" y="38" width="198" height="134" rx="18" />
        <text className="hw-bt hw-on-ink" x="544" y="72">Bridge</text>
        <text className="hw-bs hw-on-ink-2" x="544" y="98">Bun on Superserve</text>
        <text className="hw-bs hw-on-ink-2" x="544" y="120">mirrors Relay → actor</text>
        <text className="hw-bs hw-on-ink-2" x="544" y="142">posts actor events</text>
      </g>
      {/* Terse */}
      <g>
        <rect className="hw-box hw-box-blue" x="776" y="38" width="204" height="134" rx="18" />
        <text className="hw-bt" x="796" y="72">Terse actors</text>
        <rect className="hw-chip" x="796" y="88" width="76" height="26" rx="13" />
        <text className="hw-chipt" x="834" y="105" textAnchor="middle">Board</text>
        <rect className="hw-chip" x="880" y="88" width="80" height="26" rx="13" />
        <text className="hw-chipt" x="920" y="105" textAnchor="middle">Case</text>
        <text className="hw-bs" x="796" y="146">state · alarms</text>
      </g>
      {/* Relay */}
      <g>
        <rect className="hw-box hw-box-purple" x="524" y="298" width="198" height="150" rx="18" />
        <text className="hw-bt" x="544" y="332">Agent Relay</text>
        <text className="hw-mono" x="544" y="358">#case-NNNN</text>
        <text className="hw-bs" x="544" y="384">thread · citations</text>
        <text className="hw-bs" x="544" y="406">thumbs-up votes · 3 of 3</text>
        <text className="hw-bs" x="544" y="428">observer link</text>
      </g>
      {/* VM */}
      <g>
        <rect className="hw-box hw-box-green" x="776" y="298" width="204" height="198" rx="18" />
        <text className="hw-bt" x="796" y="332">Business VM</text>
        <text className="hw-bs" x="796" y="352">Superserve</text>
        <rect className="hw-chip hw-chip-w" x="796" y="366" width="164" height="26" rx="13" />
        <text className="hw-chipt" x="878" y="383" textAnchor="middle">Codex agents × 3</text>
        <rect className="hw-chip hw-chip-w" x="796" y="400" width="164" height="26" rx="13" />
        <text className="hw-chipt" x="878" y="417" textAnchor="middle">documents · logs</text>
        <rect className="hw-chip hw-chip-w" x="796" y="434" width="164" height="26" rx="13" />
        <text className="hw-chipt" x="878" y="451" textAnchor="middle">VS Code (code-server)</text>
      </g>
      {/* legend */}
      <g className="hw-legend">
        <line className="hw-edge" x1="270" y1="320" x2="306" y2="320" />
        <text className="hw-elabel" x="316" y="324">request / state</text>
        <line className="hw-edge hw-edge-b" x1="270" y1="346" x2="306" y2="346" />
        <text className="hw-elabel" x="316" y="350">messages</text>
        <line className="hw-edge hw-edge-dash" x1="270" y1="372" x2="306" y2="372" />
        <text className="hw-elabel" x="316" y="376">setup / access</text>
      </g>
    </svg>
  )
}

export function HowItWorks() {
  const root = useReveal()
  return (
    <div className="hw" ref={root}>
      <header className="hw-top">
        <nav className="hw-nav" aria-label="Main">
          <Link to="/" className="hw-brand">
            <span className="hw-logo" aria-hidden>H</span>
            HireXpert
          </Link>
          <div className="hw-nav-links">
            <Link to="/board">Board</Link>
            <Link to="/onboard">Onboard</Link>
          </div>
        </nav>
      </header>

      <section className="hw-hero">
        <span className="hw-kicker hw-intro" style={d(0)}>Architecture</span>
        <h1 className="hw-title hw-intro" style={d(80)}>How HireXpert works</h1>
        <p className="hw-sub hw-intro" style={d(160)}>
          A hired worker does each job inside the business's own machine, three AI agents verify the work, and every step
          is kept in a durable record.
        </p>
      </section>

      <section className="hw-section" aria-labelledby="hw-arch">
        <div className="hw-head" data-hw-reveal>
          <span className="hw-eyebrow">The pieces</span>
          <h2 id="hw-arch" className="hw-h2">One request, end to end</h2>
        </div>
        <div className="hw-diagram" data-hw-reveal>
          <div className="hw-diagram-scroll">
            <Diagram />
          </div>
        </div>
      </section>

      <section className="hw-section" aria-labelledby="hw-flow">
        <div className="hw-head" data-hw-reveal>
          <span className="hw-eyebrow">Step by step</span>
          <h2 id="hw-flow" className="hw-h2">The flow of one job</h2>
        </div>
        <ol className="hw-timeline">
          {FLOW.map((s, i) => (
            <li key={s.t} className="hw-tl-item" data-hw-reveal style={d((i % 2) * 60)}>
              <span className={`hw-tl-dot tone-${s.tone}`}>{i + 1}</span>
              <div className="hw-tl-card">
                <span className="hw-tl-who">{s.who}</span>
                <h3 className="hw-tl-t">{s.t}</h3>
                <p className="hw-tl-b">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="hw-section" aria-labelledby="hw-sp">
        <div className="hw-head" data-hw-reveal>
          <span className="hw-eyebrow">Built with</span>
          <h2 id="hw-sp" className="hw-h2">What each sponsor does</h2>
        </div>
        <div className="hw-grid">
          {SPONSORS.map((s, i) => (
            <article key={s.name} className={`hw-card tone-${s.tone}`} data-hw-reveal style={d(i * 70)}>
              <span className="hw-card-bar" aria-hidden />
              <span className="hw-card-role">{s.role}</span>
              <h3 className="hw-card-t">{s.name}</h3>
              <ul className="hw-list">
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="hw-section" aria-labelledby="hw-safe">
        <div className="hw-head" data-hw-reveal>
          <span className="hw-eyebrow">Trust</span>
          <h2 id="hw-safe" className="hw-h2">Why it is safe to let non-experts do expert work</h2>
        </div>
        <div className="hw-grid">
          {SAFE.map((s, i) => (
            <article key={s.t} className={`hw-safe tone-${s.tone}`} data-hw-reveal style={d(i * 70)}>
              <span className="hw-safe-n">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="hw-card-t">{s.t}</h3>
              <p className="hw-safe-b">{s.b}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="hw-section hw-cta-wrap">
        <div className="hw-cta" data-hw-reveal>
          <div>
            <h2 className="hw-cta-t">See it run</h2>
            <p className="hw-cta-s">Set up a business, or pick up a job from the board.</p>
          </div>
          <div className="hw-ctas">
            <Link to="/onboard" className="hw-pill">
              Onboard a business <span className="hw-arrow">→</span>
            </Link>
            <Link to="/board" className="hw-pill hw-pill-ghost">
              Open the board
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
