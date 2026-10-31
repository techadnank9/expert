import type { ThreadMessage } from '../types'
import { person } from '../people'
import { fmtClock, sessionUrl, shortName } from '../format'

const EMOJI: Record<string, string> = {
  ':+1:': '👍',
  '+1': '👍',
  thumbsup: '👍',
  ':white_check_mark:': '✅',
  white_check_mark: '✅',
  ':eyes:': '👀',
}

interface Props {
  msg: ThreadMessage
  workerName?: string
  threadRootId?: string
  /** Poster view renders the worker on the left like everyone else. */
  flat?: boolean
  showAddress?: boolean
}

export function Message({ msg, workerName, threadRootId, flat, showAddress = true }: Props) {
  const p = person(msg.author, workerName)
  const reactions = Object.entries(msg.reactions ?? {}).filter(([, who]) => who.length > 0)

  if (p.kind === 'worker' && !flat) {
    return (
      <div className="mine">
        <div className="bubble">{msg.text}</div>
        <div className="sm muted">
          {shortName(p.name)}
          {msg.id === threadRootId ? `, thread root ${msg.id}` : `, ${fmtClock(msg.at)}`}
        </div>
      </div>
    )
  }

  return (
    <div className="msg">
      <div className="avatar" style={{ background: p.bg, color: p.fg, fontSize: p.initial.length > 1 ? 11 : 13 }}>
        {p.initial}
      </div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="strong">{p.kind === 'worker' ? shortName(p.name) : p.name}</span>
          {p.kind === 'worker' && <span className="sm muted">worker</span>}
          {showAddress && msg.address && <span className="sm muted">{msg.address}</span>}
          <span className="sm muted">{fmtClock(msg.at)}</span>
          {msg.sessionRef && (
            <a className="sm" href={sessionUrl(msg.sessionRef)} target="_blank" rel="noreferrer">
              view session
            </a>
          )}
        </div>
        <div className={p.kind === 'system' ? 'ink2' : undefined} style={{ whiteSpace: 'pre-wrap' }}>
          {msg.text}
        </div>
        {reactions.length > 0 && (
          <div className="reacts">
            {reactions.map(([emoji, who]) => (
              <span key={emoji} className="react" title={who.join(', ')}>
                {EMOJI[emoji] ?? emoji} {who.length}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
