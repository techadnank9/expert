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


const STEPS: { t: string; b: ReactNode }[] = [
  { t: 'Onboard', b: <>Create your account and upload your files.</> },
  { t: 'Create your digital workspace', b: <>Your own private machine in the cloud, open in the browser, with your documents and specialist help ready.</> },
  { t: 'Hire workers', b: <>Post a job. The worker you hire comes on board into that same workspace and does the work.</> },
]

type Cat = { label: string; slug: string; items: string[] }
const CATS: Cat[] = [
  { label: 'Medical billing', slug: 'medical-billing', items: ['Denied claim appeals', 'Prior authorization', 'Coding and modifiers', 'Timely filing', 'Coordination of benefits', 'Credentialing'] },
  { label: 'Insurance claims', slug: 'insurance-claims', items: ['Property damage disputes', 'Auto claims', 'Adjuster estimate review', 'Total loss valuation'] },
  { label: 'Benefits', slug: 'benefits', items: ['FMLA and disability', 'COBRA elections', 'Open enrollment', 'Dependent eligibility'] },
  { label: 'Immigration paperwork', slug: 'immigration', items: ['H-1B extensions', 'Green card RFEs', 'Work permit renewals', 'Visa interview prep'] },
  { label: 'Tax', slug: 'tax', items: ['Notice responses', 'Amended returns', 'Payment plans', '1099 reconciliation'] },
]

