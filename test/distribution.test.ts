import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, cpSync, symlinkSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const hosts = [
  { name: 'codex', config: 'mcp.json', variable: '${PLUGIN_ROOT}' },
  { name: 'claude', config: '.mcp.json', variable: '${CLAUDE_PLUGIN_ROOT}' },
  { name: 'workbuddy', config: '.mcp.json', variable: '${CODEBUDDY_PLUGIN_ROOT}' }
];
function extract(bytes: Uint8Array, target: string) {
  for (const [name, content] of Object.entries(unzipSync(bytes))) {
    assert.ok(name.startsWith('jev-checkpoint/') && !name.split('/').includes('..') && !name.includes('\\'));
    const path = join(target, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

test('each ZIP contains its own installable marketplace with a resolving local plugin source', () => {
  for (const [host, folder] of [['codex', '.agents/plugins'], ['claude', '.claude-plugin'], ['workbuddy', '.codebuddy-plugin']]) {
    const pkg = unzipSync(readFileSync(`artifacts/jev-checkpoint-${host}-${version}.zip`));
    const manifest = pkg[`jev-checkpoint/${folder}/marketplace.json`];
    assert.ok(manifest, `${host} ZIP must be installable as a local marketplace`);
    const entry = JSON.parse(Buffer.from(manifest).toString('utf8')).plugins[0];
    const source = typeof entry.source === 'string' ? entry.source : entry.source.path;
    assert.ok(pkg[`jev-checkpoint/${source.replace(/^\.\//, '')}/dist/server.cjs`]);
  }
});

for (const host of hosts) test(`${host.name} ZIP starts its declared MCP from a path with spaces outside the repository`, async () => {
  const archive = resolve(`artifacts/jev-checkpoint-${host.name}-${version}.zip`);
  assert.ok(existsSync(archive), `Missing ${host.name} distribution`);
  const dir = mkdtempSync(join(tmpdir(), 'jev extracted package '));
  const client = new Client({ name: 'distribution-check', version: '1.0.0' });
  try {
    extract(readFileSync(archive), dir);
    const root = join(dir, 'jev-checkpoint/plugins/jev-checkpoint');
    const config = JSON.parse(readFileSync(join(root, host.config), 'utf8')).mcpServers['jev-checkpoint'];
    assert.equal(config.command, 'node');
    const expand = (s: string) => s.replaceAll(host.variable, root).replaceAll('${user_config.api_key}', '');
    const args = config.args.map(expand);
    assert.ok(args.every((arg: string) => !arg.includes('${')), 'All host placeholders must resolve');
    const env = Object.fromEntries(Object.entries(config.env || {}).map(([key, value]) => [key, expand(String(value))]));
    const transport = new StdioClientTransport({ command: process.execPath, args, cwd: dir,
      env: { ...env, JEV_API_KEY: '', JEV_CHECKPOINT_CONFIG: join(dir, 'absent.json') }, stderr: 'pipe' });
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.version, version);
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['jev_checkpoint_review', 'jev_checkpoint_status']);
    const status = (await client.callTool({ name: 'jev_checkpoint_status', arguments: {} })).structuredContent as Record<string, unknown>;
    assert.equal(status.ready, false);
    assert.ok(existsSync(String(status.configureScript)));
    const review = (await client.callTool({ name: 'jev_checkpoint_review', arguments: {
      checkpointId: 'distribution-smoke', task: 'Fix sum', diff: '-a-b\n+a+b'
    } })).structuredContent as { error: { code: string }; requestsRemaining: number };
    assert.equal(review.error.code, 'MISSING_API_KEY');
    assert.equal(review.requestsRemaining, 2);
  } finally { await client.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('all archives contain the same runtime and skill, exclude host-only metadata, and match published checksums', () => {
  const hashes = JSON.parse(readFileSync('artifacts/SHA256SUMS.json', 'utf8'));
  const packages = hosts.map(host => {
    const name = `jev-checkpoint-${host.name}-${version}.zip`;
    const bytes = readFileSync(join('artifacts', name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hashes[name]);
    return unzipSync(bytes);
  });
  for (const file of ['dist/server.cjs', 'skills/jev-checkpoint/SKILL.md', 'scripts/configure.mjs']) {
    assert.ok(packages[0][`jev-checkpoint/plugins/jev-checkpoint/${file}`]);
    assert.deepEqual(packages[0][`jev-checkpoint/plugins/jev-checkpoint/${file}`], packages[1][`jev-checkpoint/plugins/jev-checkpoint/${file}`]);
    assert.deepEqual(packages[0][`jev-checkpoint/plugins/jev-checkpoint/${file}`], packages[2][`jev-checkpoint/plugins/jev-checkpoint/${file}`]);
  }
  assert.ok(packages[0]['jev-checkpoint/plugins/jev-checkpoint/skills/jev-checkpoint/agents/openai.yaml']);
  for (const pkg of packages.slice(1)) assert.equal(pkg['jev-checkpoint/plugins/jev-checkpoint/skills/jev-checkpoint/agents/openai.yaml'], undefined);
});

test('WorkBuddy private option reaches the installed MCP without exposing its value in status', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-workbuddy-option-'));
  const client = new Client({ name: 'workbuddy-option-check', version: '1.0.0' });
  try {
    extract(readFileSync(`artifacts/jev-checkpoint-workbuddy-${version}.zip`), dir);
    const root = join(dir, 'jev-checkpoint/plugins/jev-checkpoint');
    const manifest = JSON.parse(readFileSync(join(root, '.codebuddy-plugin/plugin.json'), 'utf8'));
    assert.equal(manifest.userConfig.api_key.sensitive, true);
    const config = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers['jev-checkpoint'];
    const key = 'synthetic-host-option-for-status-only';
    const expand = (s: string) => s.replaceAll('${CODEBUDDY_PLUGIN_ROOT}', root).replaceAll('${user_config.api_key}', key);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: config.args.map(expand), cwd: dir,
      env: { ...Object.fromEntries(Object.entries(config.env).map(([k, v]) => [k, expand(String(v))])),
        JEV_API_KEY: '', JEV_CHECKPOINT_CONFIG: join(dir, 'absent.json') }, stderr: 'pipe' }));
    const result = await client.callTool({ name: 'jev_checkpoint_status', arguments: {} });
    const status = result.structuredContent as Record<string, unknown>;
    assert.equal(status.ready, true);
    assert.equal(status.credentialSource, 'plugin');
    assert.equal(status.authenticationVerified, false);
    assert.ok(!JSON.stringify(result).includes(key));
  } finally { await client.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('rebuilding distributions removes stale output and produces identical archives', async () => {
  const { generateDistributions } = await import('../scripts/package.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'jev-build-fixture-'));
  try {
    for (const path of ['packaging', 'shared', 'package.json', 'LICENSE']) cpSync(resolve(path), join(dir, path), { recursive: true });
    const bundle = join(dir, 'bundle');
    mkdirSync(bundle);
    writeFileSync(join(bundle, 'server.cjs'), '// fixture runtime\n');
    writeFileSync(join(bundle, 'THIRD_PARTY_LICENSES.txt'), 'fixture notices\n');
    generateDistributions(dir, bundle);
    const archive = join(dir, `artifacts/jev-checkpoint-workbuddy-${version}.zip`);
    const before = readFileSync(archive);
    const stale = join(dir, 'packages/workbuddy/jev-checkpoint/removed-template-file.txt');
    writeFileSync(stale, 'stale');
    generateDistributions(dir, bundle);
    assert.equal(existsSync(stale), false);
    assert.deepEqual(readFileSync(archive), before);
    if (process.platform !== 'win32') {
      symlinkSync(join(dir, 'package.json'), join(dir, 'shared/scripts/outside-link'));
      assert.throws(() => generateDistributions(dir, bundle), /symlink/i);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const resource of ['shared', 'packaging', 'bundle', 'LICENSE']) test(`packaging rejects a symlinked ${resource} input before replacing output`, { skip: process.platform === 'win32' }, async () => {
  const { generateDistributions } = await import('../scripts/package.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'jev-input-root-fixture-'));
  try {
    const root = join(dir, 'repo');
    mkdirSync(root);
    for (const path of ['packaging', 'shared', 'package.json', 'LICENSE']) cpSync(resolve(path), join(root, path), { recursive: true });
    const bundle = join(root, 'bundle');
    mkdirSync(bundle);
    writeFileSync(join(bundle, 'server.cjs'), '// fixture runtime\n');
    const input = join(root, resource);
    const external = join(dir, 'external-resource');
    renameSync(input, external);
    if (resource === 'LICENSE') writeFileSync(external, 'synthetic private content must never be packaged');
    symlinkSync(external, input);
    const sentinel = join(root, 'plugins/jev-checkpoint/existing.txt');
    mkdirSync(dirname(sentinel), { recursive: true });
    writeFileSync(sentinel, 'preserve existing output on invalid input');
    assert.throws(() => generateDistributions(root, bundle), /symlink/i);
    assert.equal(readFileSync(sentinel, 'utf8'), 'preserve existing output on invalid input');
    assert.equal(existsSync(join(root, 'artifacts')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
