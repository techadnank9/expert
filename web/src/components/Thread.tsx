import type { ReactNode } from 'react'
import type { Case } from '../types'
import { Message } from './Message'

interface Props {
  c: Case
  /** Rendered after the messages (the recommendation card goes here). */
  children?: ReactNode
  flat?: boolean
  showAddress?: boolean
  limit?: number
}

export function Thread({ c, children, flat, showAddress, limit }: Props) {
  const msgs = limit ? c.thread.slice(0, limit) : c.thread
  return (
    <div className="thread">
      {msgs.length === 0 && <div className="muted">No messages yet. Ask the bench a question below.</div>}
      {msgs.map((m) => (
        <Message
          key={m.id}
          msg={m}
          workerName={c.worker?.name}
          threadRootId={c.relay?.threadRootId}
          flat={flat}
          showAddress={showAddress}
        />
      ))}
      {children}
    </div>
  )
}
