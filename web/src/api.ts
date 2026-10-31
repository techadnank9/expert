import { useEffect, useState } from 'react'
import type { Board, Case, Job } from './types'
import { fixtureCase, makeBoard } from './fixtures'

// In `vite dev`, /api is proxied to the bridge on :8788 (no CORS needed). Elsewhere hit it directly.
export const BRIDGE_URL: string =
  (import.meta.env.VITE_BRIDGE_URL as string | undefined) ?? (import.meta.env.DEV ? '' : 'http://localhost:8788')

const RETRY_MS = 5000

// ---------------------------------------------------------------------------
// Tiny store: one entry per actor ("case:4471", "board"). Hooks subscribe to it,
// so a callCase() from one component updates every screen showing that actor.
// ---------------------------------------------------------------------------

interface Entry<T> {
  data: T | null
  offline: boolean
  loading: boolean
  error: string | null
  connected: boolean // WebSocket open
  lastWrite: number | null // ms epoch of the last state change we saw
}

type Listener = () => void
const entries = new Map<string, Entry<unknown>>()
const listeners = new Map<string, Set<Listener>>()

function getEntry<T>(key: string): Entry<T> {
  let e = entries.get(key) as Entry<T> | undefined
  if (!e) {
    e = { data: null, offline: false, loading: true, error: null, connected: false, lastWrite: null }
    entries.set(key, e as Entry<unknown>)
  }
  return e
}

function setEntry<T>(key: string, patch: Partial<Entry<T>>) {
  if (patch.data && key.startsWith('case:')) patch = { ...patch, data: normalizeCase(patch.data, key.slice(5)) as T }
  const next = { ...getEntry<T>(key), ...patch }
  entries.set(key, next as Entry<unknown>)
  listeners.get(key)?.forEach((l) => l())
}

function subscribe(key: string, l: Listener) {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(l)
  return () => {
    set!.delete(l)
  }
}

/** Bridge state may omit fields (e.g. `id` is the actor id, not persisted). Fill safe defaults. */
function normalizeCase(raw: unknown, id: string): Case {
  const c = (raw ?? {}) as Partial<Case>
  return {
    ...c,
    id: c.id ?? id,
    title: c.title ?? `Case ${id}`,
    domain: c.domain ?? 'medical-billing',
    status: c.status ?? 'open',
    poster: c.poster ?? { name: 'Poster' },
    worker: c.worker ?? null,
    facts: { payer: '', amount: 0, denialCode: '', dateOfService: '', reason: '', ...(c.facts ?? {}) },
    documents: c.documents ?? [],
    deadline: c.deadline ?? new Date().toISOString(),
    alarms: c.alarms ?? [],
    relay: c.relay ?? { channel: `case-${id}` },
    thread: (c.thread ?? []).map((m) => ({ ...m, reactions: m.reactions ?? {} })),
    recommendation: c.recommendation ?? null,
    decisionLog: c.decisionLog ?? [],
    pay: c.pay ?? { amount: 0, released: false },
  }
}

// ---------------------------------------------------------------------------
// Merging WebSocket updates
// ---------------------------------------------------------------------------

function setPath(obj: Record<string, unknown>, path: string | string[], value: unknown) {
  const parts = Array.isArray(path) ? path : path.split('.')
  if (parts.length === 1) {
    obj[parts[0]] = value
    return
  }
  const [head, ...rest] = parts
  const child = obj[head]
  const copy: Record<string, unknown> = Array.isArray(child)
    ? ([...child] as unknown as Record<string, unknown>)
    : { ...((child as Record<string, unknown>) ?? {}) }
  setPath(copy, rest, value)
  obj[head] = copy
}

/** Accepts `changes` as a partial object, or an array of {key|path|field, value}. */
export function mergeChanges<T>(state: T, changes: unknown): T {
  if (!changes || typeof changes !== 'object') return state
  const next = { ...(state as Record<string, unknown>) }
  if (Array.isArray(changes)) {
    for (const c of changes) {
      if (!c || typeof c !== 'object') continue
      const rec = c as Record<string, unknown>
      const path = (rec.path ?? rec.key ?? rec.field ?? rec.name) as string | string[] | undefined
      if (path === undefined) Object.assign(next, rec)
      else setPath(next, path, rec.value)
    }
  } else {
    Object.assign(next, changes)
  }
  return next as T
}

