import type { Board, Case } from './types'

// Offline fixtures. Facts copied from mockups/ (Worker, Supervisor, Find1, Post1-3).
// Times are local wall-clock ISO (no Z) so the demo reads "12:41" wherever it runs.

const TODAY = '2026-10-31'
const t = (hhmm: string) => `${TODAY}T${hhmm}:00`

export const CASE_IDS = ['4471', '4398'] as const

export function makeCase4471(): Case {
  return {
    id: '4471',
    title: 'Appeal denied lumbar MRI, CPT 72148',
    domain: 'medical-billing',
    status: 'recommended',
    poster: { name: 'Cedar Street Clinic' },
    worker: { name: 'Maya Chen' },
    facts: {
      payer: 'Harborline Health',
      amount: 1840,
      denialCode: 'CO-50',
      dateOfService: '2026-10-02',
      reason: 'Medical necessity not established for advanced imaging.',
    },
    documents: [
      { name: 'Denial letter.pdf', pages: 2, source: 'poster' },
      { name: 'Clinical notes, PT visits.pdf', pages: 6, source: 'poster' },
      { name: 'EOB.pdf', pages: 1, source: 'poster' },
      { name: 'Plan policy CG-0423.pdf', pages: 14, source: 'policy' },
    ],
    deadline: '2026-11-14T17:00:00',
    alarms: [
      { id: 'al_4471_nudge', at: '2026-11-10T09:00:00', kind: 'nudge', fired: false },
      { id: 'al_4471_escalate', at: '2026-11-12T09:00:00', kind: 'escalate', fired: false },
    ],
    relay: { channel: 'case-4471', threadRootId: 'm_8f21', recommendationId: 'm_8f27' },
    thread: [
      {
        id: 'm_8f1c',
        author: 'case-actor',
        address: 'inbound webhook',
        text: 'Case opened. 3 documents attached. Deadline Nov 14. Alarms: nudge Nov 10, escalate Nov 12.',
        at: t('12:39'),
        reactions: {},
      },
      {
        id: 'm_8f21',
        author: 'maya',
        text: 'Can we appeal this denial? What do we need to make it stick?',
        at: t('12:40'),
        reactions: {},
      },
      {
        id: 'm_8f22',
        author: 'policy',
        address: 'policy@sam-macbook',
        sessionRef: 'ses_policy_7Kq2a1',
        text: 'Plan policy CG-0423 section 4.2 covers lumbar MRI when 6 weeks of conservative therapy are documented. The PT notes show 8 weeks, Aug 4 to Sep 29. Necessity is supportable.',
        at: t('12:41'),
        reactions: {},
      },
      {
        id: 'm_8f23',
        author: 'billing',
        address: 'billing@priya-thinkpad',
        sessionRef: 'ses_billing_3Hd9x4',
        text: 'I would try a corrected claim first: resubmit 72148 with the radiculopathy diagnosis (M54.16) as primary. Faster than an appeal if the payer just missed the indication.',
        at: t('12:41'),
        reactions: {},
      },
      {
        id: 'm_8f24',
        author: 'appeals',
        address: 'appeals@adnan-mbp',
        sessionRef: 'ses_appeals_9Wm4c7',
        text: 'Disagree with a resubmit. Denial letter p.1 already lists M54.16, so a corrected claim will deny again as a duplicate and burns 10 days. CO-50 is a necessity denial; it needs an appeal.',
        at: t('12:42'),
        reactions: {},
      },
      {
        id: 'm_8f25',
        author: 'billing',
        address: 'billing@priya-thinkpad',
        sessionRef: 'ses_billing_3Hd9x4',
        text: 'Confirmed on the denial letter, the diagnosis was there. 72148 was billed clean and no modifier is required, so this is not a coding fix. Withdrawn, I agree with an appeal.',
        at: t('12:42'),
        reactions: {},
      },
      {
        id: 'm_8f26',
        author: 'appeals',
        address: 'appeals@adnan-mbp',
        sessionRef: 'ses_appeals_9Wm4c7',
        text: "Level 1 appeal, cite CG-0423 section 4.2, attach the PT dates and the ordering physician's note. Harborline turns these around in 10 business days, so I would set a nudge for Nov 10.",
        at: t('12:42'),
        reactions: {},
      },
      {
        id: 'm_8f27',
        author: 'policy',
        address: 'policy@sam-macbook',
        sessionRef: 'ses_policy_7Kq2a1',
        text: 'Consensus. Calling post_recommendation on the case.',
        at: t('12:42'),
        reactions: { ':+1:': ['policy', 'billing', 'appeals'] },
      },
    ],
    recommendation: {
      summary: 'File a level 1 appeal',
      steps: [
        'Cite plan policy CG-0423, section 4.2 (conservative therapy threshold)',
        'Attach PT visit log, Aug 4 to Sep 29, 8 weeks',
        'Attach ordering physician note dated Sep 30',
        'Schedule alarm: nudge Nov 10, escalate Nov 12',
      ],
      sources: [
        'Plan policy CG-0423.pdf, section 4.2',
        'Clinical notes, PT visits.pdf, p.3',
        'Denial letter.pdf, p.1',
      ],
      agrees: ['policy', 'billing', 'appeals'],
    },
    decisionLog: [
      { at: '2026-10-29T16:12:00', actor: 'intake', event: 'Case created from denial letter' },
      { at: '2026-10-29T16:14:00', actor: 'Maya Chen', event: 'Documents ingested, 3 files' },
      { at: t('12:02'), actor: 'Maya Chen', event: 'Job claimed' },
      { at: t('12:40'), actor: 'policy', event: 'Policy agent pulled CG-0423' },
      { at: t('12:40'), actor: 'Maya Chen', event: 'Question sent to bench' },
      { at: t('12:42'), actor: 'bench', event: 'Bench recommendation posted' },
    ],
    pay: { amount: 45, released: false },
    workspace: null,
  }
}

