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
