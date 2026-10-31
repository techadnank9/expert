// Typed actions the specialist agents use to touch the case (HANDOFF 2.3 rule 4).
import { z } from 'zod';
import type { CaseStore } from './casestore';
import { SPECIALISTS, getAgent, getRelay } from './env';
import { postAsActor, replyAsActor } from './relay';

const availableTo = SPECIALISTS.map((name) => ({ name }));

/**
 * Registered on the case-actor AGENT client, not the workspace AgentRelay:
 * the SDK's workspace-scoped registerAction stays in-process only (see
 * agent-relay.js registerAction comment), so agents would never see the tools.
 * The agent client's registerAction publishes the descriptor with
 * handlerAgent=case-actor and handles action.invoked over its event stream.
 */
export async function registerActions(store: CaseStore) {
  const relay = getRelay();
  const host = (await getAgent('case-actor', 'system')) as any;
  const handles = [
    host.registerAction({
      name: 'post_recommendation',
      description: 'Appeals agent only, after policy and billing agree: post the bench recommendation into the case.',
      input: z.object({ caseId: z.string(), summary: z.string(), steps: z.array(z.string()), sources: z.array(z.string()) }),
      availableTo,
      handler: async ({ input, agent }: { input: any; agent: { name: string } }) => {
        const before = await store.getCase(input.caseId);
        let recommendationId: string | undefined;
        const root = before?.relay.threadRootId;
        const text = `**Recommendation** (from @${agent?.name ?? 'appeals'})\n${input.summary}\n${input.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nSources: ${input.sources.join('; ')}\nReact :+1: if you agree.`;
        if (root) recommendationId = await replyAsActor(root, text);
        else await postAsActor(input.caseId, text);
        if (recommendationId) await store.setRelayInfo(input.caseId, { recommendationId });
        await store.postRecommendation(input.caseId, { summary: input.summary, steps: input.steps, sources: input.sources, ...(recommendationId ? { messageId: recommendationId } : {}), by: agent?.name ?? 'appeals' } as any);
        return { ok: true, caseId: input.caseId, recommendationId };
      },
    }),
    host.registerAction({
      name: 'schedule_alarm',
      description: 'Schedule a case alarm: nudge the worker or escalate to the supervisor at an ISO time.',
      input: z.object({ caseId: z.string(), at: z.string().datetime({ offset: true }), kind: z.enum(['nudge', 'escalate']) }),
      availableTo,
      handler: async ({ input, agent }: { input: any; agent: { name: string } }) => {
        await store.scheduleAlarm(input.caseId, input.at, input.kind);
        await postAsActor(input.caseId, `Alarm scheduled by @${agent?.name}: ${input.kind} at ${input.at}`).catch(() => {});
        return { ok: true };
      },
    }),
    host.registerAction({
      name: 'request_document',
      description: 'Ask the poster for a document the bench needs (name and why).',
      input: z.object({ caseId: z.string(), name: z.string(), reason: z.string() }),
      availableTo,
      handler: async ({ input, agent }: { input: any; agent: { name: string } }) => {
        await store.requestDocument(input.caseId, { name: input.name, reason: input.reason, by: agent?.name ?? 'agent' });
        await postAsActor(input.caseId, `Document requested by @${agent?.name}: ${input.name} (${input.reason})`).catch(() => {});
        return { ok: true };
      },
    }),
  ];
  relay.addListener('action.*', (e: any) => console.log(`[action] ${e.type} ${e.action} by ${e.agent?.name ?? '?'}${e.error ? ` error=${e.error}` : ''}`));
  return () => handles.forEach((h: any) => h.unregister?.());
}
