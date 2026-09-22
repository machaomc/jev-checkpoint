# Setup and recovery

Requires Node.js 20+ on the machine that runs Jev — the bundled MCP server or the bundled CLI — and a TypeSafe key from https://console.typesafe.ai/. Jev calls TypeSafe directly, not Vercel AI Gateway. A coding assistant subscription does not supply this key.

Install a complete package through your host's channel. A copied SKILL.md alone provides neither interface.

| Channel | Provides | Install |
| --- | --- | --- |
| Codex, Claude Code, WorkBuddy native plugin | MCP server (`dist/server.cjs`) **and** the CLI (`dist/cli.cjs`) | host plugin marketplace; see the package README |
| WorkBuddy skill marketplace | The CLI only (`scripts/cli.cjs`); no MCP server | install the skill archive |

Both interfaces share the endpoint, rubric, input limits, attempt budget and error codes. Choose one per task.

## Check status

- MCP: call the advertised namespaced `jev_checkpoint_status` tool.
- CLI: `node "<cliScript>" status`, where `cliScript` is the absolute path reported by an earlier status call, or the bundled file itself.

`ready: true` means a credential is present; it is not a successful authentication test.

## Configure the credential

1. Plugin form: WorkBuddy exposes a private `api_key` plugin option. Leaving it blank preserves the environment and file fallback.
2. Helper script: run `node "<absolute path>"` in your own terminal and enter the key at the hidden prompt. The path is returned as `configureScript`: beside the CLI in a skill install (`scripts/configure.mjs`), one level up in a plugin install. Never pass a key as an argument; `--stdin` supports secret-manager pipes.

The helper saves a plaintext user-local file at `~/.config/jev-checkpoint/credentials.json` with POSIX mode 0600. Windows users should keep it in their private user profile. It is separate from plugin caches.

Credential priority: nonempty `JEV_API_KEY`, then nonempty `JEV_CHECKPOINT_PLUGIN_KEY` injected by the host, then the local file. An empty form does not disable fallback. `JEV_CHECKPOINT_CONFIG` selects another file only when both the helper and the Jev process inherit it. Same-user local hosts can share one file; remote machines and sandboxed hosts need their own.

## Attempt budget

Two outgoing attempts per checkpoint ID, failures included; identical successful inputs are cached. MCP keeps its counter in that server process. The CLI records the count per user and machine at `~/.config/jev-checkpoint/checkpoints.json` — `JEV_CHECKPOINT_STATE` selects another path and `off` disables it — and entries expire after twelve hours. Neither interface resets the other, so do not switch interfaces to obtain more attempts.

## Recovery

- Missing tools: confirm the full host package is installed/enabled and Node is on the host PATH. Open a new session or use the host's documented plugin reload. Continue locally and disclose a skipped evaluation until tools are available.
- `MISSING_API_KEY` / `INVALID_CONFIG`: use the private host form or configure helper; do not display credential files.
- `AUTH_FAILED`: correct the TypeSafe key before considering a retry within the remaining task budget.
- `CONTEXT_TOO_LARGE`: select a coherent, smaller task-owned diff and context.
- `SENSITIVE_CONTEXT`: remove secrets and credential files. Heuristic detection is not a complete scanner.
- `BUDGET_EXHAUSTED`: continue local verification; do not rotate IDs, restart or switch interfaces to obtain more attempts.
- `TASK_MISMATCH` (CLI): this ID already carried different task wording on this machine; a genuinely different task needs its own ID.
- `INVALID_INPUT` (CLI): the payload was not a JSON object read from a file or stdin. Never pass payload content as a shell argument.
- `CLI_ERROR` (CLI): unknown command or an unexpected failure; run the CLI with `--help`.
- Other API errors: report the failed evaluation; no automatic retries. Never output authorization headers or full raw upstream error bodies.

Do not install unrelated plugins, change permissions, alter unrelated MCP definitions, or reset budgets merely to make a review happen.
