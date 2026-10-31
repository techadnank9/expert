// One-time (idempotent) Relay setup: workspace + six participants.
import { AgentRelay } from '@agent-relay/sdk';
import { AGENTS, ENV_PATH, getAgent, loadEnv, persistEnv } from './env';

loadEnv();
if (!process.env.RELAY_WORKSPACE_KEY) {
  const relay = await AgentRelay.createWorkspace({ name: process.env.RELAY_WORKSPACE_NAME ?? 'understudy' });
  if (!relay.workspaceKey) throw new Error('createWorkspace returned no workspaceKey (name taken? set RELAY_WORKSPACE_NAME)');
  persistEnv('RELAY_WORKSPACE_KEY', relay.workspaceKey);
  console.log(`created workspace, key written to ${ENV_PATH}`);
} else {
  console.log('RELAY_WORKSPACE_KEY present, reusing workspace');
}

for (const a of AGENTS) {
  const c = await getAgent(a.name, a.type);
  console.log(`  ${a.type.padEnd(6)} ${c.handle ?? c.name}  id=${c.id}`);
}
console.log('setup ok');
process.exit(0);
