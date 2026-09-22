import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { generateDistributions } from './package.mjs';

const bundleDirectory = resolve('work/build/runtime');
rmSync(bundleDirectory, { recursive: true, force: true });
mkdirSync(bundleDirectory, { recursive: true });
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const entries = { server: 'src/server.ts', cli: 'src/cli.ts' };
const metafiles = [];
for (const [name, entry] of Object.entries(entries)) {
  const result = await build({ entryPoints: [entry], outfile: join(bundleDirectory, `${name}.cjs`),
    bundle: true, platform: 'node', format: 'cjs', target: 'node20', minify: false,
    define: { __JEV_VERSION__: JSON.stringify(version) },
    legalComments: 'external', metafile: true, sourcemap: false });
  metafiles.push(result.metafile);
}
const packages = new Map();
for (const metafile of metafiles) for (const input of Object.keys(metafile.inputs).filter(p => p.includes('node_modules/'))) {
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
writeFileSync(join(bundleDirectory, 'THIRD_PARTY_LICENSES.txt'), notices.join('\n\n---\n\n'));
console.log(`Built standalone ${Object.keys(entries).join(' and ')} bundles; included notices for ${notices.length} dependencies.`);
generateDistributions(process.cwd(), bundleDirectory);
