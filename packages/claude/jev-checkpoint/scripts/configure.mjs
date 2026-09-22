import { mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function hiddenInput() {
  if (!process.stdin.isTTY) throw Error('Use --stdin for a secure pipe, or run interactively in a terminal.');
  process.stderr.write('TypeSafe API key (hidden): ');
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  try {
    return await new Promise((resolve, reject) => {
      let text = '';
      function onData(chunk) {
        for (const char of chunk) {
          if (char === '\u0003' || char === '\u0004') { done(); reject(Error('Cancelled.')); return; }
          if (char === '\r' || char === '\n') { done(); resolve(text); return; }
          if (char === '\u007f' || char === '\b') text = text.slice(0, -1);
          else if (char >= ' ') text += char;
          if (text.length > 8192) { done(); reject(Error('Key is too long.')); return; }
        }
      }
      function done() { process.stdin.off('data', onData); }
      process.stdin.on('data', onData);
    });
  } finally { process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write('\n'); }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node configure.mjs [--stdin]\nReads a TypeSafe key without echo. Never pass a key as an argument.\nOptional JEV_CHECKPOINT_CONFIG selects a credential file.');
    return;
  }
  if (args.length > 1 || (args.length === 1 && args[0] !== '--stdin')) throw Error('Unexpected argument. Never pass API keys on the command line.');
  let key;
  if (args[0] === '--stdin') {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 8192) throw Error('Key is too long.');
    }
    key = input.trim();
  } else key = String(await hiddenInput()).trim();
  if (!key || key.length > 8192 || /\s/.test(key)) throw Error('Key must be nonempty and contain no whitespace.');
  const target = process.env.JEV_CHECKPOINT_CONFIG || join(homedir(), '.config', 'jev-checkpoint', 'credentials.json');
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify({ apiKey: key }) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(temporary, target);
  } finally { rmSync(temporary, { force: true }); }
  console.log('Credential saved locally. The key was not printed. Restart the MCP server if it previously inherited another key.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
