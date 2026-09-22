# Setup and recovery

Requires Node.js 20+ on the Codex host and a TypeSafe key from https://console.typesafe.ai/. The bundled server calls TypeSafe directly, not Vercel AI Gateway. Codex/ChatGPT subscription access does not supply this key.

From a repository clone, run:

```sh
node plugins/jev-checkpoint/scripts/configure.mjs
```

From an installed plugin, ask `jev_checkpoint_status` for `configureScript` and run that file with Node in a terminal. Input is hidden. The helper saves a plaintext credential file with owner-only permissions on POSIX systems at `~/.config/jev-checkpoint/credentials.json`. Windows users should keep this in their private user profile. No API key is bundled in the plugin.

`JEV_API_KEY` takes precedence if inherited by the MCP process. GUI applications may not inherit terminal exports. The user-local credential file avoids that dependency; the server rereads it on each review. `JEV_CHECKPOINT_CONFIG` optionally overrides its location. Do not copy credentials into a repository, manifest, prompt or test fixture.

- Missing tools: confirm plugin is installed/enabled and start a new Codex task. Check Node on PATH.
- `MISSING_API_KEY` / `INVALID_CONFIG`: run the local helper; do not display the file.
- `AUTH_FAILED`: verify the key belongs to TypeSafe and remains active. A configured key is not proof of successful authentication.
- `RATE_LIMITED` / `API_ERROR`: check account/service state; do not retry automatically.
- `NETWORK_ERROR` / `TIMEOUT`: check connectivity to api.typesafe.ai. Attempt counts remain consumed.
- `INVALID_RESPONSE`: report the incompatibility; do not invent metrics.
- `SENSITIVE_CONTEXT`: remove secrets and credential files before submitting. Heuristic detection is not a complete secret scanner.
- `BUDGET_EXHAUSTED`: continue local verification and report the limit.

Do not install unrelated plugins, change permissions, alter existing MCP definitions, or reset budgets merely to make a review happen.