// ---------------------------------------------------------------------------
// Live connection per key (fetch, then WebSocket; fall back to fixtures)
// ---------------------------------------------------------------------------

interface Conn {
  refs: number
  ws: WebSocket | null
  timer: ReturnType<typeof setTimeout> | null
  closed: boolean
}
const conns = new Map<string, Conn>()

function urlFor(key: string) {
  if (key === 'board') return `${BRIDGE_URL}/api/board`
  return `${BRIDGE_URL}/api/case/${encodeURIComponent(key.slice('case:'.length))}`
}

function fixtureFor(key: string): unknown {
  if (key === 'board') return makeBoard()
  return fixtureCase(key.slice('case:'.length))
}

async function fetchState(key: string): Promise<unknown> {
  const res = await fetch(urlFor(key))
  if (!res.ok) throw new Error(`GET ${urlFor(key)} ${res.status}`)
  return res.json()
}

async function connect(key: string) {
  const conn = conns.get(key)
  if (!conn || conn.closed) return
  try {
    const state = await fetchState(key)
    if (conn.closed) return
    setEntry(key, { data: state, offline: false, loading: false, error: null, lastWrite: Date.now() })
  } catch {
    if (conn.closed) return
    const cur = getEntry(key)
    // Bridge down: keep whatever we have (fixtures or locally simulated state).
    if (!cur.offline || cur.data === null) {
      setEntry(key, { data: cur.data ?? fixtureFor(key), offline: true, loading: false, connected: false, lastWrite: cur.lastWrite ?? Date.now() })
    }
    conn.timer = setTimeout(() => connect(key), RETRY_MS)
    return
  }

  try {
    const r = await fetch(`${urlFor(key)}/ws-url`)
    if (!r.ok) throw new Error(`ws-url ${r.status}`)
    const { websocketUrl } = (await r.json()) as { websocketUrl: string }
    if (conn.closed) return
    const ws = new WebSocket(websocketUrl)
    conn.ws = ws
    ws.onopen = () => setEntry(key, { connected: true })
    ws.onmessage = (ev) => {
      let msg: { type?: string; state?: unknown; changes?: unknown }
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '')
      } catch {
        return
      }
      if (msg.type === 'state' && msg.state) {
        setEntry(key, { data: msg.state, offline: false, lastWrite: Date.now() })
      } else if (msg.type === 'state_update') {
        const cur = getEntry(key)
        if (cur.data) setEntry(key, { data: mergeChanges(cur.data, msg.changes), lastWrite: Date.now() })
      }
    }
    ws.onclose = () => {
      conn.ws = null
      setEntry(key, { connected: false })
      if (!conn.closed) conn.timer = setTimeout(() => connect(key), 2000)
    }
    ws.onerror = () => ws.close()
  } catch {
    // REST works but no socket: poll instead.
    if (!conn.closed) conn.timer = setTimeout(() => connect(key), RETRY_MS)
  }
}

function retain(key: string) {
  let conn = conns.get(key)
  if (conn) {
    conn.refs++
    return
  }
  conn = { refs: 1, ws: null, timer: null, closed: false }
  conns.set(key, conn)
  void connect(key)
}

function release(key: string) {
  const conn = conns.get(key)
  if (!conn) return
  conn.refs--
  if (conn.refs > 0) return
  conn.closed = true
  if (conn.timer) clearTimeout(conn.timer)
  conn.ws?.close()
  conns.delete(key)
}

function useEntry<T>(key: string): Entry<T> {
  const [, force] = useState(0)
  useEffect(() => {
    const unsub = subscribe(key, () => force((n) => n + 1))
    retain(key)
    return () => {
      unsub()
      release(key)
    }
  }, [key])
  return getEntry<T>(key)
}

export interface Live<T> {
  data: T | null
  offline: boolean
  loading: boolean
  connected: boolean
  lastWrite: number | null
}

export function useCase(id: string): Live<Case> {
  const e = useEntry<Case>(`case:${id}`)
  useOfflineAlarmTicker(id, e)
  return e
}

export function useBoard(): Live<Board> {
  return useEntry<Board>('board')
}

