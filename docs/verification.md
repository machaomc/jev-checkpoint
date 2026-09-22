# Verification evidence — v0.1.0

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
