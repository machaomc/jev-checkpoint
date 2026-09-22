import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = resolve(process.argv[2] || 'plugins/jev-checkpoint');
const configuration = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers['jev-checkpoint'];
const expand = value => value.replace(/\$\{(?:PLUGIN_ROOT|CLAUDE_PLUGIN_ROOT|CODEBUDDY_PLUGIN_ROOT)\}/g, () => root).replaceAll('${user_config.api_key}', '');
const dir = mkdtempSync(join(tmpdir(), 'jev-installed-smoke-'));
const client = new Client({ name: 'installed-plugin-check', version: '0.1.0' });
try {
  await client.connect(new StdioClientTransport({ command: configuration.command,
    args: configuration.args.map(expand),
    cwd: root, env: { JEV_API_KEY: '', JEV_CHECKPOINT_PLUGIN_KEY: '', JEV_CHECKPOINT_CONFIG: join(dir, 'missing.json') }, stderr: 'pipe' }));
  const catalog = await client.listTools();
  assert.deepEqual(catalog.tools.map(t => t.name).sort(), ['jev_checkpoint_review', 'jev_checkpoint_status']);
  const status = (await client.callTool({ name: 'jev_checkpoint_status', arguments: {} })).structuredContent;
  assert.equal(status.ready, false);
  assert.equal(status.authenticationVerified, false);
  assert.ok(existsSync(status.configureScript));
  const result = await client.callTool({ name: 'jev_checkpoint_review', arguments: { checkpointId: 'installation-smoke', task: 'Fix sum', diff: '-a-b\n+a+b' } });
  assert.equal(result.structuredContent.error.code, 'MISSING_API_KEY');
  assert.equal(result.structuredContent.requestsRemaining, 2);
  assert.equal(result.isError, true);

  // The bundled CLI must work from the same installation, with no build step and no MCP host.
  const cli = join(root, 'dist/cli.cjs');
  assert.ok(existsSync(cli), 'An installed plugin must ship the bundled CLI');
  const cliEnv = { ...process.env, JEV_API_KEY: '', JEV_CHECKPOINT_PLUGIN_KEY: '',
    JEV_CHECKPOINT_CONFIG: join(dir, 'missing.json'), JEV_CHECKPOINT_STATE: join(dir, 'ledger.json') };
  const cliStatus = spawnSync(process.execPath, [cli, 'status'], { encoding: 'utf8', cwd: root, env: cliEnv });
  assert.equal(cliStatus.status, 0, cliStatus.stderr);
  const reported = JSON.parse(cliStatus.stdout);
  assert.equal(reported.interface, 'cli');
  assert.equal(reported.ready, false);
  assert.equal(reported.authenticationVerified, false);
  assert.equal(resolve(reported.configureScript), join(root, 'scripts', 'configure.mjs'));
  assert.ok(existsSync(reported.configureScript));
  const cliReview = spawnSync(process.execPath, [cli, 'review', '-'],
    { input: JSON.stringify({ checkpointId: 'installation-cli-smoke', task: 'Fix sum', diff: '-a-b\n+a+b' }),
      encoding: 'utf8', cwd: root, env: cliEnv });
  assert.equal(cliReview.status, 1);
  const blocked = JSON.parse(cliReview.stdout);
  assert.equal(blocked.error.code, 'MISSING_API_KEY');
  assert.equal(blocked.requestsRemaining, 2);

  console.log(JSON.stringify({ passed: true, pluginRoot: root, tools: catalog.tools.map(t => t.name),
    configureScriptExists: true, missingKeyHandled: true, cliReported: true, paidRequests: 0 }, null, 2));
} finally { await client.close(); rmSync(dir, { recursive: true, force: true }); }
