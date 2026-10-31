// Subscribe to Case actor broadcasts and perform the Relay side effects the
// actor cannot do itself: 'asked' -> maya posts in #case-<id>; 'alarm_fired'
// -> webhook post as case-actor; approval/override/escalate events -> post.
import type { TerseCaseStore } from './casestore';
import { approveAsWorker, askAsWorker, openCaseChannel, postAsActor, rememberWebhook } from './relay';

export async function watchCase(store: TerseCaseStore, caseId: string) {
  const s = await store.getCase(caseId);
  if (!s) { console.warn(`[terse-ws] case ${caseId} does not exist`); return; }
  if (s.relay?.webhookUrl && s.relay?.webhookToken) rememberWebhook(caseId, s.relay.webhookUrl, s.relay.webhookToken);
  else {
    const r = await openCaseChannel(caseId, s.title);
    await store.setRelayInfo(caseId, r);
    console.log(`[terse-ws] #case-${caseId} ready, relay info stored on actor`);
  }
  const connect = async (attempt = 0): Promise<void> => {
    let url: string;
    try { url = await store.wsUrl('Case', caseId, 'bridge'); }
    catch (e) { console.warn(`[terse-ws] prepareWebsocket ${caseId}:`, (e as Error).message); setTimeout(() => connect(attempt + 1), 3000); return; }
    const ws = new WebSocket(url);
    ws.onopen = () => console.log(`[terse-ws] subscribed to Case:${caseId}`);
    ws.onmessage = async (ev) => {
      let m: any;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      try {
        if (m.type === 'asked') {
          const threadRootId = await askAsWorker(caseId, m.question);
          await store.setRelayInfo(caseId, { threadRootId });
          console.log(`[terse-ws] Case:${caseId} asked -> #case-${caseId} root ${threadRootId}`);
        } else if (m.type === 'alarm_fired') {
          const st = await store.getCase(caseId);
          await postAsActor(caseId, `Alarm fired: ${m.alarm?.kind} (${m.alarm?.id}, due ${m.alarm?.at}). Status: ${st?.status}.`);
          console.log(`[terse-ws] Case:${caseId} alarm ${m.alarm?.id} -> webhook`);
        } else if (m.type === 'event') {
          if (m.event === 'recommendation_approved') {
            const st = await store.getCase(caseId);
            if (st?.relay.recommendationId) await approveAsWorker(st.relay.recommendationId);
            await postAsActor(caseId, `Approval recorded: ${st?.worker?.name ?? 'worker'} approved the recommendation.`);
          } else {
            await postAsActor(caseId, `Case event: ${m.event}${m.reason ? ` (${m.reason})` : ''}`);
          }
        }
      } catch (e) {
        console.warn(`[terse-ws] side effect for ${m.type} failed:`, (e as Error).message);
      }
    };
    ws.onclose = () => { console.warn(`[terse-ws] Case:${caseId} socket closed, reconnecting`); setTimeout(() => connect(attempt + 1), 2000); };
    ws.onerror = () => {};
  };
  await connect();
}
