// Case state store. MemoryCaseStore is the working implementation today;
// TerseCaseStore forwards to the Terse generated client once actor/ ships it.
// Shapes follow CONTRACT.md / HANDOFF.md section 3.

export type CaseStatus = 'open' | 'claimed' | 'consulting' | 'recommended' | 'drafted' | 'awaiting_poster' | 'approved' | 'escalated';
export interface ThreadMessage {
  id: string;
  author: string;
  address?: string;
  sessionRef?: string;
  text: string;
  at: string;
  reactions: Record<string, string[]>;
  parentId?: string;
}
export interface Recommendation { summary: string; steps: string[]; sources: string[]; agrees: string[] }
export interface Alarm { id: string; at: string; kind: 'nudge' | 'escalate'; fired: boolean }
export interface RelayInfo { channel: string; threadRootId?: string; recommendationId?: string; webhookUrl?: string; webhookToken?: string }
export interface CaseState {
  id: string;
  title: string;
  domain: 'medical-billing';
  poster: { name: string };
  worker: { name: string } | null;
  status: CaseStatus;
  facts: { payer: string; amount: number | string; denialCode: string; dateOfService: string; reason: string };
  documents: { name: string; pages: number; source: string }[];
  deadline: string;
  alarms: Alarm[];
  relay: RelayInfo;
  thread: ThreadMessage[];
  recommendation: Recommendation | null;
  decisionLog: { at: string; actor: string; event: string; reason?: string }[];
  pay: { amount: number; released: boolean };
  deliverable?: { files: unknown[]; note: string } | null;
  requestedDocuments?: { name: string; reason: string; by: string; at: string }[];
}
export interface Job { id: string; title: string; domain: string; poster: string; pay: number; deadline: string; estMinutes: number; status: 'open' | 'claimed'; worker?: string }
export interface BoardState { jobs: Job[] }

export type Listener<T> = (state: T) => void;

export interface CaseStore {
  readonly kind: 'memory' | 'terse';
  getCase(id: string): Promise<CaseState | null>;
  /** Generic actor-method call used by POST /api/case/:id/:method. */
  callCase(id: string, method: string, args: unknown[]): Promise<CaseState>;
  appendThreadMessage(id: string, msg: ThreadMessage): Promise<CaseState>;
  addReaction(id: string, messageId: string, emoji: string, handle: string): Promise<CaseState>;
  postRecommendation(id: string, rec: Omit<Recommendation, 'agrees'> & { agrees?: string[] }): Promise<CaseState>;
  setAgrees(id: string, agrees: string[]): Promise<CaseState>;
  scheduleAlarm(id: string, at: string, kind: Alarm['kind']): Promise<CaseState>;
  requestDocument(id: string, doc: { name: string; reason: string; by: string }): Promise<CaseState>;
  setRelayInfo(id: string, info: Partial<RelayInfo>): Promise<CaseState>;
  /** messageId -> caseId, for reaction events that carry no channel. */
  caseForMessage(messageId: string): string | undefined;
  getBoard(): Promise<BoardState>;
  callBoard(method: string, args: unknown[]): Promise<BoardState>;
  subscribeCase(id: string, fn: Listener<CaseState>): () => void;
  subscribeBoard(fn: Listener<BoardState>): () => void;
}

export const normEmoji = (e: string) => {
  const bare = e.replace(/^:|:$/g, '');
  if (bare === '👍' || bare === 'thumbsup' || bare === '+1') return ':+1:';
  if (bare === '✅' || bare === 'white_check_mark') return ':white_check_mark:';
  return `:${bare}:`;
};

const now = () => new Date().toISOString();

function blankCase(id: string, input: Partial<CaseState> = {}): CaseState {
  return {
    id,
    title: `Case ${id}`,
    domain: 'medical-billing',
    poster: { name: 'Unknown poster' },
    worker: null,
    status: 'open',
    facts: { payer: '', amount: 0, denialCode: '', dateOfService: '', reason: '' },
    documents: [],
    deadline: new Date(Date.now() + 3 * 864e5).toISOString(),
    alarms: [],
    relay: { channel: `case-${id}` },
    thread: [],
    recommendation: null,
    decisionLog: [],
    pay: { amount: 0, released: false },
    deliverable: null,
    requestedDocuments: [],
    ...input,
  };
}

