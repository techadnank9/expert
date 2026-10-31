import type { Board, Case } from './types'

// Offline fixtures. Facts copied from mockups/ (Worker, Supervisor, Find1, Post1-3).
// Times are local wall-clock ISO (no Z) so the demo reads "12:41" wherever it runs.

const TODAY = '2026-10-31'
const t = (hhmm: string) => `${TODAY}T${hhmm}:00`

/** Worker's submitted work. Not in types.ts yet; the bridge adds it to the case state. */
export interface Deliverable {
  files: string[]
  note: string
  at?: string
  submittedAt?: string
}

export function deliverableOf(c: Case | null | undefined): Deliverable | null {
  const d = (c as (Case & { deliverable?: Deliverable | null }) | null | undefined)?.deliverable
  return d && typeof d.note === 'string' ? d : null
}

/** Starter draft shown in the Worker "Your work" box for case 4471. */
export const DRAFT_4471 = `To: Harborline Health, Appeals Department
Re: Level 1 appeal, claim 4471, CPT 72148 (MRI lumbar spine without contrast), denial code CO-50

We request reconsideration of the denial of the lumbar MRI performed Oct 2, 2026. Harborline plan policy CG-0423, section 4.2, covers lumbar MRI without contrast when at least six weeks of conservative therapy are documented before imaging.

The enclosed physical therapy records document eight weeks of treatment, Aug 4 to Sep 29, 2026, which exceeds the policy threshold. The ordering physician's re-evaluation on Sep 30, 2026 records persistent radicular symptoms despite therapy and establishes medical necessity for advanced imaging.

Enclosures: denial letter, PT visit log, physician note dated Sep 30, policy CG-0423 excerpt.`

export interface PastJob {
  id: string
  title: string
  business: string
  pay: number
  completed: string
  status: 'Verified and sent' | 'Paid' | 'Fix requested once'
}

export const PAST_JOBS: PastJob[] = [
  { id: '4452', title: 'Appeal denied knee arthroscopy, CPT 29881', business: 'Cedar Street Clinic', pay: 50, completed: '2026-10-29', status: 'Verified and sent' },
  { id: '4437', title: 'Corrected claim, missing modifier 25', business: 'Northgate Family Practice', pay: 30, completed: '2026-10-27', status: 'Paid' },
  { id: '4419', title: 'Timely filing appeal, proof of submission', business: 'Lakeview Pediatrics', pay: 40, completed: '2026-10-23', status: 'Fix requested once' },
  { id: '4408', title: 'Out of network reprocessing, ER visit', business: 'Cedar Street Clinic', pay: 55, completed: '2026-10-20', status: 'Paid' },
  { id: '4391', title: 'Duplicate claim denial, CO-18 cleanup', business: 'Brightwater Dental Group', pay: 25, completed: '2026-10-16', status: 'Paid' },
  { id: '4377', title: 'Prior auth appeal, sleep study CPT 95810', business: 'Harbor Sleep Center', pay: 60, completed: '2026-10-12', status: 'Fix requested once' },
  { id: '4362', title: 'Bundling denial, NCCI edit on 97140', business: 'Northgate Family Practice', pay: 35, completed: '2026-10-07', status: 'Paid' },
]

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
        text: 'Submitted my level 1 appeal draft for verification. Please check the policy cite, the PT dates and the enclosures.',
        at: t('12:40'),
        reactions: {},
      },
      {
        id: 'm_8f22',
        author: 'policy',
        address: 'policy@sam-macbook',
        sessionRef: 'ses_policy_7Kq2a1',
        text: 'CG-0423 section 4.2 requires 6 weeks of documented conservative therapy before lumbar MRI. The draft cites 8 weeks, Aug 4 to Sep 29, which matches the PT notes p.3. VERIFIED',
        at: t('12:41'),
        reactions: {},
      },
      {
        id: 'm_8f23',
        author: 'billing',
        address: 'billing@priya-thinkpad',
        sessionRef: 'ses_billing_3Hd9x4',
        text: 'FIX NEEDED: the draft does not name the diagnosis. Add radiculopathy M54.16 next to CPT 72148 so the reviewer can match the indication.',
        at: t('12:41'),
        reactions: {},
      },
      {
        id: 'm_8f24',
        author: 'appeals',
        address: 'appeals@adnan-mbp',
        sessionRef: 'ses_appeals_9Wm4c7',
        text: 'Denial letter p.1 already lists M54.16, so the payer has the diagnosis. CO-50 is a necessity denial and the draft argues necessity, which is the right frame. VERIFIED',
        at: t('12:42'),
        reactions: {},
      },
      {
        id: 'm_8f25',
        author: 'billing',
        address: 'billing@priya-thinkpad',
        sessionRef: 'ses_billing_3Hd9x4',
        text: 'Confirmed on the denial letter p.1, M54.16 is on the claim. 72148 was billed clean and no modifier is required. Withdrawing my fix. VERIFIED',
        at: t('12:42'),
        reactions: {},
      },
      {
        id: 'm_8f26',
        author: 'appeals',
        address: 'appeals@adnan-mbp',
        sessionRef: 'ses_appeals_9Wm4c7',
        text: "Enclosures match the letter: denial letter, PT visit log, Sep 30 physician note, policy excerpt. Harborline turns level 1 appeals around in 10 business days, so keep the Nov 10 nudge. VERIFIED",
        at: t('12:42'),
        reactions: {},
      },
      {
        id: 'm_8f27',
        author: 'policy',
        address: 'policy@sam-macbook',
        sessionRef: 'ses_policy_7Kq2a1',
        text: 'All three checks pass. Calling post_recommendation with the verdict.',
        at: t('12:42'),
        reactions: { ':+1:': ['policy', 'billing', 'appeals'] },
      },
    ],
    recommendation: {
      summary: 'Verified: appeal letter is ready to send',
      steps: [
        'Policy cite checked: CG-0423, section 4.2 (6 week conservative therapy threshold)',
        'PT dates checked: Aug 4 to Sep 29, 8 weeks, against PT notes p.3',
        'Physician note dated Sep 30 is enclosed and referenced',
        'Alarms kept: nudge Nov 10, escalate Nov 12',
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
      { at: t('12:40'), actor: 'Maya Chen', event: 'Work submitted for verification' },
      { at: t('12:42'), actor: 'bench', event: 'Verification verdict posted' },
    ],
    pay: { amount: 45, released: false },
    workspace: null,
    deliverable: { files: [], note: DRAFT_4471, at: t('12:40') },
  } as Case
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
