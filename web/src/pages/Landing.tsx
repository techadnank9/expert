import { Link } from 'react-router-dom'
import { Header } from '../components/Header'

const BASE = ''

export function Landing() {
  return (
    <div className="page landing">
      <Header subtitle="Expert work, without the credential" right={<nav className="land-nav"><Link to="/board">Find work</Link><Link to="/post">Post a job</Link><Link to="/supervisor">Supervisor</Link></nav>} />

      <section className="land-hero">
        <div className="land-kicker">The $15 an hour expert</div>
        <h1>An ordinary worker plus a bench of specialist agents does work that used to need a credential.</h1>
        <p className="land-sub">
          A clinic posts a denied claim. A worker with judgment claims it. Three specialist agents debate the case on Agent Relay and
          vote on one recommendation. The worker approves. Every step is persisted in a Durable Actor and traceable to the exact agent
          session and document that backed it.
        </p>
        <div className="land-cta">
          <Link className="land-btn primary" to="/post">I need expert work done<span>Post a job as a business</span></Link>
          <Link className="land-btn" to="/board">I want to do expert work<span>Find a job as a worker</span></Link>
        </div>
        <div className="land-meta">
          Live demo case: <Link to="/case/4471">Claim 4471, denied lumbar MRI</Link> · <Link to="/supervisor">Supervisor desk</Link>
        </div>
      </section>

      <section className="land-flow">
        <div className="land-col">
          <div className="label">HUMANS</div>
          <div className="card g10">
            <div className="strong">Worker</div>
            <div className="sm muted">No credential, good judgment. Asks the bench, approves or overrides.</div>
          </div>
          <div className="card g10">
            <div className="strong">Supervisor</div>
            <div className="sm muted">Watches every case live. Alarms escalate to them when a payer goes quiet.</div>
          </div>
          <div className="card g10">
            <div className="strong">Poster</div>
            <div className="sm muted">A clinic or firm. Reviews the deliverable before it goes out. Pay releases on approval.</div>
          </div>
        </div>
        <div className="land-col">
          <div className="label">TERSE DURABLE ACTOR</div>
          <div className="card g10 land-actor">
            <div className="strong">One actor per case</div>
            <div className="sm muted">@Persisted claim, documents, deadlines, decision log. @Emittable state to every screen over WebSocket.</div>
            <div className="sm muted">Alarms: the actor wakes itself. No payer reply in 10 days, escalate.</div>
            <div className="sm muted">Kill the server and the case comes back intact.</div>
          </div>
          <div className="card g10">
            <div className="strong">Board actor</div>
            <div className="sm muted">Open jobs. claim() is one method call, so two workers can never hold the same job.</div>
          </div>
        </div>
        <div className="land-col">
          <div className="label">AGENT RELAY BENCH</div>
          <div className="card g10 land-bench">
            <div className="strong">#case-4471</div>
            <div className="sm muted">One thread per question. Reactions are votes. Every message carries a session_ref to the transcript that produced it.</div>
          </div>
          <div className="land-agents">
            <div className="card g10"><span className="av av-p">P</span><div><div className="strong">Policy agent</div><div className="sm muted">payer policy lookup</div></div></div>
            <div className="card g10"><span className="av av-b">B</span><div><div className="strong">Billing codes agent</div><div className="sm muted">CPT, modifiers, LCDs</div></div></div>
            <div className="card g10"><span className="av av-a">A</span><div><div className="strong">Appeals agent</div><div className="sm muted">drafting, deadlines</div></div></div>
          </div>
        </div>
      </section>

      <section className="land-steps">
        <div className="label">HOW ONE CASE FLOWS</div>
        <ol>
          <li><strong>Post.</strong> The poster describes the outcome and attaches documents. Board.post creates the Case actor and its Relay channel.</li>
          <li><strong>Claim.</strong> A qualified worker claims it from the board. First caller wins.</li>
          <li><strong>Ask the bench.</strong> The worker's question lands in #case-NNNN. Three agents on three machines reply, disagree once, converge.</li>
          <li><strong>Vote.</strong> Appeals posts the recommendation. Thumbs up from each agent is the vote. 3 of 3 agree.</li>
          <li><strong>Approve or override.</strong> The worker decides. The reason lands in the decision log as training signal.</li>
          <li><strong>Deliver.</strong> The poster reviews, approves, pay releases. If the payer goes quiet, the alarm escalates to the supervisor.</li>
        </ol>
      </section>

      <footer className="land-foot">
        Built at Haunted Hacks, San Francisco, October 31 2026 on Terse Durable Actors and Agent Relay. Bench agents run on Codex via OpenAI.
        <span style={{ display: 'none' }}>{BASE}</span>
      </footer>
    </div>
  )
}