export class MemoryCaseStore implements CaseStore {
  readonly kind = 'memory' as const;
  private cases = new Map<string, CaseState>();
  private board: BoardState = { jobs: [] };
  private msgIndex = new Map<string, string>();
  private caseSubs = new Map<string, Set<Listener<CaseState>>>();
  private boardSubs = new Set<Listener<BoardState>>();

  constructor(seed = true) {
    if (seed) this.seed();
  }

  private seed() {
    const c1 = blankCase('4471', {
      title: 'Appeal denied lumbar MRI, CPT 72148',
      poster: { name: 'Mission Bay Spine Clinic' },
      worker: { name: 'Maya' },
      status: 'claimed',
      facts: { payer: 'Bluecrest Health', amount: 1840, denialCode: 'CO-50', dateOfService: '2026-09-14', reason: 'Not medically necessary: conservative therapy not documented' },
      documents: [
        { name: 'Denial letter (EOB)', pages: 2, source: 'poster' },
        { name: 'Bluecrest MRI policy MP-114', pages: 9, source: 'payer' },
        { name: 'PT notes, 8 weeks', pages: 14, source: 'poster' },
      ],
      pay: { amount: 120, released: false },
    });
    const c2 = blankCase('4398', {
      title: 'Appeal denied knee arthroscopy, CPT 29881',
      poster: { name: 'Bayview Ortho' },
      worker: { name: 'Jon' },
      status: 'consulting',
      facts: { payer: 'Pacific Mutual', amount: 4210, denialCode: 'CO-197', dateOfService: '2026-08-02', reason: 'Prior authorization absent' },
      alarms: [{ id: 'a1', at: new Date(Date.now() + 60_000).toISOString(), kind: 'escalate', fired: false }],
      pay: { amount: 150, released: false },
    });
    for (const c of [c1, c2]) this.cases.set(c.id, c);
    this.board.jobs = [c1, c2].map((c) => ({ id: c.id, title: c.title, domain: c.domain, poster: c.poster.name, pay: c.pay.amount, deadline: c.deadline, estMinutes: 45, status: 'claimed', worker: c.worker?.name }));
  }

  private emit(id: string) {
    const s = this.cases.get(id);
    if (!s) return;
    for (const fn of this.caseSubs.get(id) ?? []) fn(structuredClone(s));
  }
  private emitBoard() {
    for (const fn of this.boardSubs) fn(structuredClone(this.board));
  }
  private mut(id: string, fn: (s: CaseState) => void, log?: { actor: string; event: string; reason?: string }): CaseState {
    let s = this.cases.get(id);
    if (!s) {
      s = blankCase(id);
      this.cases.set(id, s);
    }
    fn(s);
    if (log) s.decisionLog.push({ at: now(), ...log });
    this.emit(id);
    return structuredClone(s);
  }

  async getCase(id: string) {
    const s = this.cases.get(id);
    return s ? structuredClone(s) : null;
  }

  async callCase(id: string, method: string, args: unknown[]): Promise<CaseState> {
    const a = args as any[];
    switch (method) {
      case 'getState':
        return (await this.getCase(id)) ?? this.mut(id, () => {});
      case 'create':
        return this.mut(id, (s) => Object.assign(s, blankCase(id, { ...(a[0] ?? {}), id })), { actor: 'poster', event: 'created' });
      case 'claim':
        return this.mut(id, (s) => {
          if (s.worker && s.status !== 'open') throw new Error(`already claimed by ${s.worker.name}`);
          s.worker = typeof a[0] === 'string' ? { name: a[0] } : a[0];
          s.status = 'claimed';
        }, { actor: String(a[0]?.name ?? a[0]), event: 'claimed' });
      case 'ask':
        return this.mut(id, (s) => { s.status = 'consulting'; }, { actor: s(this.cases.get(id)), event: `asked: ${a[0]}` });
      case 'appendThreadMessage':
        return this.appendThreadMessage(id, a[0]);
      case 'postRecommendation':
        return this.postRecommendation(id, a[0]);
      case 'approveRecommendation':
        return this.mut(id, (s) => { s.status = 'drafted'; }, { actor: s(this.cases.get(id)), event: 'approved recommendation' });
      case 'overrideRecommendation':
        return this.mut(id, (s) => { s.status = 'drafted'; }, { actor: s(this.cases.get(id)), event: 'overrode recommendation', reason: a[0] });
      case 'submitDeliverable':
        return this.mut(id, (s) => { s.deliverable = { files: a[0] ?? [], note: a[1] ?? '' }; s.status = 'awaiting_poster'; }, { actor: s(this.cases.get(id)), event: 'submitted deliverable' });
      case 'posterApprove':
        return this.mut(id, (s) => { s.status = 'approved'; s.pay.released = true; }, { actor: 'poster', event: 'poster approved, pay released' });
      case 'scheduleAlarm':
        return this.scheduleAlarm(id, a[0], a[1]);
      case 'fireAlarm':
        return this.mut(id, (s) => {
          const al = s.alarms.find((x) => x.id === a[0]);
          if (!al) throw new Error(`no alarm ${a[0]}`);
          al.fired = true;
          if (al.kind === 'escalate') s.status = 'escalated';
        }, { actor: 'case-actor', event: `alarm ${a[0]} fired` });
      case 'fireDueAlarms':
        return this.mut(id, (s) => {
          for (const al of s.alarms) if (!al.fired && Date.parse(al.at) <= Date.now()) {
            al.fired = true;
            if (al.kind === 'escalate') s.status = 'escalated';
            s.decisionLog.push({ at: now(), actor: 'case-actor', event: `alarm ${al.id} fired` });
          }
        });
      case 'escalate':
        return this.mut(id, (s) => { s.status = 'escalated'; }, { actor: 'case-actor', event: 'escalated', reason: a[0] });
      case 'addReaction':
        return this.addReaction(id, a[0], a[1], a[2]);
      case 'setRelayInfo':
        return this.setRelayInfo(id, a[0]);
      default:
        throw new Error(`unknown case method ${method}`);
    }
    function s(c?: CaseState) { return c?.worker?.name ?? 'worker'; }
  }

