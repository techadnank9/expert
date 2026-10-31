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
    <div className="hdr-wrap">
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
    </div>
  )
}

/** "live" / "offline, fixtures" marker used in header meta lines. */
export function LiveDot({ offline, connected }: { offline: boolean; connected: boolean }) {
  const color = offline ? '#ffb508' : connected ? '#16a34a' : '#d4d4d4'
  return <span className="offline-dot" style={{ background: color }} />
}
