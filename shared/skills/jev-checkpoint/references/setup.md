# Setup and recovery

Requires Node.js 20+ on the machine running MCP and a TypeSafe key from https://console.typesafe.ai/. The server calls TypeSafe directly, not Vercel AI Gateway. A coding assistant subscription does not supply this key.

Install the complete package for the current host: Codex, Claude Code or WorkBuddy. A copied SKILL.md alone does not provide the bundled MCP server. See the installed package's README.md or https://github.com/machaomc/jev-checkpoint for host-specific installation instructions.

Discover the actual namespaced Jev Checkpoint status/review tools. If status reports ready, no further credential setup is needed; readiness is not a successful authentication test.

If not configured, users may enter a key into WorkBuddy's private plugin configuration form. On every host, the status tool also returns configureScript: run `node "<that absolute path>"` in a terminal and enter the key at the hidden prompt. Never run the helper with a secret as an argument or ask for a key in chat. The helper saves a plaintext user-local file at `~/.config/jev-checkpoint/credentials.json`, with POSIX permissions 0600. Windows users should keep it in their private user profile. It is separate from plugin caches.

Credential priority: nonempty JEV_API_KEY, then nonempty JEV_CHECKPOINT_PLUGIN_KEY injected by the host, then the local file. An empty form does not disable fallback. JEV_CHECKPOINT_CONFIG selects another file only when both the helper and MCP process inherit it. Same-user local hosts can use the same file; remote machines and sandboxed hosts need their own configuration. Credentials do not carry checkpoint counters across processes.

- Missing tools: confirm the full host package is installed/enabled and Node is on the host PATH. Open a new session or use the host's documented plugin reload. Continue locally and disclose a skipped evaluation until tools are available.
- MISSING_API_KEY / INVALID_CONFIG: use the private host form or configure helper; do not display credential files.
- AUTH_FAILED: correct the TypeSafe key before considering a retry within the remaining task budget.
- CONTEXT_TOO_LARGE: select a coherent, smaller task-owned diff and context.
- SENSITIVE_CONTEXT: remove secrets and credential files. Heuristic detection is not a complete scanner.
- BUDGET_EXHAUSTED: continue local verification; do not rotate IDs, restart or switch hosts to obtain more attempts.
- Other API errors: report the failed evaluation; no automatic retries. Never output authorization headers or full raw upstream error bodies.

Do not install unrelated plugins, change permissions, alter unrelated MCP definitions, or reset budgets merely to make a review happen.