// Offline only: let due alarms fire on their own so the Supervisor demo works without a bridge.
function useOfflineAlarmTicker(id: string, e: Entry<Case>) {
  const hasDue = !!e.data?.alarms.some((a) => !a.fired)
  useEffect(() => {
    if (!e.offline || !hasDue) return
    const t = setInterval(() => {
      const cur = getEntry<Case>(`case:${id}`)
      if (!cur.offline || !cur.data) return
      const now = Date.now()
      if (cur.data.alarms.some((a) => !a.fired && Date.parse(a.at) <= now)) {
        setEntry(`case:${id}`, { data: applyCase(cur.data, 'fireDueAlarms', []), lastWrite: now })
      }
    }, 1000)
    return () => clearInterval(t)
  }, [id, e.offline, hasDue])
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

async function post(url: string, args: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `${res.status}`)
  return text ? JSON.parse(text) : null
}

export async function callCase(id: string, method: string, ...args: unknown[]): Promise<Case | null> {
  const key = `case:${id}`
  const cur = getEntry<Case>(key)
  if (cur.offline) {
    const base = cur.data ?? fixtureCase(id)
    if (!base) throw new Error(`Case ${id} not found (offline)`)
    const next = applyCase(base, method, args)
    setEntry(key, { data: next, lastWrite: Date.now() })
    return next
  }
  const result = await post(`${BRIDGE_URL}/api/case/${encodeURIComponent(id)}/${method}`, args)
  // Re-fetch so we never show a stale view even if the socket lags.
  try {
    const fresh = (await fetchState(key)) as Case
    setEntry(key, { data: fresh, offline: false, lastWrite: Date.now() })
    return fresh
  } catch {
    if (result && typeof result === 'object') setEntry(key, { data: result, lastWrite: Date.now() })
    return result as Case
  }
}

export async function callBoard(method: string, ...args: unknown[]): Promise<Board | null> {
  const cur = getEntry<Board>('board')
  if (cur.offline) {
    const next = applyBoard(cur.data ?? makeBoard(), method, args)
    setEntry('board', { data: next, lastWrite: Date.now() })
    return next
  }
  const result = await post(`${BRIDGE_URL}/api/board/${method}`, args)
  try {
    const fresh = (await fetchState('board')) as Board
    setEntry('board', { data: fresh, offline: false, lastWrite: Date.now() })
    return fresh
  } catch {
    if (result && typeof result === 'object') setEntry('board', { data: result, lastWrite: Date.now() })
    return result as Board
  }
}