  async appendThreadMessage(id: string, msg: ThreadMessage) {
    this.msgIndex.set(msg.id, id);
    return this.mut(id, (s) => {
      const existing = s.thread.find((m) => m.id === msg.id);
      if (existing) Object.assign(existing, { ...msg, reactions: existing.reactions });
      else s.thread.push({ ...msg, reactions: msg.reactions ?? {} });
    });
  }

  async addReaction(id: string, messageId: string, emoji: string, handle: string) {
    const key = normEmoji(emoji);
    return this.mut(id, (s) => {
      const m = s.thread.find((x) => x.id === messageId);
      if (!m) return;
      const list = (m.reactions[key] ??= []);
      if (!list.includes(handle)) list.push(handle);
    });
  }

  async postRecommendation(id: string, rec: Omit<Recommendation, 'agrees'> & { agrees?: string[] }) {
    return this.mut(id, (s) => {
      s.recommendation = { summary: rec.summary, steps: rec.steps, sources: rec.sources, agrees: rec.agrees ?? [] };
      s.status = 'recommended';
    }, { actor: 'appeals', event: 'recommendation posted' });
  }

  async setAgrees(id: string, agrees: string[]) {
    return this.mut(id, (s) => { if (s.recommendation) s.recommendation.agrees = agrees; });
  }

  async scheduleAlarm(id: string, at: string, kind: Alarm['kind']) {
    return this.mut(id, (s) => { s.alarms.push({ id: `a${s.alarms.length + 1}-${Date.now().toString(36)}`, at, kind, fired: false }); }, { actor: 'case-actor', event: `scheduled ${kind} alarm for ${at}` });
  }

  async requestDocument(id: string, doc: { name: string; reason: string; by: string }) {
    return this.mut(id, (s) => { (s.requestedDocuments ??= []).push({ ...doc, at: now() }); }, { actor: doc.by, event: `requested document ${doc.name}`, reason: doc.reason });
  }

  async setRelayInfo(id: string, info: Partial<RelayInfo>) {
    if (info.recommendationId) this.msgIndex.set(info.recommendationId, id);
    if (info.threadRootId) this.msgIndex.set(info.threadRootId, id);
    return this.mut(id, (s) => { s.relay = { ...s.relay, ...info }; });
  }

  caseForMessage(messageId: string) { return this.msgIndex.get(messageId); }

  async getBoard() { return structuredClone(this.board); }

  async callBoard(method: string, args: unknown[]): Promise<BoardState> {
    const a = args as any[];
    if (method === 'getState') return this.getBoard();
    if (method === 'post') {
      const job: Job = { status: 'open', estMinutes: 45, ...a[0] };
      this.board.jobs.push(job);
      await this.callCase(job.id, 'create', [{ title: job.title, poster: { name: job.poster }, pay: { amount: job.pay, released: false }, deadline: job.deadline }]);
    } else if (method === 'claim') {
      const job = this.board.jobs.find((j) => j.id === a[0]);
      if (!job) throw new Error(`no job ${a[0]}`);
      if (job.status === 'claimed') throw new Error(`job ${a[0]} already claimed by ${job.worker}`);
      job.status = 'claimed';
      job.worker = typeof a[1] === 'string' ? a[1] : a[1]?.name;
      await this.callCase(job.id, 'claim', [{ name: job.worker }]);
    } else throw new Error(`unknown board method ${method}`);
    this.emitBoard();
    return this.getBoard();
  }

