import type { ReactNode } from 'react'
import type { Case } from '../types'
import { Message } from './Message'
import { AGENTS } from '../people'

/** Verification label from an agent reply: VERIFIED at the end, or FIX NEEDED anywhere. */
function verdictOf(author: string, text: string): 'verified' | 'fix' | null {
  if (!AGENTS[author]) return null
  if (/FIX NEEDED/i.test(text)) return 'fix'
  if (/VERIFIED[.!)\s]*$/i.test(text.trim())) return 'verified'
  return null
}

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
      {msgs.length === 0 && <div className="muted">No messages yet. Submit your work for verification above.</div>}
      {msgs.map((m) => {
        const v = verdictOf(m.author, m.text)
        const msg = (
          <Message
            key={m.id}
            msg={m}
            workerName={c.worker?.name}
            threadRootId={c.relay?.threadRootId}
            flat={flat}
            showAddress={showAddress}
          />
        )
        if (!v) return msg
        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {msg}
            <span className={`pill tight ${v === 'verified' ? 'pill-green' : 'pill-amber'}`} style={{ alignSelf: 'flex-start', marginLeft: 44 }}>
              {v === 'verified' ? 'verified' : 'fix needed'}
            </span>
          </div>
        )
      })}
      {children}
    </div>
  )
}
