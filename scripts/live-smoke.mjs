import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';

// Explicitly invoked only. Two real requests use synthetic code, never repository content.
const client = new Client({ name: 'jev-checkpoint-live-smoke', version: '0.1.0' });
const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string'));
const transport = new StdioClientTransport({ command: process.execPath,
  args: [resolve(process.env.JEV_CHECKPOINT_SERVER || 'plugins/jev-checkpoint/dist/server.cjs')], env, stderr: 'pipe' });
try {
  await client.connect(transport);
  const status = await client.callTool({ name: 'jev_checkpoint_status', arguments: {} });
  assert.equal(status.structuredContent?.ready, true, 'Configure a TypeSafe key locally before running the live smoke test.');
  const input = { checkpointId: 'synthetic-live-smoke', task: 'Implement add(a,b) for numeric inputs; add(2,3) must return 5.',
    diff: '-function add(a,b) { return a-b; }\n+function add(a,b) { return a+b; }',
    context: 'Self-contained arithmetic example, not production code. No authentication or persistence. Source inspection only; no runtime test has been run.' };
  const baseline = (await client.callTool({ name: 'jev_checkpoint_review', arguments: input })).structuredContent;
  assert.equal(baseline?.status, 'evaluated', `Live review failed: ${baseline?.error?.code ?? 'unknown'}`);
  const cached = (await client.callTool({ name: 'jev_checkpoint_review', arguments: input })).structuredContent;
  assert.equal(cached?.cached, true);
  const followup = (await client.callTool({ name: 'jev_checkpoint_review', arguments: { ...input,
    diff: input.diff + '\n+// regression test\n+assert.equal(add(2,3), 5);\n+assert.equal(add(-1,1), 0);' } })).structuredContent;
  assert.equal(followup?.status, 'evaluated', `Live follow-up failed: ${followup?.error?.code ?? 'unknown'}`);
  assert.equal(followup.requestsRemaining, 0);
  const blocked = (await client.callTool({ name: 'jev_checkpoint_review', arguments: { ...input, diff: '+ third version' } })).structuredContent;
  assert.equal(blocked?.error?.code, 'BUDGET_EXHAUSTED');
  console.log(JSON.stringify({ passed: true, model: baseline.model, networkAttempts: followup.attempts,
    cacheVerified: true, budgetVerified: true, baselineUsage: baseline.usage, followupUsage: followup.usage,
    baselineMetrics: baseline.metrics, followupMetrics: followup.metrics }, null, 2));
} finally { await client.close(); }