// ---------------------------------------------------------------------------
// Offline simulation of the actor methods (only used while the bridge is down).
// Mirrors HANDOFF section 3 closely enough for a click-through demo.
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString()
const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 7)}`

function workerName(c: Case) {
  return c.worker?.name ?? 'worker'
}

export function applyCase(c: Case, method: string, args: unknown[]): Case {
  const s: Case = structuredClone(c)
  const log = (actor: string, event: string, reason?: string) =>
    s.decisionLog.push({ at: nowIso(), actor, event, ...(reason ? { reason } : {}) })
  const say = (author: string, text: string, address?: string) =>
    s.thread.push({ id: rid('m'), author, address, text, at: nowIso(), reactions: {} })

  switch (method) {
    case 'claim': {
      const w = args[0] as { name: string }
      s.worker = w
      s.status = 'claimed'
      log(w.name, 'Job claimed')
      break
    }
    case 'ask': {
      const q = String(args[0] ?? '')
      say('maya', q)
      s.status = 'consulting'
      log(workerName(s), 'Question sent to bench')
      break
    }
    case 'appendThreadMessage': {
      const m = args[0] as Partial<Case['thread'][number]>
      s.thread.push({ id: m.id ?? rid('m'), author: m.author ?? 'unknown', text: m.text ?? '', at: m.at ?? nowIso(), reactions: m.reactions ?? {}, address: m.address, sessionRef: m.sessionRef })
      break
    }
    case 'postRecommendation': {
      s.recommendation = args[0] as Case['recommendation']
      s.status = 'recommended'
      log('bench', 'Bench recommendation posted')
      break
    }
    case 'approveRecommendation': {
      s.status = 'drafted'
      const rec = s.thread.find((m) => m.id === s.relay.recommendationId)
      if (rec) rec.reactions[':white_check_mark:'] = [...(rec.reactions[':white_check_mark:'] ?? []), 'maya']
      log(workerName(s), 'Worker approved the recommendation')
      break
    }
    case 'overrideRecommendation': {
      const reason = String(args[0] ?? '')
      s.status = 'consulting'
      say('maya', `Override: ${reason}`)
      log(workerName(s), 'Worker overrode the recommendation', reason)
      break
    }
    case 'submitDeliverable': {
      s.status = 'awaiting_poster'
      log(workerName(s), 'Deliverable submitted to poster', args[1] ? String(args[1]) : undefined)
      break
    }
    case 'posterApprove': {
      s.status = 'approved'
      s.pay = { ...s.pay, released: true }
      log(s.poster.name, 'Poster approved, pay released')
      say('case-actor', `Poster approved. $${s.pay.amount} released to ${workerName(s)}.`, 'inbound webhook')
      break
    }
    case 'scheduleAlarm': {
      const [at, kind] = args as [string, 'nudge' | 'escalate']
      s.alarms.push({ id: rid('al'), at, kind, fired: false })
      log('case-actor', `Alarm scheduled: ${kind}`)
      break
    }
    case 'fireAlarm': {
      fire(s, String(args[0]), log, say)
      break
    }
    case 'fireDueAlarms': {
      const now = Date.now()
      for (const a of s.alarms) if (!a.fired && Date.parse(a.at) <= now) fire(s, a.id, log, say)
      break
    }
    case 'escalate': {
      s.status = 'escalated'
      log('case-actor', 'Escalated to supervisor', String(args[0] ?? ''))
      break
    }
    default:
      throw new Error(`Offline: method ${method} not simulated`)
  }
  return s
}

function fire(
  s: Case,
  id: string,
  log: (actor: string, event: string, reason?: string) => void,
  say: (author: string, text: string, address?: string) => void,
) {
  const a = s.alarms.find((x) => x.id === id)
  if (!a || a.fired) return
  a.fired = true
  if (a.kind === 'escalate') {
    s.status = 'escalated'
    log('case-actor', 'Alarm fired, escalated to supervisor', 'no payer reply 10d')
    say('case-actor', 'Alarm fired: no payer response 10 days after the appeal was filed. Escalated to Dana K.', 'inbound webhook')
  } else {
    log('case-actor', 'Alarm fired, nudged worker')
    say('case-actor', `Alarm fired: nudge. ${s.worker?.name ?? 'Worker'}, check for a payer reply.`, 'inbound webhook')
  }
}

export function applyBoard(b: Board, method: string, args: unknown[]): Board {
  const s: Board = structuredClone(b)
  if (method === 'claim') {
    const [jobId, worker] = args as [string, { name: string }]
    const job = s.jobs.find((j) => j.id === jobId)
    if (!job) throw new Error(`No job ${jobId}`)
    if (job.status === 'claimed') throw new Error('Already claimed by someone else')
    job.status = 'claimed'
    job.worker = worker
    return s
  }
  if (method === 'post') {
    const job = args[0] as Job
    s.jobs.unshift(job)
    // Seed a local case so the poster view has something to show offline.
    const key = `case:${job.id}`
    if (!getEntry(key).data) {
      setEntry<Case>(key, { data: caseFromJob(job), offline: true, loading: false })
    }
    return s
  }
  throw new Error(`Offline: board method ${method} not simulated`)
}

function caseFromJob(job: Job): Case {
  const poster = typeof job.poster === 'string' ? { name: job.poster } : job.poster
  return {
    id: job.id,
    title: job.title,
    domain: job.domain,
    status: 'open',
    poster,
    worker: null,
    facts: { payer: 'Harborline Health', amount: 0, denialCode: '', dateOfService: '', reason: '' },
    documents: [],
    deadline: job.deadline,
    alarms: [],
    relay: { channel: `case-${job.id}` },
    thread: [
      { id: rid('m'), author: 'case-actor', address: 'inbound webhook', text: 'Case opened from a new job post.', at: nowIso(), reactions: {} },
    ],
    recommendation: null,
    decisionLog: [{ at: nowIso(), actor: poster.name, event: 'Job posted' }],
    pay: { amount: job.pay, released: false },
  }
}
