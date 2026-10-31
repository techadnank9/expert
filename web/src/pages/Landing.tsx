import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import '../landing.css'

/** Delay helper for staggered reveals. */
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

function useReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
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

const MARQUEE = [
  'payer policy lookup',
  'CPT, modifiers, LCDs',
  'appeal drafting',
  'filing deadlines',
  'session_ref provenance',
  '@Persisted case state',
  'alarms that wake the actor',
  'reactions are votes',
  'approve or override',
]

const STEPS: { t: string; b: ReactNode }[] = [
  { t: 'Post', b: <>The poster describes the outcome and attaches documents. <code>Board.post</code> creates the Case actor and its Relay channel.</> },
  { t: 'Claim', b: <>A worker claims it from the board. <code>claim()</code> is one method call, so the first caller wins.</> },
  { t: 'Ask the bench', b: <>The question lands in <code>#case-NNNN</code>. Three agents on three machines reply, disagree once, converge.</> },
  { t: 'Vote', b: <>Appeals posts the recommendation. A thumbs up from each agent is the vote. 3 of 3 agree.</> },
  { t: 'Approve or override', b: <>The worker decides. The reason lands in the decision log as training signal.</> },
  { t: 'Deliver', b: <>The poster reviews and approves, pay releases. If the payer goes quiet, the alarm escalates to the supervisor.</> },
]

export function Landing() {
  const root = useReveal()
  return (
    <div className="lp" ref={root}>
      {/* ---------- Hero ---------- */}
      <section className="lp-hero">
        <div className="lp-aurora" aria-hidden="true">
          <span className="lp-blob b1" />
          <span className="lp-blob b2" />
          <span className="lp-blob b3" />
        </div>

        <nav className="lp-nav" aria-label="Main">
          <Link to="/" className="lp-brand">
            <span className="lp-logo">U</span>
            HireXpert
          </Link>
          <div className="lp-nav-links">
            <Link to="/board">Find work</Link>
            <Link to="/supervisor">Supervisor</Link>
            <Link to="/case/4471">Live demo</Link>
          </div>
          <Link to="/onboard" className="lp-pill lp-pill-sm">Post a job</Link>
        </nav>

        <div className="lp-hero-inner">
          <div className="lp-kicker lp-intro" style={d(120)}>
            <span className="lp-dot" /> The $15 an hour expert, live on Terse + Agent Relay
          </div>
          <h1 className="lp-title lp-intro" style={d(300)}>
            Any worker can now <Rotating words={['appeal', 'dispute', 'reconcile', 'win']} />
          </h1>
          <p className="lp-sub lp-intro" style={d(480)}>
            Post the job. A worker with good judgment claims it. Three specialist agents read the documents, argue it out,
            and vote on one recommendation. The worker decides, and every step is on the record.
          </p>
          <div className="lp-ctas lp-intro" style={d(660)}>
            <Link to="/onboard" className="lp-pill">
              Onboard your business <span className="lp-arrow">→</span>
            </Link>
            <Link to="/board" className="lp-pill lp-pill-ghost">
              Find work <span className="lp-arrow">→</span>
            </Link>
          </div>
          <div className="lp-meta lp-intro" style={d(800)}>
            Watch it live: <Link to="/case/4471">Claim 4471, denied lumbar MRI</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/supervisor">Supervisor desk</Link>
          </div>
        </div>

        {/* Product mock */}
      </section>

      {/* ---------- Marquee ---------- */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="lp-chip">{m}</span>
          ))}
        </div>
      </div>

      {/* ---------- Stats ---------- */}
      <section className="lp-stats">
        {[
          ['3 of 3', 'agents agree before a recommendation ships'],
          ['Every', 'decision traceable to the agent session behind it'],
          ['Kill -9', 'the server. The case comes back intact.'],
          ['1 actor', 'per case, with alarms that wake it up'],
        ].map(([n, l], i) => (
          <div key={n} className="lp-stat" data-reveal style={d(i * 90)}>
            <div className="lp-stat-n">{n}</div>
            <div className="lp-stat-l">{l}</div>
          </div>
        ))}
      </section>

      {/* ---------- Three columns ---------- */}
      <section className="lp-section">
        <div className="lp-head" data-reveal>
          <div className="lp-eyebrow">Under the hood</div>
          <h2>Three layers, one case.</h2>
          <p>People make the calls, a durable actor remembers everything, and a bench of agents does the specialist reading.</p>
        </div>

        <div className="lp-cols">
          <article className="lp-card" data-reveal style={d(0)}>
            <div className="lp-card-k">Humans</div>
            <h3>Judgment stays with people.</h3>
            <ul className="lp-list">
              <li><b>Worker.</b> No credential, good judgment. Asks the bench, approves or overrides.</li>
              <li><b>Supervisor.</b> Watches every case live. Alarms escalate to them when a payer goes quiet.</li>
              <li><b>Poster.</b> A clinic or firm. Reviews the deliverable; pay releases on approval.</li>
            </ul>
          </article>

          <article className="lp-card lp-card-dark" data-reveal style={d(120)}>
            <div className="lp-card-k">Terse Durable Actor</div>
            <h3>One actor per case.</h3>
            <ul className="lp-list">
              <li><code>@Persisted</code> claim, documents, deadlines and decision log.</li>
              <li><code>@Emittable</code> state streams to every screen over WebSocket.</li>
              <li>Alarms: the actor wakes itself. No payer reply in 10 days, escalate.</li>
              <li>Kill the server and the case comes back intact.</li>
            </ul>
          </article>

          <article className="lp-card lp-card-blue" data-reveal style={d(240)}>
            <div className="lp-card-k">Agent Relay bench</div>
            <h3><code>#case-4471</code></h3>
            <p className="lp-card-p">One thread per question. Reactions are votes. Every message carries a <code>session_ref</code> to the transcript that produced it.</p>
            <div className="lp-agents">
              <div className="lp-agent"><span className="lp-av av-p">P</span><div><b>Policy agent</b><small>payer policy lookup</small></div></div>
              <div className="lp-agent"><span className="lp-av av-b">B</span><div><b>Billing codes agent</b><small>CPT, modifiers, LCDs</small></div></div>
              <div className="lp-agent"><span className="lp-av av-a">A</span><div><b>Appeals agent</b><small>drafting, deadlines</small></div></div>
            </div>
          </article>
        </div>
      </section>

      {/* ---------- Steps ---------- */}
      <section className="lp-section lp-steps-sec">
        <div className="lp-head" data-reveal>
          <div className="lp-eyebrow">How one case flows</div>
          <h2>From posted to paid in six moves.</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.t} className="lp-step" data-reveal style={d((i % 3) * 110)}>
              <span className="lp-step-n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{s.t}</h3>
              <p>{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Closing CTA + footer ---------- */}
      <section className="lp-final">
        <div className="lp-aurora soft" aria-hidden="true">
          <span className="lp-blob b1" />
          <span className="lp-blob b2" />
        </div>
        <div className="lp-final-inner" data-reveal>
          <h2>
            Put the <span className="lp-accent">bench</span> to work.
          </h2>
          <p>Businesses post the outcome they need. Workers bring the judgment. The agents bring the specialist reading.</p>
          <div className="lp-ctas">
            <Link to="/post" className="lp-pill">Post a job <span className="lp-arrow">→</span></Link>
            <Link to="/board" className="lp-pill lp-pill-ghost">Find work <span className="lp-arrow">→</span></Link>
          </div>
        </div>
        <footer className="lp-foot">
          <div className="lp-brand">
            <span className="lp-logo">U</span>
            HireXpert
          </div>
          <p>
            Built at Haunted Hacks, San Francisco, October 31 2026, on Terse Durable Actors and Agent Relay. Bench agents run on
            Codex via OpenAI.
          </p>
          <div className="lp-foot-links">
            <Link to="/case/4471">Demo case</Link>
            <Link to="/supervisor">Supervisor</Link>
            <Link to="/board">Board</Link>
          </div>
        </footer>
      </section>
    </div>
  )
}


function Rotating({ words }: { words: string[] }) {
  const [i, setI] = useState(0)
  const [out, setOut] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      setOut(true)
      setTimeout(() => { setI((n) => (n + 1) % words.length); setOut(false) }, 420)
    }, 2600)
    return () => clearInterval(t)
  }, [words.length])
  return (
    <span className="lp-rotate" aria-live="polite">
      <span key={i} className={`lp-script lp-accent ${out ? 'is-out' : 'is-in'}`}>{words[i]}</span>
    </span>
  )
}
