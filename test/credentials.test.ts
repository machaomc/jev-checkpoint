import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCredentials } from '../src/credentials.ts';

test('explicit environment key takes precedence over local file', () => {
  const result = readCredentials({ JEV_API_KEY: '  test-env-key  ', JEV_CHECKPOINT_CONFIG: '/missing/config.json' });
  assert.equal(result.apiKey, 'test-env-key');
  assert.equal(result.source, 'environment');
});
test('a missing config does not prevent no-key diagnostics', () => {
  const result = readCredentials({ JEV_CHECKPOINT_CONFIG: '/missing/config.json' });
  assert.equal(result.apiKey, undefined);
  assert.equal(result.source, 'missing');
});
test('host secret form works without a credential file and explicit environment takes precedence', () => {
  const env = { JEV_CHECKPOINT_PLUGIN_KEY: '  test-host-key  ', JEV_CHECKPOINT_CONFIG: '/missing/config.json' };
  assert.equal(readCredentials(env).apiKey, 'test-host-key');
  assert.equal(readCredentials(env).source, 'plugin');
  assert.equal(readCredentials({ ...env, JEV_API_KEY: 'test-explicit-key' }).apiKey, 'test-explicit-key');
});
test('an empty host secret form preserves the local-file fallback', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-empty-host-'));
  const config = join(dir, 'credentials.json');
  try {
    writeFileSync(config, JSON.stringify({ apiKey: 'test-file-key' }));
    const result = readCredentials({ JEV_CHECKPOINT_PLUGIN_KEY: '  ', JEV_CHECKPOINT_CONFIG: config });
    assert.equal(result.apiKey, 'test-file-key');
    assert.equal(result.source, 'file');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('GUI processes read a user-local credential file without inherited secrets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-config-'));
  const path = join(dir, 'credentials.json');
  try {
    writeFileSync(path, JSON.stringify({ apiKey: 'test-file-key' }), { mode: 0o600 });
    assert.equal(readCredentials({ JEV_CHECKPOINT_CONFIG: path }).apiKey, 'test-file-key');
    writeFileSync(path, '{"apiKey":123}');
    assert.throws(() => readCredentials({ JEV_CHECKPOINT_CONFIG: path }), /Invalid/);
    writeFileSync(path, 'secret-malformed-json');
    assert.throws(() => readCredentials({ JEV_CHECKPOINT_CONFIG: path }), error => !String(error).includes('secret-malformed-json'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
