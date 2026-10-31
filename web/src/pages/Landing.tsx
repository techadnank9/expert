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

type Source = { n: number; name: string; detail: string; year: string; url: string }
const SOURCES: Source[] = [
  { n: 1, name: 'SHRM', detail: 'Recruiting Executives Benchmarking: median time-to-fill, nonexecutive roles, 39 days', year: '2026', url: 'https://www.shrm.org/topics-tools/research/2025-recruiting-benchmarking' },
  { n: 2, name: 'U.S. Bureau of Labor Statistics', detail: 'Occupational Outlook Handbook, medical records specialists: median pay $24.59 per hour (May 2025)', year: '2025', url: 'https://www.bls.gov/ooh/healthcare/medical-records-and-health-information-technicians.htm' },
  { n: 3, name: 'Fiverr Help Center', detail: 'Paying for orders: buyer service fee of 5.5% of the purchase amount', year: '2026', url: 'https://help.fiverr.com/hc/en-us/articles/360050216133-Paying-for-orders-extras-or-custom-offers' },
  { n: 4, name: 'Upwork Help Center', detail: 'Client marketplace fee: up to 7.99% of payments to freelancers on the Basic plan', year: '2025', url: 'https://support.upwork.com/hc/en-us/articles/4660220468499' },
  { n: 5, name: 'KFF', detail: 'Claims Denials and Appeals in ACA Marketplace Plans in 2024: 19% of in-network claims denied, fewer than 1% of denials appealed', year: '2026', url: 'https://www.kff.org/private-insurance/claims-denials-and-appeals-in-aca-marketplace-plans-in-2024/' },
]

function Fn({ n }: { n: number }) {
  return (
    <sup className="lp-fn">
      <a href={`#lp-src-${n}`} aria-label={`Source ${n}`}>{n}</a>
    </sup>
  )
}

type Vs = { k: string; old: string; oldL: string; neu: string; neuL: string; claim: string; ctx: ReactNode }
const VS: Vs[] = [
  {
    k: 'Time to a working expert',
    old: '39 days', oldL: 'to fill a role',
    neu: '~4 min', neuL: 'to a ready workspace',
    claim: 'Start work the same hour.',
    ctx: <>Median time-to-fill for a nonexecutive role is 39 days<Fn n={1} />. Our workspace was provisioned in 3 to 5 minutes, measured in our live demo.</>,
  },
  {
    k: 'Cost per hour',
    old: '$24.59', oldL: 'median, medical records specialist',
    neu: '$15', neuL: 'worker, agents included',
    claim: 'Specialist reading at entry-level pay.',
    ctx: <>BLS median pay<Fn n={2} />. Marketplaces also add a 5.5% to 7.99% fee on each payment<Fn n={3} /><Fn n={4} />. $15 is our listed rate.</>,
  },
  {
    k: 'Denials left on the table',
    old: '<1%', oldL: 'of denied claims appealed',
    neu: '2–4 min', neuL: 'to a cited recommendation',
    claim: 'Every denial gets a reviewed answer.',
    ctx: <>Marketplace insurers denied 19% of in-network claims in 2024; fewer than 1% were appealed<Fn n={5} />. Agent reply time measured in our live demo.</>,
  },
]

function AnnounceBar() {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div className="lp-announce" role="region" aria-label="Announcement">
      <span>
        Built live at Haunted Hacks SF on Terse Durable Actors, Agent Relay and Superserve
        <span className="lp-announce-sep" aria-hidden="true"> · </span>
        <Link to="/how-it-works">See how it works <span className="lp-arrow">→</span></Link>
      </span>
      <button type="button" className="lp-announce-x" aria-label="Dismiss announcement" onClick={() => setOpen(false)}>×</button>
    </div>
  )
}

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

        <AnnounceBar />

        <nav className="lp-nav" aria-label="Main">
          <Link to="/" className="lp-brand">
            <span className="lp-logo">U</span>
            HireXpert
          </Link>
          <div className="lp-nav-links">
            <Link to="/how-it-works">How it works</Link>
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
          <p className="lp-proof lp-intro" style={d(740)}>
            Filling a role takes a median of 39 days<Fn n={1} />. Your workspace is ready in about 4 minutes, measured in our live demo.
          </p>
          <div className="lp-meta lp-intro" style={d(800)}>
            <Link to="/case/4471">See a live case</Link>
          </div>
        </div>

        {/* Product mock */}
      </section>

      {/* ---------- Marquee ---------- */}

      {/* ---------- Old way vs HireXpert ---------- */}
      <section className="lp-section lp-vs-sec" aria-labelledby="lp-vs-h">
        <div className="lp-head" data-reveal>
          <div className="lp-eyebrow">Why it is faster</div>
          <h2 id="lp-vs-h">The usual way, next to ours.</h2>
          <p>Outside numbers are cited. Ours are labelled: measured in our live demo.</p>
        </div>
        <div className="lp-vs">
          {VS.map((v, i) => (
            <article key={v.k} className="lp-vs-card" data-reveal style={d(i * 110)}>
              <div className="lp-card-k">{v.k}</div>
              <div className="lp-vs-nums">
                <div className="lp-vs-old">
                  <small>Old way</small>
                  <span className="lp-vs-n">{v.old}</span>
                  <span className="lp-vs-l">{v.oldL}</span>
                </div>
                <div className="lp-vs-new">
                  <small>HireXpert</small>
                  <span className="lp-vs-n">{v.neu}</span>
                  <span className="lp-vs-l">{v.neuL}</span>
                </div>
              </div>
              <b className="lp-vs-claim">{v.claim}</b>
              <p className="lp-vs-ctx">{v.ctx}</p>
            </article>
          ))}
        </div>
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
        <div className="lp-sources" id="lp-sources">
          <div className="lp-sources-h">Sources</div>
          <ol>
            {SOURCES.map((src) => (
              <li key={src.n} id={`lp-src-${src.n}`}>
                <span className="lp-sources-n">{src.n}.</span>{' '}
                <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a>, {src.year}. {src.detail}.
              </li>
            ))}
          </ol>
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
