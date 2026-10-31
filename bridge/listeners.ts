// Mirror Relay case channels into the case store (HANDOFF 2.3 rule 6).
import type { CaseStore, ThreadMessage } from './casestore';
import { normEmoji } from './casestore';
import { getAgent, getRelay } from './env';

const caseIdFromChannel = (name?: string) => (name?.replace(/^#/, '').startsWith('case-') ? name.replace(/^#/, '').slice(5) : undefined);

export function startListeners(store: CaseStore, log = (s: string) => console.log(s)) {
  const relay = getRelay();
  const seen = new Set<string>();

  const onMessage = async ({ message, envelope }: any) => {
    const chan = envelope?.channel?.name ?? message?.channel?.name;
    const caseId = caseIdFromChannel(chan);
    if (!caseId) return;
    const id = message.messageId ?? message.id;
    const parentId = envelope?.parent ?? message.parentId ?? message.threadId ?? undefined;
    let meta = (message.metadata ?? {}) as Record<string, any>;
    // The live event payload omits metadata; session_ref is only on the stored message.
    if (!meta.session_ref && message.from?.name !== 'maya' && message.from?.name !== 'case-actor') {
      try {
        const reader = await getAgent('dana', 'human');
        const full = await reader.messages.get(id);
        meta = (full.metadata ?? {}) as Record<string, any>;
      } catch {}
    }
    const author = (message.from?.name ?? envelope?.from?.name ?? meta.author ?? 'unknown').replace(/^@/, '');
    const msg: ThreadMessage = {
      id,
      author,
      address: meta.address ?? message.from?.id,
      sessionRef: meta.session_ref ?? meta.sessionRef,
      text: message.text ?? '',
      at: message.createdAt ?? new Date().toISOString(),
      reactions: {},
      ...(parentId && parentId !== id ? { parentId } : {}),
    };
    const first = !seen.has(id);
    seen.add(id);
    await store.appendThreadMessage(caseId, msg);
    if (first) log(`[mirror] #${chan} ${author}: ${msg.text.slice(0, 80)}${msg.sessionRef ? ` (session ${msg.sessionRef})` : ''}`);
  };

  const onReaction = async (e: { messageId: string; emoji: string; agentName: string; action: 'added' | 'removed' }) => {
    if (e.action !== 'added') return;
    const caseId = store.caseForMessage(e.messageId);
    if (!caseId) return;
    const state = await store.addReaction(caseId, e.messageId, e.emoji, e.agentName);
    log(`[mirror] reaction ${normEmoji(e.emoji)} by ${e.agentName} on ${e.messageId} (case ${caseId})`);
    if (state.relay.recommendationId === e.messageId && normEmoji(e.emoji) === ':+1:') {
      const m = state.thread.find((x) => x.id === e.messageId);
      await store.setAgrees(caseId, m?.reactions[':+1:'] ?? []);
    }
  };

  const offs = [
    relay.addListener('message.created', onMessage),
    relay.addListener('thread.reply', onMessage),
    relay.addListener('message.reacted', onReaction as any),
  ];
  return () => offs.forEach((f) => f());
}
