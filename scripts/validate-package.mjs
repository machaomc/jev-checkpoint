import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
const root = resolve('plugins/jev-checkpoint');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const ajv = new Ajv2020({ strict: false });
for (const [file, schema] of [['plugin.json', 'plugin.schema.json'], ['mcp.json', 'mcp.schema.json']]) {
  const valid = ajv.compile(read(join('test/schemas', schema)));
  assert.ok(valid(read(join(root, file))), JSON.stringify(valid.errors));
}
const manifest = read(join(root, 'plugin.json'));
assert.equal(manifest.version, read('package.json').version);
const legacy = read(join(root, '.codex-plugin/plugin.json'));
assert.equal(manifest.name, legacy.name);
assert.equal(manifest.version, legacy.version);
assert.deepEqual(manifest.extensions['com.openai'].interface, legacy.interface);
assert.deepEqual(read(join(root, 'mcp.json')).mcpServers, read(join(root, '.mcp.json')).mcpServers);
const market = read('.agents/plugins/marketplace.json');
assert.equal(market.plugins.length, 1);
assert.equal(resolve(market.plugins[0].source.path), root);
assert.equal(market.plugins[0].name, manifest.name);
for (const file of ['dist/server.cjs', 'dist/THIRD_PARTY_LICENSES.txt', 'scripts/configure.mjs',
  'skills/jev-checkpoint/SKILL.md', 'skills/jev-checkpoint/agents/openai.yaml', 'skills/jev-checkpoint/references/setup.md']) {
  assert.ok(existsSync(join(root, file)), `Missing ${file}`);
}
function inspect(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    assert.ok(!lstatSync(path).isSymbolicLink(), 'Distribution cannot depend on external symlinks');
    assert.ok(!['node_modules', '.env', 'credentials.json'].includes(name), 'Unexpected private/runtime file in plugin');
    if (lstatSync(path).isDirectory()) inspect(path);
  }
}
inspect(root);
for (const [host, folder, variable] of [
  ['claude', '.claude-plugin', '${CLAUDE_PLUGIN_ROOT}'],
  ['workbuddy', '.codebuddy-plugin', '${CODEBUDDY_PLUGIN_ROOT}']
]) {
  const target = resolve(`packages/${host}/jev-checkpoint`);
  const hostManifest = read(join(target, folder, 'plugin.json'));
  assert.equal(hostManifest.name, manifest.name);
  assert.equal(hostManifest.version, manifest.version);
  const marketplace = read(join(folder, 'marketplace.json'));
  assert.equal(resolve(marketplace.plugins[0].source), target);
  assert.equal(marketplace.plugins[0].version, manifest.version);
  const config = read(join(target, '.mcp.json')).mcpServers['jev-checkpoint'];
  assert.equal(config.command, 'node');
  assert.deepEqual(config.args, [`${variable}/dist/server.cjs`]);
  for (const file of ['dist/server.cjs', 'dist/THIRD_PARTY_LICENSES.txt', 'scripts/configure.mjs', 'skills/jev-checkpoint/SKILL.md']) {
    assert.deepEqual(readFileSync(join(target, file)), readFileSync(join(root, file)));
  }
  if (host === 'workbuddy') {
    assert.equal(hostManifest.userConfig.api_key.sensitive, true);
    assert.equal(hostManifest.userConfig.api_key.default, '');
    assert.equal(config.env.JEV_CHECKPOINT_PLUGIN_KEY, '${user_config.api_key}');
  }
  inspect(target);
}
console.log('Three host packages: schemas, marketplace paths, metadata and common runtime verified.');
