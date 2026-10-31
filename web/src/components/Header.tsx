import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  subtitle: string
  center?: ReactNode
  meta?: ReactNode
  me?: { initials: string; tone: 'green' | 'blue' }
  right?: ReactNode
}

export function Header({ subtitle, center, meta, me, right }: Props) {
  return (
    <header className="hdr">
      <Link to="/" className="brand">
        <div className="logo">U</div>
        <div className="brand-text">
          <div className="brand-name">HireXpert</div>
          <div className="sm muted">{subtitle}</div>
        </div>
      </Link>
      {center ?? <div style={{ flex: '1 1 200px' }} />}
      {right}
      {(meta || me) && (
        <div className="hdr-right">
          {meta && <div className="hdr-meta">{meta}</div>}
          {me && <div className={`me me-${me.tone}`}>{me.initials}</div>}
        </div>
      )}
    </header>
  )
}

/** "live" / "offline, fixtures" marker used in header meta lines. */
export function LiveDot({ offline, connected }: { offline: boolean; connected: boolean }) {
  const color = offline ? '#8A4B00' : connected ? '#1E6B3A' : '#C9C5BA'
  return <span className="offline-dot" style={{ background: color }} />
}