function CategoryBar() {
  const [open, setOpen] = useState<string | null>(null)
  const triggers = useRef<Record<string, HTMLAnchorElement | null>>({})
  return (
    <div className="lp-cats" aria-label="Browse by category" role="navigation" onMouseLeave={() => setOpen(null)}>
      {CATS.map((c) => {
        const isOpen = open === c.slug
        const half = Math.ceil(c.items.length / 2)
        const cols = [c.items.slice(0, half), c.items.slice(half)]
        const href = `/post?domain=${c.slug}`
        return (
          <div
            key={c.slug}
            className={`lp-cat${isOpen ? ' is-open' : ''}`}
            onMouseEnter={() => setOpen(c.slug)}
            onFocus={() => setOpen(c.slug)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen((o) => (o === c.slug ? null : o))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && isOpen) {
                setOpen(null)
                triggers.current[c.slug]?.focus()
                // keep closed after refocusing the trigger
                setTimeout(() => setOpen(null), 0)
              }
            }}
          >
            <Link
              to={href}
              ref={(el) => { triggers.current[c.slug] = el }}
              className="lp-cat-trigger"
              aria-expanded={isOpen}
              aria-controls={`lp-mega-${c.slug}`}
            >
              {c.label}
              <span className="lp-cat-caret" aria-hidden="true" />
            </Link>
            <div className="lp-mega" id={`lp-mega-${c.slug}`} aria-hidden={!isOpen}>
              <div className="lp-mega-panel">
                {cols.map((col, ci) => (
                  <div key={ci} className="lp-mega-col">
                    <div className="lp-mega-h">{ci === 0 ? c.label : 'More in ' + c.label.toLowerCase()}</div>
                    <ul>
                      {col.map((it) => (
                        <li key={it}>
                          <Link to={href} tabIndex={isOpen ? 0 : -1}>{it}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="lp-mega-aside">
                  <div className="lp-mega-h">Post a {c.label.toLowerCase()} job</div>
                  <p>Three specialist agents read your documents. A worker with judgment makes the call.</p>
                  <Link to={href} className="lp-mega-cta" tabIndex={isOpen ? 0 : -1}>Post a job <span className="lp-arrow">→</span></Link>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

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

        <CategoryBar />

        <div className="lp-hero-inner">
          <div className="lp-kicker lp-intro" style={d(120)}>
            <span className="lp-dot" /> The $15 an hour expert
          </div>
          <h1 className="lp-title lp-intro" style={d(300)}>
            Your business, with a <Rotating words={['digital workspace', 'team', 'memory', 'head start']} />
          </h1>
          <p className="lp-sub lp-intro" style={d(480)}>
            Onboard once. You get a private digital workspace with your documents in it. Hire workers, and they walk into
            that workspace and start, with specialist help already set up.
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
            <Link to="/case/4471">See a live case</Link>
          </div>
        </div>

        {/* Product mock */}
      </section>

      {/* ---------- Marquee ---------- */}

      {/* ---------- Stats ---------- */}
      <section className="lp-stats">
        {[
          ['1', 'private workspace per business, open in the browser'],
          ['3', 'specialists read your documents on every job'],
          ['Every', 'decision on the record, with who made it and why'],
          ['0', 'files leave your workspace'],
        ].map(([n, l], i) => (
          <div key={n} className="lp-stat" data-reveal style={d(i * 90)}>
            <div className="lp-stat-n">{n}</div>
            <div className="lp-stat-l">{l}</div>
          </div>
        ))}
      </section>

      {/* ---------- Under the hood ---------- */}
      <section className="lp-section">
        <div className="lp-head" data-reveal>
          <div className="lp-eyebrow">Under the hood</div>
          <h2>What's working for you under the hood.</h2>
          <p>Every job keeps its own record, your agents talk in one room, and everything lives on a machine that belongs to you.</p>
        </div>

        <div className="lp-cols">
          <article className="lp-card lp-card-dark" data-reveal style={d(0)}>
            <div className="lp-card-k">Case file</div>
            <h3>A case file that never forgets.</h3>
            <ul className="lp-list">
              <li>Every job is a living record: documents, deadlines and the decision log.</li>
              <li>It wakes itself on deadlines. No reply from the payer in ten days, it escalates.</li>
              <li>It survives any crash or restart. Nothing is lost.</li>
            </ul>
            <div className="lp-powered">Powered by Terse Durable Actors</div>
          </article>

          <article className="lp-card lp-card-blue" data-reveal style={d(120)}>
            <div className="lp-card-k">Agents</div>
            <h3>Your agents in one room.</h3>
            <p className="lp-card-p">The three specialists discuss each job in a shared channel. Every message links back to the exact agent session that wrote it, so you can audit any recommendation.</p>
            <div className="lp-agents">
              <div className="lp-agent"><span className="lp-av av-p">P</span><div><b>Policy agent</b><small>payer policy lookup</small></div></div>
              <div className="lp-agent"><span className="lp-av av-b">B</span><div><b>Billing codes agent</b><small>CPT, modifiers, LCDs</small></div></div>
              <div className="lp-agent"><span className="lp-av av-a">A</span><div><b>Appeals agent</b><small>drafting, deadlines</small></div></div>
            </div>
            <div className="lp-powered">Powered by Agent Relay</div>
          </article>

          <article className="lp-card" data-reveal style={d(240)}>
            <div className="lp-card-k">Your machine</div>
            <h3>Your own machine in the cloud.</h3>
            <ul className="lp-list">
              <li>Documents, agents and session logs live on a private machine per business.</li>
              <li>The people you hire log into that machine, with VS Code right in the browser.</li>
              <li>Nothing leaves it.</li>
            </ul>
            <div className="lp-powered">Powered by Superserve</div>
          </article>
        </div>
      </section>

      {/* ---------- Steps ---------- */}
      <section className="lp-section lp-steps-sec">
        <div className="lp-head" data-reveal>
          <div className="lp-eyebrow">Getting started</div>
          <h2>Three easy steps.</h2>
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
        <p className="lp-steps-close" data-reveal>
          Behind the scenes, specialist agents read your documents and give the worker a recommendation to approve. Every decision is on the record.
        </p>
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
            HireXpert. Built at Haunted Hacks, San Francisco, October 31 2026. Cases live in Terse Durable Actors, the bench talks over Agent Relay,
            each business gets its own Superserve VM, and the agents run on Codex.
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
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      setOut(true)
      setTimeout(() => { setI((n) => (n + 1) % words.length); setOut(false); setMoved(true) }, 420)
    }, 2600)
    return () => clearInterval(t)
  }, [words.length])
  return (
    <span className="lp-rotate lp-rotate-line" aria-live="polite">
      <span key={i} className={`lp-script lp-accent ${out ? 'is-out' : moved ? 'is-in' : ''}`}>{words[i]}</span>
    </span>
  )
}
