# Jev Checkpoint

[简体中文](README.zh-CN.md)

One shared review skill and bundled local MCP server, packaged separately for **Codex, Claude Code and WorkBuddy**. Your coding assistant implements, diagnoses and tests; TypeSafe's Jev supplies independent quality signals. Each task checkpoint gets at most **two outgoing API attempts per MCP process**, including failures.

This is a community project by [machaomc](https://github.com/machaomc), not an official OpenAI, Anthropic, Tencent or TypeSafe product. It does not replace your coding assistant's model, automatically route every prompt, or promise a fixed speedup or saving.

## Install from the GitHub URL

Requires a supported host with plugin marketplace support, **Node.js 20+ on the MCP host's PATH**, and your own **TypeSafe API key**. Tested host versions and limitations are recorded in [compatibility](docs/compatibility.md).

**Codex:** No npm install or build is required to use the plugin: the server and its dependencies are bundled in Git.

```sh
codex plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
codex plugin add jev-checkpoint@jev-checkpoint
```

**Claude Code:**

```sh
claude plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
claude plugin install jev-checkpoint@jev-checkpoint
```

**WorkBuddy native plugin interface:**

```text
/plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
/plugin install jev-checkpoint@jev-checkpoint
```

The WorkBuddy package targets its native CodeBuddy-compatible plugin loader. It is separate from official connector-marketplace submission. A standalone CodeBuddy CLI may use a different profile from the desktop application; see [host-specific instructions](docs/compatibility.md).

Then start a **new task/session**. Ask:

> Use Jev Checkpoint. Check configuration first and tell me where to run the local credential setup helper.

`jev_checkpoint_status` returns `configureScript`, the absolute path of the installed helper. Run that path with Node in your own terminal, for example `node "/path/returned/by/status/configure.mjs"`. Paste your TypeSafe key at the hidden prompt. Do not paste it into a chat or command-line argument.

Alternatively, clone this repo and run the same helper; both copies use the same user-local credential file:

```sh
git clone https://github.com/machaomc/jev-checkpoint.git
cd jev-checkpoint
node plugins/jev-checkpoint/scripts/configure.mjs
```

The helper saves a plaintext key at `~/.config/jev-checkpoint/credentials.json`, outside the repository and plugin cache. It uses file mode `0600` on POSIX systems. On Windows, keep it in your private user profile with appropriate filesystem permissions. The server rereads the file on each review, so GUI use does not depend on terminal environment inheritance. Credential precedence is a nonempty inherited `JEV_API_KEY`, then WorkBuddy's private plugin option (injected as `JEV_CHECKPOINT_PLUGIN_KEY`), then the file. WorkBuddy's optional `api_key` form can be left blank to preserve fallback. `JEV_CHECKPOINT_CONFIG` can select a different file; it must be available to the MCP process as well as the helper. `--stdin` supports secret-manager pipes; never put the key in argv.

Get a key from [TypeSafe](https://console.typesafe.ai/). This version calls `https://api.typesafe.ai/v1/systemone` with `jev-latest`. It does **not** accept a Vercel AI Gateway key. TypeSafe usage is separate from your coding assistant subscription.

`ready: true` only verifies that local credentials are present. A successful review verifies API authentication.

## Use

> Use Jev Checkpoint while implementing this change. Run relevant checks, review the task-owned diff, and fix only code-backed problems.

The skill normally applies to behavior changes, contracts, reliability/security boundaries and related multi-file work. Formatting and prose-only changes usually skip Jev. A review-only request remains read-only; when no real change diff exists, the agent reviews locally and discloses that this diff-oriented Jev workflow was skipped. If you already have `jev-review`, choose one review workflow for the task to avoid duplicate evaluation.

1. Your coding assistant implements and runs relevant checks.
2. Jev evaluates the focused diff and necessary context.
3. Your coding assistant inspects weak or uncertain dimensions against the actual code.
4. If a justified fix exists, the assistant makes it, validates and uses the one remaining follow-up.
5. The final report separates local checks, Jev results and remaining uncertainty.

Codex supports `$jev-checkpoint`; Claude Code exposes `/jev-checkpoint:jev-checkpoint`. On WorkBuddy, ask to use Jev Checkpoint or select the installed skill. Automatic selection depends on the host and model; installation is not proof of automatic invocation. Tool names may have host-specific prefixes.

### Tools

| Tool | Behavior |
| --- | --- |
| `jev_checkpoint_status` | Local configuration diagnosis; no paid request and no credential output. |
| `jev_checkpoint_review` | Sends explicit code context to TypeSafe; never discovers, reads or edits repository files. |

Example review arguments:

```json
{
  "checkpointId": "checkout-rounding-task",
  "task": "Round totals to cents without changing tax rules.",
  "diff": "- const total = subtotal;\n+ const total = Math.round(subtotal * 100) / 100;",
  "context": "Supply relevant invariants and actual validation results here."
}
```

Optional `files` is an array of `{ "path": "src/file.ts", "content": "..." }`. Keep the task and scope stable within a checkpoint. Follow-ups supply the current implementation; no `previousEvaluation` payload is needed because comparisons are local. Across hosts, carry the checkpoint ID, unchanged task text, attempts used and last evaluated diff/result. A fresh process has no previous comparison or cache and does not renew the task budget.

### Results and limits

- Six dimensions: correctness, maintainability, tests, reliability, security and compatibility.
- Scores are **0–4**, with higher values indicating stronger evidence of quality. There is no blended score or automatic pass/fail gate.
- Each dimension also gets an evidence probability. Below `0.8`, the result is `assessable: false` and its score is withheld. This is a conservative, uncalibrated product heuristic, not an accuracy guarantee. An omitted score does not mean the code is good or bad.
- Assessable metrics include confidence and `needsInspection`; scores below `3` or confidence below `0.6` prompt inspection, not automatic rewrites.
- Maximum context is **48,000 UTF-8 bytes**, at most 20 explicitly supplied files. The upstream token limit can still reject a request; bytes are not tokens.
- Two outgoing attempts per checkpoint ID per server process. Failures count, and the client never retries automatically. Timeout is 30 seconds. Account-wide charges are not capped; new IDs and process restarts create fresh counters. The skill instructs the agent not to bypass its task budget.
- Identical **successful** input is cached within that checkpoint. Concurrent calls serialize; a second identical call after a failure is another attempt, not a cached success. Old cached results do not describe newer code.
- Budget and compact results live in memory. No repository content is stored on disk by the MCP server. At 500 task IDs, new checkpoints are refused instead of evicting active budgets.
- Missing keys, authentication failures, invalid responses and exhausted budgets are explicit tool errors, never fabricated reviews.

## Privacy

Only `task`, `diff`, optional `context` and optional `files` are transmitted to TypeSafe. Checkpoint IDs, cached comparisons and credentials are not included in the evaluation state. Credentials are sent only as an authorization header to the fixed HTTPS endpoint. Redirects are refused. There is no author-operated proxy or telemetry.

Common credential patterns, credential-file paths, and the configured key are rejected locally when detected. **This is a limited heuristic, not a complete secret scanner.** Select and inspect the context before sharing it; obey project data-sharing rules. The host application and TypeSafe have their own logging and data policies. See [TypeSafe privacy](https://typesafe.ai/privacy).

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `codex plugin` is unknown | Use a current Codex CLI. Desktop and a separately installed CLI can have different versions. |
| `node` cannot be found | Install Node 20+ and make it visible to the desktop application's PATH; restart the application. |
| Tools are missing | Enable the plugin and start a new task. Check MCP startup status. |
| `MISSING_API_KEY` / `INVALID_CONFIG` | Run the hidden-input helper. Do not print the credential file. |
| `AUTH_FAILED` | Check the TypeSafe key/account; Gateway keys are unsupported. |
| `INVALID_RESPONSE` | Report an API compatibility issue; no score is available. |
| `CONTEXT_TOO_LARGE` | Reduce unrelated context; do not truncate essential contracts. |
| `BUDGET_EXHAUSTED` | Continue local verification and disclose that Jev cannot review further changes in this task. |

For Codex, refresh the market and reinstall, then start a new task. Claude Code/WorkBuddy update and removal commands are in [compatibility](docs/compatibility.md).

```sh
codex plugin marketplace upgrade jev-checkpoint
codex plugin add jev-checkpoint@jev-checkpoint
```

To remove:

```sh
codex plugin remove jev-checkpoint@jev-checkpoint
codex plugin marketplace remove jev-checkpoint
```

The separate credential file remains until you remove it yourself.

## Development and verification

```sh
npm ci --ignore-scripts
npm run validate
```

The default suite uses local HTTP-response fixtures, not live Jev. It checks budgets, concurrency, cache behavior, schema handling, privacy boundaries, credentials and real MCP stdio transport. A standalone-install test copies only the plugin directory outside the repo and starts it without `node_modules`.

`npm run build` (also `npm run package`) compiles the core once, generates all three plugin directories and marketplaces, and writes reproducible ZIP installers plus `SHA256SUMS.json` into `artifacts/`. Each ZIP contains its own local marketplace. Add the extracted outer `jev-checkpoint` directory using the host's marketplace command, then install the plugin. CI uploads all three ZIPs as the `jev-checkpoint-installers` artifact.

Edit `src/`, `shared/` and `packaging/`, not generated output. The version is owned by `package.json`. Commit generated `plugins/jev-checkpoint`, `packages/claude/jev-checkpoint`, `packages/workbuddy/jev-checkpoint` and marketplace manifests alongside source. CI rebuilds and checks for drift on Linux, macOS and Windows. No `npm install` is needed inside an installed package.

Optional **paid** end-to-end smoke test, after configuring your own key:

```sh
npm run smoke:live
```

It sends two synthetic code examples, verifies cache reuse and blocks the third outgoing request. It never submits your repository. Results demonstrate connectivity and protocol behavior, not evaluator accuracy or measured savings. See [verification notes](docs/verification.md) for the checked release evidence.

## Distribution scope

This GitHub repository contains custom marketplace entries for Codex (`.agents/plugins`), Claude Code (`.claude-plugin`) and WorkBuddy (`.codebuddy-plugin`). Adding its URL makes its plugin available to that user; it does not submit or list it in OpenAI's official public directory. Current official submission guidance expects a public HTTPS MCP endpoint for the usual With MCP route; this release intentionally uses local stdio. See [OpenAI packaging documentation](https://developers.openai.com/plugins/build/plugins).

Each marketplace selects its host-specific package. A generic “install a skill from URL” flow may install just the instructions and omit MCP; use the complete package. See [verification](docs/verification.md) for the distinction between native CLI installation, MCP checks and full GUI/model workflows.

## Credits and license

Inspired by [NiazMorshed2007/jev-review](https://github.com/NiazMorshed2007/jev-review). This is a separate implementation with its own tools, rubric and budget behavior. [MIT](LICENSE). Bundled third-party dependency notices ship inside the plugin's `dist/` folder. Schema snapshots are sourced from [Agent Plugins 1.0](https://agent-plugins.org/).
