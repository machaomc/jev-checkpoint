import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const result = await build({ entryPoints: ['src/server.ts'], outfile: 'plugins/jev-checkpoint/dist/server.cjs',
  bundle: true, platform: 'node', format: 'cjs', target: 'node20', minify: false,
  legalComments: 'external', metafile: true, sourcemap: false });
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs).filter(p => p.includes('node_modules/'))) {
  let directory = dirname(resolve(input));
  while (directory.includes('node_modules')) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.name) { packages.set(directory, pkg); break; }
    }
    directory = dirname(directory);
  }
}
const notices = [...packages.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([directory, pkg]) => {
  const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md'].map(p => join(directory, p)).find(existsSync);
  if (!license) throw Error(`Missing license for bundled dependency ${pkg.name}`);
  return `${pkg.name}@${pkg.version} (${pkg.license})\n${readFileSync(license, 'utf8')}`;
});
writeFileSync('plugins/jev-checkpoint/dist/THIRD_PARTY_LICENSES.txt', notices.join('\n\n---\n\n'));
console.log(`Built standalone MCP server; included notices for ${notices.length} dependencies.`);
