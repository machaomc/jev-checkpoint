import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { CheckpointService, ENDPOINT, MAX_ATTEMPTS } from './engine.js';
import { readCredentials } from './credentials.js';
import { MAX_CONTEXT_BYTES } from './input.js';

declare const __JEV_VERSION__: string;

const ENTRY_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const MAX_STATE_BYTES = 262144;

type Entry = { task: string; attempts: number; updatedAt: number };

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function stateFile(): string | undefined {
  const configured = process.env.JEV_CHECKPOINT_STATE?.trim();
  if (configured && configured.toLowerCase() === 'off') return undefined;
  if (configured) return configured;
  return join(homedir(), '.config', 'jev-checkpoint', 'checkpoints.json');
}

// The credential helper sits beside the CLI in a skill-market install and one level up in a plugin install.
function configureScript(): string {
  const here = dirname(resolve(process.argv[1]));
  const candidates = [join(here, 'configure.mjs'), join(here, '..', 'scripts', 'configure.mjs')];
  return candidates.find(existsSync) ?? candidates[0];
}

function loadState(path: string | undefined): Record<string, Entry> {
  if (!path) return {};
  try {
    if (statSync(path).size > MAX_STATE_BYTES) return {};
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !('checkpoints' in parsed)) return {};
    const store = (parsed as { checkpoints?: unknown }).checkpoints;
    if (!store || typeof store !== 'object') return {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(store as Record<string, Entry>)
      .filter(([, entry]) => entry && typeof entry.attempts === 'number' && typeof entry.updatedAt === 'number'
        && now - entry.updatedAt < ENTRY_TTL_MS));
  } catch {
    return {};
  }
}

function saveState(path: string | undefined, store: Record<string, Entry>): void {
  if (!path) return;
  const entries = Object.entries(store).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_ENTRIES);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify({ checkpoints: Object.fromEntries(entries) }, null, 2)}\n`,
      { mode: 0o600, flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function usage(): string {
  return [
    'Jev Checkpoint CLI',
    '',
    'Usage:',
    '  node cli.cjs status',
    '  node cli.cjs review <payload.json|->',
    '',
    'review reads a JSON object from a file or stdin holding: checkpointId, task, diff,',
    'and optional context / files. It prints one JSON object on stdout and exits non-zero',
    'unless status is "evaluated". Pass the payload as a file or stdin, never as a command',
    'argument.',
    '',
    `Two outgoing attempts are allowed per checkpoint ID, counted for this user across CLI`,
    `invocations; recorded entries expire after ${ENTRY_TTL_MS / 3600000} hours. Failures count and identical`,
    'successful inputs are cached. Do not rotate IDs, restart or switch interfaces to obtain',
    'more attempts.',
    '',
    'A TypeSafe key is required. Configure it with: node configure.mjs'
  ].join('\n');
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const store = stateFile();
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (command === 'status') {
    let ready = false;
    let source = 'invalid';
    try {
      const credentials = readCredentials();
      ready = Boolean(credentials.apiKey);
      source = credentials.source;
    } catch { /* Report sanitized state only. */ }
    const script = configureScript();
    emit({
      ready, credentialSource: source, authenticationVerified: false,
      configureScript: script, cliScript: resolve(process.argv[1]),
      endpoint: ENDPOINT, model: 'jev-latest', version: __JEV_VERSION__,
      maxAttemptsPerCheckpoint: MAX_ATTEMPTS, maxContextBytes: MAX_CONTEXT_BYTES,
      interface: 'cli', stateFile: store ?? 'disabled',
      budgetScope: `checkpoint ID recorded for this user across CLI invocations; entries expire after ${ENTRY_TTL_MS / 3600000} hours; not an account spending cap`
    });
    return;
  }
  if (command !== 'review') {
    emit({ status: 'blocked', error: { code: 'CLI_ERROR', message: `Unknown command: ${command}. Run with --help.` } });
    process.exitCode = 1;
    return;
  }
  if (rest.length > 1) {
    emit({ status: 'blocked', error: { code: 'CLI_ERROR', message: 'review accepts at most one payload path; use - or omit it to read stdin.' } });
    process.exitCode = 1;
    return;
  }
  const source = rest[0] && rest[0] !== '-' ? rest[0] : undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(source ?? 0, 'utf8'));
  } catch {
    emit({ status: 'blocked', error: { code: 'INVALID_INPUT', message: 'Payload must be a JSON object read from a file path or stdin. Do not pass payload content as a shell argument.' } });
    process.exitCode = 1;
    return;
  }
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const checkpointId = typeof record.checkpointId === 'string' ? record.checkpointId.trim() : '';
  const task = typeof record.task === 'string' ? record.task : '';
  const known = checkpointId ? loadState(store)[checkpointId] : undefined;
  if (known && known.attempts >= MAX_ATTEMPTS) {
    emit({
      status: 'blocked', checkpointId, attempts: known.attempts, requestsRemaining: 0,
      error: {
        code: 'BUDGET_EXHAUSTED',
        message: 'Two outgoing attempts were already used for this checkpoint on this machine. Continue local validation; do not rotate IDs or switch interfaces to obtain more attempts.'
      }
    });
    process.exitCode = 1;
    return;
  }
  if (known && task && known.task !== task) {
    emit({
      status: 'blocked', checkpointId, attempts: known.attempts,
      requestsRemaining: Math.max(0, MAX_ATTEMPTS - known.attempts),
      error: { code: 'TASK_MISMATCH', message: 'This checkpoint ID was used for a different task on this machine. A genuinely different task needs its own ID.' }
    });
    process.exitCode = 1;
    return;
  }
  const service = new CheckpointService({ getApiKey: () => readCredentials().apiKey });
  const result = await service.review(raw) as Record<string, unknown>;
  const consumed = typeof result.attempts === 'number' ? result.attempts : 0;
  if (checkpointId && consumed > 0) {
    const current = loadState(store);
    const prior = current[checkpointId];
    current[checkpointId] = {
      task: prior?.task ?? task,
      attempts: Math.max(prior?.attempts ?? 0, consumed),
      updatedAt: Date.now()
    };
    saveState(store, current);
  }
  emit(result);
  if (result.status !== 'evaluated') process.exitCode = 1;
}

main().catch(error => {
  emit({ status: 'blocked', error: { code: 'CLI_ERROR', message: String((error as Error)?.message ?? error) } });
  process.exitCode = 1;
});
