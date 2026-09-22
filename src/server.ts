import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { dirname, resolve } from 'node:path';
import { CheckpointService, ENDPOINT, MAX_ATTEMPTS } from './engine.js';
import { readCredentials } from './credentials.js';
import { reviewSchema, MAX_CONTEXT_BYTES } from './input.js';

declare const __JEV_VERSION__: string;
const server = new McpServer({ name: 'jev-checkpoint', version: __JEV_VERSION__ }, {
  instructions: 'Jev supplies quality signals, not defect explanations. Call status before first use. Submit only task-owned, nonsecret context. Reuse one checkpointId per task: at most two outgoing attempts per MCP process, including failures. Never reset IDs to evade that limit. Inspect code before acting on scores. Tests and user requirements take precedence.'
});
const service = new CheckpointService({ getApiKey: () => readCredentials().apiKey });
server.registerTool('jev_checkpoint_status', {
  description: 'Check local configuration without calling Jev or printing credentials. Ready means configured, not authenticated.',
  inputSchema: {}, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }
}, async () => {
  let ready = false, source = 'invalid';
  try { const credentials = readCredentials(); ready = Boolean(credentials.apiKey); source = credentials.source; } catch { /* Sanitized state only. */ }
  const result = { ready, credentialSource: source, authenticationVerified: false,
    configureScript: resolve(dirname(process.argv[1]), '../scripts/configure.mjs'),
    endpoint: ENDPOINT, model: 'jev-latest', maxAttemptsPerCheckpoint: MAX_ATTEMPTS, maxContextBytes: MAX_CONTEXT_BYTES,
    budgetScope: 'checkpoint ID within this MCP process; resets on restart; not an account spending cap' };
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
});
server.registerTool('jev_checkpoint_review', {
  description: 'Send a focused diff to TypeSafe Jev for six independent 0–4 quality scores. Uses your paid API key. Two attempts per task checkpoint; failures count. Identical successful inputs are cached. Does not read or edit repository files.',
  inputSchema: reviewSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: false }
}, async input => {
  const result = await service.review(input);
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: result.status !== 'evaluated' };
});

async function main() {
  await server.connect(new StdioServerTransport());
}
main().catch(() => { process.stderr.write('Jev Checkpoint could not start. Verify Node.js 20+ and the plugin installation.\n'); process.exitCode = 1; });