  subscribeCase(id: string, fn: Listener<CaseState>) {
    let set = this.caseSubs.get(id);
    if (!set) this.caseSubs.set(id, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }
  subscribeBoard(fn: Listener<BoardState>) {
    this.boardSubs.add(fn);
    return () => this.boardSubs.delete(fn);
  }
}

/**
 * Stub over the Terse generated client (actor/client/generated). Loaded lazily
 * so this file compiles before machine A publishes the client. Method names
 * mirror CONTRACT.md; the exact client call shape (`actors.Case.get(id)` etc.)
 * must be confirmed against the generated code and adjusted in `caseHandle`.
 * NOTE: addReaction / setRelayInfo / setAgrees / requestDocument are not in
 * the CONTRACT actor method list; the actor needs them (or equivalents).
 */
export class TerseCaseStore implements CaseStore {
  readonly kind = 'terse' as const;
  private client: any;
  private msgIndex = new Map<string, string>();

  private async load() {
    if (this.client) return this.client;
    try {
      const path = '../actor/client/generated';
      this.client = await import(path);
    } catch (e) {
      throw new Error(`Terse generated client not available: ${(e as Error).message}`);
    }
    return this.client;
  }
  private async caseHandle(id: string): Promise<any> {
    const c = await this.load();
    const actors = c.actors ?? c.default?.actors ?? c;
    // TODO(actor): confirm accessor against generated client.
    return actors.Case?.get?.(id) ?? actors.Case?.(id);
  }
  private async boardHandle(): Promise<any> {
    const c = await this.load();
    const actors = c.actors ?? c.default?.actors ?? c;
    return actors.Board?.get?.('main') ?? actors.Board?.('main');
  }
  async getCase(id: string) { return (await this.caseHandle(id)).getState(); }
  async callCase(id: string, method: string, args: unknown[]) { return (await this.caseHandle(id))[method](...args); }
  async appendThreadMessage(id: string, msg: ThreadMessage) { this.msgIndex.set(msg.id, id); return this.callCase(id, 'appendThreadMessage', [msg]); }
  async addReaction(id: string, messageId: string, emoji: string, handle: string) { return this.callCase(id, 'addReaction', [messageId, normEmoji(emoji), handle]); }
  async postRecommendation(id: string, rec: any) { return this.callCase(id, 'postRecommendation', [{ agrees: [], ...rec }]); }
  async setAgrees(id: string, agrees: string[]) { return this.callCase(id, 'setAgrees', [agrees]); }
  async scheduleAlarm(id: string, at: string, kind: Alarm['kind']) { return this.callCase(id, 'scheduleAlarm', [at, kind]); }
  async requestDocument(id: string, doc: any) { return this.callCase(id, 'requestDocument', [doc]); }
  async setRelayInfo(id: string, info: Partial<RelayInfo>) {
    if (info.recommendationId) this.msgIndex.set(info.recommendationId, id);
    if (info.threadRootId) this.msgIndex.set(info.threadRootId, id);
    return this.callCase(id, 'setRelayInfo', [info]);
  }
  caseForMessage(messageId: string) { return this.msgIndex.get(messageId); }
  async getBoard() { return (await this.boardHandle()).getState(); }
  async callBoard(method: string, args: unknown[]) { return (await this.boardHandle())[method](...args); }
  // Browser subscribes to Terse directly via prepareWebsocket; no in-process fan-out.
  subscribeCase() { return () => {}; }
  subscribeBoard() { return () => {}; }
  async wsUrl(kind: 'Case' | 'Board', id: string): Promise<string> {
    const c = await this.load();
    const actors = c.actors ?? c.default?.actors ?? c;
    const r = await actors[kind].prepareWebsocket(id); // TODO(actor): confirm signature
    return typeof r === 'string' ? r : r.websocketUrl ?? r.url;
  }
}

export function makeCaseStore(): CaseStore {
  return process.env.TERSE_READY === '1' ? new TerseCaseStore() : new MemoryCaseStore();
}
