import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('copied plugin starts without node_modules, discovers tools and safely reports missing credentials', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-standalone-'));
  const plugin = join(dir, 'plugin');
  cpSync(resolve('plugins/jev-checkpoint'), plugin, { recursive: true });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(plugin, 'dist/server.cjs')],
    cwd: dir, env: { JEV_API_KEY: '', JEV_CHECKPOINT_CONFIG: join(dir, 'absent.json') }, stderr: 'pipe' });
  const client = new Client({ name: 'checkpoint-test', version: '1.0.0' });
  let stderr = '';
  try {
    transport.stderr?.on('data', chunk => { stderr += chunk; });
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(t => t.name).sort(), ['jev_checkpoint_review', 'jev_checkpoint_status']);
    assert.equal(tools.tools.find(t => t.name === 'jev_checkpoint_review')?.annotations?.openWorldHint, true);
    const status = await client.callTool({ name: 'jev_checkpoint_status', arguments: {} });
    assert.equal((status.structuredContent as Record<string, unknown>)?.ready, false);
    const result = await client.callTool({ name: 'jev_checkpoint_review', arguments: { checkpointId: 'test', task: 'Fix add', diff: '-a-b\n+a+b' } });
    assert.equal(result.isError, true);
    assert.equal(((result.structuredContent as Record<string, unknown>)?.error as { code: string }).code, 'MISSING_API_KEY');
    assert.equal(stderr, '');
  } finally { await client.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('configure helper saves stdin credentials privately and rejects command-line secrets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-setup-'));
  const config = join(dir, 'config.json');
  const script = resolve('plugins/jev-checkpoint/scripts/configure.mjs');
  const env = { ...process.env, JEV_API_KEY: '', JEV_CHECKPOINT_CONFIG: config };
  try {
    const result = spawnSync(process.execPath, [script, '--stdin'], { input: 'test-setup-key\n', env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(config, 'utf8')).apiKey, 'test-setup-key');
    assert.ok(!(result.stdout + result.stderr).includes('test-setup-key'));
    if (process.platform !== 'win32') assert.equal(statSync(config).mode & 0o777, 0o600);
    const rejected = spawnSync(process.execPath, [script, 'secret-argv-key'], { env, encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.ok(!(rejected.stdout + rejected.stderr).includes('secret-argv-key'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