export function makeCase4398(): Case {
  return {
    id: '4398',
    title: 'Denied PT units, CPT 97110',
    domain: 'medical-billing',
    status: 'claimed',
    poster: { name: 'Northgate Family Practice' },
    worker: { name: 'Jon T.' },
    facts: {
      payer: 'Harborline Health',
      amount: 620,
      denialCode: 'CO-151',
      dateOfService: '2026-09-18',
      reason: 'Units billed exceed the frequency allowed for this service.',
    },
    documents: [
      { name: 'Denial letter.pdf', pages: 1, source: 'poster' },
      { name: 'PT plan of care.pdf', pages: 4, source: 'poster' },
      { name: 'Level 1 appeal, filed.pdf', pages: 3, source: 'worker' },
    ],
    deadline: '2026-11-20T17:00:00',
    // Seeded 60 seconds into the future so the Supervisor screen can show it fire live.
    alarms: [
      { id: 'al_4398_escalate', at: new Date(Date.now() + 60_000).toISOString(), kind: 'escalate', fired: false },
    ],
    relay: { channel: 'case-4398', threadRootId: 'm_7a02' },
    thread: [
      {
        id: 'm_7a01',
        author: 'case-actor',
        address: 'inbound webhook',
        text: 'Case opened. 2 documents attached. Deadline Nov 20.',
        at: '2026-10-14T10:05:00',
        reactions: {},
      },
      {
        id: 'm_7a02',
        author: 'jon',
        text: 'Payer capped 97110 at 2 units. Plan of care says 4. Appeal or rebill?',
        at: '2026-10-14T10:20:00',
        reactions: {},
      },
      {
        id: 'm_7a03',
        author: 'appeals',
        address: 'appeals@adnan-mbp',
        sessionRef: 'ses_appeals_2Lp8v1',
        text: 'Appeal. The plan of care is signed and supports 4 units. Reference number for the payer appeals line is HL-2210-4398.',
        at: '2026-10-14T10:24:00',
        reactions: { ':+1:': ['policy', 'billing', 'appeals'] },
      },
    ],
    recommendation: null,
    decisionLog: [
      { at: '2026-10-14T10:05:00', actor: 'intake', event: 'Case created from denial letter' },
      { at: '2026-10-14T10:10:00', actor: 'Jon T.', event: 'Job claimed' },
      { at: '2026-10-20T15:30:00', actor: 'Jon T.', event: 'Appeal filed Oct 20' },
    ],
    pay: { amount: 30, released: false },
    workspace: null,
  }
}

export function makeBoard(): Board {
  return {
    jobs: [
      {
        id: '4471',
        title: 'Appeal a denied lumbar MRI, CPT 72148',
        domain: 'medical-billing',
        poster: 'Cedar Street Clinic',
        pay: 45,
        deadline: '2026-11-14T17:00:00',
        estMinutes: 40,
        status: 'open',
        summary: 'Denial CO-50, 3 documents attached, poster reviews before sending.',
        bench: ['Policy', 'Billing codes', 'Appeals'],
        similar: 23,
      },
      {
        id: '4466',
        title: 'Coordination of benefits dispute, two payers',
        domain: 'medical-billing',
        poster: 'Northgate Family Practice',
        pay: 80,
        deadline: '2026-11-08T17:00:00',
        estMinutes: 75,
        status: 'open',
        summary: 'Bluepine Mutual says secondary, Harborline says secondary too.',
        bench: ['Policy', 'Billing codes', 'Appeals'],
        similar: 4,
      },
      {
        id: '4480',
        title: 'Water damage claim, contractor estimate disputed',
        domain: 'insurance-claims',
        poster: 'Homeowner',
        pay: 65,
        deadline: '2026-11-20T17:00:00',
        estMinutes: 60,
        status: 'open',
        summary: 'Adjuster offered $6,200 against a $9,800 estimate. Photos and two estimates attached.',
        bench: ['Policy', 'Adjusting', 'Negotiation'],
        similar: 11,
      },
      {
        id: '4421',
        title: 'Prior authorization, retro request for infusion',
        domain: 'medical-billing',
        poster: 'Cedarpoint Plan',
        pay: 55,
        deadline: '2026-11-18T17:00:00',
        estMinutes: 50,
        status: 'claimed',
        worker: { name: 'Ana L.' },
      },
    ],
  }
}

export function fixtureCase(id: string): Case | null {
  if (id === '4471') return makeCase4471()
  if (id === '4398') return makeCase4398()
  return null
}
