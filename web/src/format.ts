import { useEffect, useState } from 'react'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function d(iso: string) {
  // Date-only strings would parse as UTC midnight; pin them to local noon.
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)
}

export function fmtClock(iso: string) {
  const x = d(iso)
  if (isNaN(x.getTime())) return iso
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

export function fmtTime12(iso: string) {
  const x = d(iso)
  if (isNaN(x.getTime())) return iso
  const h = x.getHours() % 12 || 12
  return `${h}:${String(x.getMinutes()).padStart(2, '0')} ${x.getHours() < 12 ? 'AM' : 'PM'}`
}

export function fmtShort(iso: string) {
  const x = d(iso)
  if (isNaN(x.getTime())) return iso
  return `${MONTHS[x.getMonth()]} ${x.getDate()}`
}

export function fmtDate(iso: string) {
  const x = d(iso)
  if (isNaN(x.getTime())) return iso
  return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`
}

export function isToday(iso: string, now = Date.now()) {
  const x = d(iso)
  return x.toDateString() === new Date(now).toDateString()
}

/** "12:42 today" or "Oct 29" */
export function fmtWhen(iso: string, now = Date.now()) {
  return isToday(iso, now) ? `${fmtClock(iso)} today` : fmtShort(iso)
}

/** Live countdown: "in 0:42", "in 3h 12m", "in 10 days", or "due now" */
export function countdown(iso: string, now: number) {
  const ms = d(iso).getTime() - now
  if (isNaN(ms)) return ''
  if (ms <= 0) return 'due now'
  const s = Math.floor(ms / 1000)
  if (s < 3600) return `in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  if (s < 86400) return `in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  return `in ${days}d ${hours}h`
}

export function daysUntil(iso: string, now: number) {
  return Math.max(0, Math.ceil((d(iso).getTime() - now) / 86400000))
}

export function ago(ms: number | null, now: number) {
  if (ms === null) return 'never'
  const s = Math.max(0, Math.floor((now - ms) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export function money(n: number | string, cents = true) {
  if (typeof n === 'string') return n
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`
}

export function initials(name: string) {
  return name
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** "Maya Chen" -> "Maya C." */
export function shortName(name: string) {
  const [first, last] = name.split(/\s+/)
  return last ? `${first} ${last[0]}.` : first
}

export function sessionUrl(ref: string) {
  return `https://agentrelay.com/sessions/${ref}`
}

export function lowerFirst(s: string) {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s
}
