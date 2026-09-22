import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
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
for (const file of ['dist/server.cjs', 'dist/cli.cjs', 'dist/THIRD_PARTY_LICENSES.txt', 'scripts/configure.mjs',
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
  for (const file of ['dist/server.cjs', 'dist/cli.cjs', 'dist/THIRD_PARTY_LICENSES.txt', 'scripts/configure.mjs', 'skills/jev-checkpoint/SKILL.md']) {
    assert.deepEqual(readFileSync(join(target, file)), readFileSync(join(root, file)));
  }
  if (host === 'workbuddy') {
    assert.equal(hostManifest.userConfig.api_key.sensitive, true);
    assert.equal(hostManifest.userConfig.api_key.default, '');
    assert.equal(config.env.JEV_CHECKPOINT_PLUGIN_KEY, '${user_config.api_key}');
  }
  inspect(target);
}
const skillRoot = resolve('packages/workbuddy-skill/jev-checkpoint');
const skillEntries = [];
(function collect(directory, prefix) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    assert.ok(!lstatSync(path).isSymbolicLink(), 'Skill package cannot depend on external symlinks');
    assert.ok(!['node_modules', '.env', 'credentials.json'].includes(name), 'Unexpected private/runtime file in skill package');
    const relative = prefix ? `${prefix}/${name}` : name;
    if (lstatSync(path).isDirectory()) collect(path, relative);
    else skillEntries.push(relative);
  }
})(skillRoot, '');
skillEntries.sort();
assert.deepEqual(skillEntries, ['LICENSE', 'SKILL.md', 'references/setup.md',
  'scripts/THIRD_PARTY_LICENSES.txt', 'scripts/cli.cjs', 'scripts/configure.mjs'],
  'Skill package must ship exactly the instructions, the CLI and the credential helper');
for (const entry of skillEntries) assert.ok(entry.split('/').length <= 3,
  `Skill entry is nested deeper than the two-level marketplace limit: ${entry}`);
const skillMarkdown = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8');
const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skillMarkdown);
assert.ok(frontmatter, 'Skill SKILL.md must start with YAML frontmatter');
for (const field of ['name', 'description', 'description_zh', 'description_en', 'display_name', 'display_name_en', 'author']) {
  assert.match(frontmatter[1], new RegExp(`^${field}: `, 'm'), `Skill frontmatter is missing ${field}`);
}
const declaredVersion = /^version: (.*)$/m.exec(frontmatter[1]);
assert.ok(declaredVersion, 'Skill frontmatter is missing version');
assert.equal(JSON.parse(declaredVersion[1]), manifest.version);
const skillBody = text => text.slice(text.indexOf('\n---\n', 4) + 5);
assert.equal(skillBody(skillMarkdown), skillBody(readFileSync(join(root, 'skills/jev-checkpoint/SKILL.md'), 'utf8')),
  'Skill body must stay the shared skill body, not a fork');
assert.deepEqual(readFileSync(join(skillRoot, 'LICENSE')), readFileSync('LICENSE'));
assert.deepEqual(readFileSync(join(skillRoot, 'references/setup.md')), readFileSync(join(root, 'skills/jev-checkpoint/references/setup.md')));
assert.deepEqual(readFileSync(join(skillRoot, 'scripts/cli.cjs')), readFileSync(join(root, 'dist/cli.cjs')));
assert.deepEqual(readFileSync(join(skillRoot, 'scripts/configure.mjs')), readFileSync(join(root, 'scripts/configure.mjs')));
assert.deepEqual(readFileSync(join(skillRoot, 'scripts/THIRD_PARTY_LICENSES.txt')), readFileSync(join(root, 'dist/THIRD_PARTY_LICENSES.txt')));
const skillName = `jev-checkpoint-skill-${manifest.version}.zip`;
const skillArchive = readFileSync(join('artifacts', skillName));
assert.ok(skillArchive.length <= 3 * 1024 * 1024, 'Skill archive exceeds the 3 MB marketplace limit');
assert.equal(createHash('sha256').update(skillArchive).digest('hex'), read('artifacts/SHA256SUMS.json')[skillName]);
const skillZip = unzipSync(skillArchive);
assert.deepEqual(Object.keys(skillZip).sort(), skillEntries.map(entry => `jev-checkpoint/${entry}`));
assert.equal(Buffer.from(skillZip['jev-checkpoint/SKILL.md']).toString('utf8'), skillMarkdown);
assert.ok(Buffer.from(skillZip['jev-checkpoint/scripts/cli.cjs']).equals(readFileSync(join(root, 'dist/cli.cjs'))));
console.log('Four packages: plugin schemas, marketplaces, shared runtime and the skill archive verified.');
