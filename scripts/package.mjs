import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, lstatSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
const encoder = new TextEncoder();
const zipOptions = { mtime: new Date(2020, 0, 1), os: 3, attrs: 0o100644 << 16 };

const hosts = {
  codex: 'plugins/jev-checkpoint',
  claude: 'packages/claude/jev-checkpoint',
  workbuddy: 'packages/workbuddy/jev-checkpoint'
};
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
function inputStat(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw Error(`Refusing symlink in package resources: ${path}`);
  return stat;
}
function files(directory, prefix = '') {
  if (!inputStat(directory).isDirectory()) throw Error(`Expected package resource directory: ${directory}`);
  return readdirSync(directory).sort().flatMap(name => {
    const relative = prefix ? `${prefix}/${name}` : name;
    const path = join(directory, name);
    const stat = inputStat(path);
    if (stat.isDirectory()) return files(path, relative);
    if (!stat.isFile()) throw Error(`Unsupported package resource: ${relative}`);
    if (/^(\.env(?:\..*)?|credentials\.json|node_modules)$/i.test(name)) throw Error(`Private resource in package: ${relative}`);
    return [relative];
  });
}
function copyTree(source, destination) {
  for (const file of files(source)) {
    const target = join(destination, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(source, file), target);
  }
}

export function generateDistributions(root, bundleDirectory) {
  // Validate all inputs before replacing any generated output.
  for (const folder of ['shared', 'packaging']) files(join(root, folder));
  files(bundleDirectory);
  if (!inputStat(join(root, 'LICENSE')).isFile()) throw Error('Expected LICENSE to be a regular file');
  const { version } = readJson(join(root, 'package.json'));
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) throw Error('Invalid package version');
  const metadata = { ...readJson(join(root, 'packaging/metadata.json')), version };
  if (metadata.name !== 'jev-checkpoint') throw Error('Unexpected plugin identity');
  const checksums = {};
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  for (const [host, relative] of Object.entries(hosts)) {
    const output = join(root, relative);
    rmSync(output, { recursive: true, force: true });
    mkdirSync(output, { recursive: true });
    copyTree(join(root, 'shared'), output);
    copyTree(bundleDirectory, join(output, 'dist'));
    copyFileSync(join(root, 'LICENSE'), join(output, 'LICENSE'));
    copyFileSync(join(root, `packaging/${host}/README.md`), join(output, 'README.md'));
    const mcp = readJson(join(root, `packaging/${host}/mcp.json`));
    writeJson(join(output, '.mcp.json'), mcp);
    let marketplace;
    let marketplaceFolder;
    if (host === 'codex') {
      const ui = readJson(join(root, 'packaging/codex/interface.json'));
      writeJson(join(output, 'plugin.json'), {
        $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', ...metadata,
        extensions: { 'com.openai': { interface: ui } }
      });
      writeJson(join(output, '.codex-plugin/plugin.json'), { ...metadata, skills: './skills/', mcpServers: './.mcp.json', interface: ui });
      writeJson(join(output, 'mcp.json'), { $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', ...mcp });
      copyTree(join(root, 'packaging/codex/agents'), join(output, 'skills/jev-checkpoint/agents'));
      marketplaceFolder = '.agents/plugins';
      marketplace = {
        name: metadata.name, interface: { displayName: 'Jev Checkpoint' },
        plugins: [{ name: metadata.name, source: { source: 'local', path: './plugins/jev-checkpoint' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Developer Tools' }]
      };
    } else {
      const folder = host === 'claude' ? '.claude-plugin' : '.codebuddy-plugin';
      const userConfig = host === 'workbuddy' ? readJson(join(root, 'packaging/workbuddy/user-config.json')) : undefined;
      writeJson(join(output, folder, 'plugin.json'), { ...metadata, ...(userConfig ? { userConfig } : {}) });
      marketplaceFolder = folder;
      marketplace = {
        name: metadata.name, owner: { name: metadata.author.name }, metadata: { description: `Jev Checkpoint for ${host === 'claude' ? 'Claude Code' : 'WorkBuddy'}` },
        plugins: [{ name: metadata.name, source: `./${relative}`, description: metadata.description, version }]
      };
    }
    writeJson(join(root, marketplaceFolder, 'marketplace.json'), marketplace);
    const entries = {};
    for (const file of files(output)) entries[`jev-checkpoint/plugins/jev-checkpoint/${file}`] = [readFileSync(join(output, file)), zipOptions];
    const localMarketplace = structuredClone(marketplace);
    localMarketplace.plugins[0].source = host === 'codex' ? { source: 'local', path: './plugins/jev-checkpoint' } : './plugins/jev-checkpoint';
    entries[`jev-checkpoint/${marketplaceFolder}/marketplace.json`] = [encoder.encode(JSON.stringify(localMarketplace, null, 2) + '\n'), zipOptions];
    entries['jev-checkpoint/README.md'] = [readFileSync(join(output, 'README.md')), zipOptions];
    const archive = zipSync(entries, { level: 9 });
    const name = `jev-checkpoint-${host}-${version}.zip`;
    writeFileSync(join(root, 'artifacts', name), archive);
    checksums[name] = createHash('sha256').update(archive).digest('hex');
  }
  writeJson(join(root, 'artifacts/SHA256SUMS.json'), checksums);
  console.log(`Generated ${Object.keys(hosts).join(', ')} packages and ZIP archives (${version}).`);
}
