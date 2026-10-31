import type { CaseStatus } from './types'

export interface Person {
  name: string
  short: string
  initial: string
  bg: string
  fg: string
  kind: 'agent' | 'system' | 'worker' | 'human'
}

export const AGENTS: Record<string, Person> = {
  policy: { name: 'Policy agent', short: 'Policy', initial: 'P', bg: '#2F4BD6', fg: '#FFFFFF', kind: 'agent' },
  billing: { name: 'Billing codes agent', short: 'Billing codes', initial: 'B', bg: '#1E6B3A', fg: '#FFFFFF', kind: 'agent' },
  appeals: { name: 'Appeals agent', short: 'Appeals', initial: 'A', bg: '#8A4B00', fg: '#FFFFFF', kind: 'agent' },
}

export const BENCH = ['policy', 'billing', 'appeals'] as const

const WORKERS = new Set(['maya', 'jon', 'worker'])

export function person(handle: string, workerName?: string): Person {
  const h = handle.toLowerCase()
  if (AGENTS[h]) return AGENTS[h]
  if (h === 'case-actor' || h === 'system')
    return { name: 'case-actor', short: 'case-actor', initial: 'CA', bg: '#EDEBE4', fg: '#3D3C39', kind: 'system' }
  if (WORKERS.has(h)) {
    const name = workerName ?? (h === 'maya' ? 'Maya Chen' : h === 'jon' ? 'Jon T.' : 'Worker')
    return { name, short: name, initial: initialsOf(name), bg: '#D9E4D3', fg: '#1E4D2B', kind: 'worker' }
  }
  if (h === 'dana') return { name: 'Dana K.', short: 'Dana K.', initial: 'DK', bg: '#E6E9F8', fg: '#2F4BD6', kind: 'human' }
  if (h === 'poster') return { name: 'Poster', short: 'Poster', initial: 'PO', bg: '#EDEBE4', fg: '#3D3C39', kind: 'human' }
  return { name: handle, short: handle, initial: initialsOf(handle), bg: '#EDEBE4', fg: '#3D3C39', kind: 'human' }
}

function initialsOf(name: string) {
  return name
    .replace(/[^A-Za-z\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export const STATUS: Record<CaseStatus, { label: string; pill: string }> = {
  open: { label: 'Open', pill: 'pill-grey' },
  claimed: { label: 'Claimed', pill: 'pill-green' },
  consulting: { label: 'Bench consulting', pill: 'pill-blue' },
  recommended: { label: 'Awaiting approval', pill: 'pill-blue' },
  drafted: { label: 'Approved, appeal drafted', pill: 'pill-green' },
  awaiting_poster: { label: 'With poster for review', pill: 'pill-grey' },
  approved: { label: 'Approved by poster', pill: 'pill-green' },
  escalated: { label: 'Escalated', pill: 'pill-amber-strong' },
}

export function statusOf(s: string) {
  return STATUS[s as CaseStatus] ?? { label: s, pill: 'pill-grey' }
}
