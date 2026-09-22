# Verification evidence

## v0.2.0 — multi-host packages

Recorded 2026-09-22. The core, shared skill and credential helper now generate Codex, Claude Code and WorkBuddy packages and ZIP installers.

- Local `npm run validate`: 36 tests passed, including extracted ZIP startup outside the repository with spaces in the path, self-contained marketplace resolution, identical shared payloads, archive checksums/reproducibility, stale-output cleanup and symlink rejection.
- WorkBuddy optional secret configuration reaches MCP through the generated configuration; status reports `credentialSource: plugin` without exposing the synthetic value. An empty option preserves the old environment/file fallback. These tests make no TypeSafe request.
- Claude Code `2.1.117`: native marketplace and plugin validation passed; local marketplace installation succeeded in an isolated test profile; `claude mcp list` reported the plugin MCP connected. The initial native check rejected a newer top-level marketplace description field, which was moved under `metadata` for backward compatibility.
- WorkBuddy `5.5.6`, using its bundled CodeBuddy CLI: native marketplace and plugin validation passed; local marketplace installation succeeded in an isolated test profile. The copied installed server passed MCP discovery and missing-key checks. Its `mcp list` subcommand did not enumerate plugin-provided servers, so it was not counted as plugin health evidence.
- Independent final review found that symlinked input roots and a symlinked LICENSE could bypass the packaging boundary. Four regression cases first reproduced the issue, then passed after validation was added before output replacement; the full 36-test suite passed. These POSIX symlink cases are explicitly skipped on Windows. No other actionable finding remained.
- The revised shared skill passed five document-driven scenarios covering namespaced tools, missing MCP, existing host credentials, exhausted cross-host handoffs and a single remaining attempt. These are instruction simulations, not live model behavior measurements.
- The last authenticated TypeSafe smoke test remains the v0.1.0 result below. This packaging release did not reuse the temporary key or send real requests.
- Published implementation: [`1b4c0e6`](https://github.com/machaomc/jev-checkpoint/commit/1b4c0e6185fb50aab90643e3046dd0189ed1145d). [GitHub Actions run 35684727748](https://github.com/machaomc/jev-checkpoint/actions/runs/35684727748) passed all five jobs: Ubuntu Node 20/22/24, macOS Node 22 and Windows Node 22. Every job rebuilt and validated all three distributions and checked for generated-file drift; Windows ran 32 tests and skipped the four POSIX symlink cases, while other jobs passed all 36.
- The workflow uploaded all three ZIP installers and `SHA256SUMS.json` as the `jev-checkpoint-installers` artifact. The downloaded Ubuntu CI archives matched the local macOS archives byte-for-byte by SHA-256.
- Remote URL installation: Claude Code and WorkBuddy's bundled CLI each added `https://github.com/machaomc/jev-checkpoint.git` in a fresh isolated profile, then installed and enabled version 0.2.0. WorkBuddy recorded the implementation commit above. Codex refreshed its existing Git marketplace and installed 0.2.0 into the real local plugin cache.
- All three remote-installed runtime copies passed `scripts/smoke-installed.mjs`: both tools discovered, credential helper present, missing-key handling correct, zero paid requests. Claude's native `mcp list` also reported the remote-installed plugin connected.
- GUI secret-entry and automatic Skill invocation in Claude Code/WorkBuddy remain untested; native validation and protocol startup do not prove those flows.

## v0.2.0 — bundled CLI and WorkBuddy skill archive

Recorded 2026-09-22. The plugin packages now also carry a standalone CLI, and a fourth CLI-only archive targets the WorkBuddy skill marketplace, which installs instructions and scripts but never registers an MCP server.

- Local `npm run validate` on macOS Node 22.22.2: TypeScript check, reproducible build, **38 tests** and package validation passed. The new cases cover the skill archive layout, its checksum and its frontmatter, and drive the extracted `scripts/cli.cjs` through status, the persisted budget, an expired ledger entry, argv payload rejection and stdin submission.
- `scripts/smoke-installed.mjs` against the committed `plugins/jev-checkpoint`: both MCP tools discovered, the bundled `dist/cli.cjs` reporting `interface: cli` with a resolving `configureScript`, missing-key handling correct over both interfaces, zero paid requests.
- CLI budget behaviour, exercised with a synthetic ledger and no API key: a checkpoint already at two attempts is refused with `BUDGET_EXHAUSTED` **without an outgoing request**; different task wording for the same ID returns `TASK_MISMATCH`; a ledger entry older than twelve hours is forgiven; `JEV_CHECKPOINT_STATE=off` disables the ledger. Payload content passed as a command argument is rejected as `INVALID_INPUT`.
- Skill archive: 135,405 bytes against the 3 MB marketplace limit; six entries, none deeper than two levels below the archive root; frontmatter carrying `name`, `description`, `description_zh`, `description_en`, `display_name`, `display_name_en`, `author` and a `version` that matches `package.json`. The instructions body stays byte-identical to the shared skill body, so the channels cannot drift apart.
- Host independence: the CLI needs only Node.js 20+ and a shell, so Codex and Claude Code can use it as well. Both already register MCP through their plugin manifests, so there the CLI is a fallback rather than a requirement; only the skill-market archive depends on it.
- Not verified in this revision: the hosted CI matrix, a real marketplace submission, the Windows CLI path, and any live TypeSafe evaluation of the CLI path. Local tests use fixtures and send no request, so no credential was needed or stored.

## v0.1.0 — initial Codex release

Recorded 2026-09-22. The checks below are observations, not a guarantee that all code defects will be detected.

## Local checks before publication

- `npm run validate`: TypeScript check, reproducible standalone build, 23 automated tests and package schema/path validation passed.
- Bundled plugin-creator validator: passed.
- Bundled skill-creator validator: passed.
- All 23 runtime tests passed on Node.js 20, 22.22.0 and 24 on macOS, including the standalone MCP and configuration-helper tests.
- The protocol test copies only `plugins/jev-checkpoint` to a temporary location, then discovers both tools and tests missing-credential behavior without `node_modules` or a network request.
- Independent code review identified credential-bearing checkpoint IDs being reflected in errors; the fix suppresses all error ID echoes and checks the configured key across every input field. A regression test passed. No unresolved actionable core finding remained.
- Independent skill simulation covered eight cases: formatting-only changes, uncertain low scores, exhausted budgets, auth recovery, review-only requests, mixed/secret context, stale results and first-use ordering. Clarified no-diff behavior, combined byte limits and task-resumption ID recovery afterward. The baseline already handled generic engineering judgment; the skill chiefly adds the plugin-specific operating contract.

## Real TypeSafe integration

The explicitly invoked live smoke test used a temporary user-supplied key with a synthetic arithmetic diff, not repository contents.

- Actual returned model: `jev-1.13.0`.
- Two successful API attempts: 1,527 + 1,558 input tokens and 218 + 218 output tokens as reported by the API.
- Repeating the first successful input returned the local cache.
- A third changed input was blocked by the local budget without another outgoing call.
- Both responses passed the documented Score/Noul schema validation. The very small example did not meet the conservative 0.8 evidence threshold for any dimension, so scores were correctly withheld as unassessable. This is not evidence of evaluator accuracy, quality gains, or cost savings.
- Temporary local credentials were removed after the test and are not in Git.

## Codex packaging

Codex CLI `0.153.4` successfully added the local repository marketplace, listed `jev-checkpoint@jev-checkpoint`, and installed/enabled version `0.1.0`. The installed plugin has a bundled MCP server and a discoverable skill.

After publishing commit `87f8cc4221121c5ffac00ac4c7f424570e1ab396`, the local test installation and marketplace were removed. The following commands then succeeded against the public GitHub repository:

```sh
codex plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
codex plugin add jev-checkpoint@jev-checkpoint
```

- Codex reported the marketplace source as `git`, with the GitHub URL above, and the plugin as installed and enabled.
- A recursive comparison found the installed plugin identical to the committed plugin directory, including its bundled server and skill.
- `scripts/smoke-installed.mjs` started the installed runtime through its MCP manifest, discovered both tools, found the configuration helper and verified missing-key handling. This installation check made zero paid API requests.
- The plugin remains installed from the remote marketplace. No persistent API key was configured by this verification.

## Hosted CI

[GitHub Actions run 35681987240](https://github.com/machaomc/jev-checkpoint/actions/runs/35681987240) passed for the published implementation commit on all five configurations:

| Operating system | Node.js |
| --- | --- |
| Ubuntu | 20, 22, 24 |
| macOS | 22 |
| Windows | 22 |

Every job ran dependency installation, TypeScript checking, the standalone build, all 23 tests, package validation and the check that the committed runtime matches a fresh build. No live API key is used in CI.

## Limits

- Live tests validate authentication, request/response compatibility and local budget/cache behavior, not decision accuracy.
- Evidence and inspection thresholds are conservative heuristics, not calibrated guarantees.
- Counters live in one process, not in durable account-level billing state.
- New Codex tasks are required to pick up newly installed skills/tools.
- GitHub custom-marketplace installation is separate from OpenAI public-directory review. No official-directory submission is implied.
