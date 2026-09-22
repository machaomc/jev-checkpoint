# Multi-host Packages Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, with a fresh whole-change review at the end.

**Goal:** Generate self-contained Codex, Claude Code and WorkBuddy packages from one MCP core and one skill.

**Architecture:** Shared resources plus per-host templates feed a deterministic builder. The existing Codex output path stays stable; other hosts get their own marketplaces and archives.

**Tech Stack:** Node.js 20+, TypeScript, esbuild, MCP SDK, fflate for build-time ZIP generation.

**Spec:** `docs/superpowers/specs/2026-09-22-multi-host-design.md`

## Global Constraints

- Version 0.2.0, plugin/marketplace name `jev-checkpoint`.
- Preserve Node.js 20+, the fixed TypeSafe endpoint, and process-local two-attempt budgets.
- No live key in files, logs, archives or commits; no paid API calls for this packaging change.
- Three generated packages share byte-identical runtime and Skill instructions.
- Work in the user-requested repository on `feat/multi-host-packages`; publish after validation using existing commit/push authorization.

## Review Focus

- Installed path has spaces and is outside the repository: each MCP command must launch independently.
- WorkBuddy secret option is empty: environment/file fallback and no-key status must still work.
- A template is removed: a rebuild must remove stale generated content.
- A resource is symlinked: refuse packaging external/private content.
- A user transfers an exhausted task to another host: the skill must not treat process-local counters as renewed authorization.

### Task 1: Shared resources and generated packages

**Files:** `src/credentials.ts`, `src/server.ts`, `shared/`, `packaging/`, `scripts/build.mjs`, `scripts/package.mjs`, `scripts/validate-package.mjs`, `test/distribution.test.ts`, `test/credentials.test.ts`, `package.json`, generated package/marketplace directories.

**Interfaces:** Build emits the three directories named in the spec; package emits `artifacts/jev-checkpoint-{codex,claude,workbuddy}-0.2.0.zip` plus `SHA256SUMS.json`. All hosts discover `jev_checkpoint_status` and `jev_checkpoint_review`.

- [x] Add failing credential precedence tests for `JEV_CHECKPOINT_PLUGIN_KEY`, including empty fallback.
- [x] Add failing extracted-package tests that read actual manifests, resolve documented host variables, launch MCP outside the repo and check tools/status/error behavior.
- [x] Add archive reproducibility, path safety, stale-output and common-content checks. Install fflate as a development dependency only.
- [x] Move the skill/helper to shared sources; replace Codex wording and clarify advertised tool namespaces and cross-host handoffs.
- [x] Generate platform manifests and outputs with Node's path APIs, compile once and archive sorted files with fixed metadata.
- [x] Run `npm run validate`; expected: all tests, type checking and package validation pass.

### Task 2: Native verification, docs and delivery

**Files:** `README.md`, `README.zh-CN.md`, `docs/compatibility.md`, `docs/verification.md`, `.github/workflows/ci.yml`.

**Interfaces:** Uses Task 1's paths and artifacts, records exactly which native host versions/checks ran.

- [x] Validate Claude and WorkBuddy manifests/marketplaces with their real CLIs; install and inspect generated snapshots using supported commands where possible, without sending source or keys to models.
- [x] Run scenario validation against the shared skill, including missing MCP and exhausted task handoff.
- [x] Document each host's Git URL installation, ZIP local installation, credential method and update/remove flow; distinguish WorkBuddy native plugins from official connector submission.
- [x] Extend CI to regenerate all packages, detect drift and retain ZIP/checksum artifacts.
- [x] Run the complete verification suite, independent final review, required skill/plugin validators and secret/diff checks.
- [x] Commit, fast-forward main and push; inspect hosted CI, verify remote marketplace installation and refresh local Codex to the published version.

## Execution record

- Initial baseline: clean repository at `33f19e8`; previous 23-test suite and five CI jobs passed.
- WorkBuddy decision: use its installed, documented native plugin loader instead of an unverified connector root placeholder.

- Shared resources and package generation: initial targeted tests failed for missing plugin-option support, archives and generator; implementation then passed. A later archive test exposed missing embedded marketplace metadata; the ZIP layout was corrected and verified.
- Local verification: `npm run validate` passed all 32 tests, TypeScript checking and three-host package validation; plugin-creator and skill-creator validators passed. No paid API request was made.
- Native checks: Claude Code 2.1.117 and WorkBuddy 5.5.6 bundled CLI accepted their manifests and installed the local marketplace in isolated profiles. Claude reported its plugin MCP connected; both installed packages passed direct stdio checks.
- Ruling: WorkBuddy uses the documented native plugin channel, not an official connector submission — it supports the required plugin root and private configuration — users wanting an official catalog listing need a separate submission later.
- Skill evidence: five independent instruction scenarios passed; these do not establish automatic invocation in a live host model.
- Final independent review: one Important finding (symlinked resource roots / LICENSE bypass); four regression tests reproduced it and then passed after input validation. Final `npm run validate`: 36/36 passed. No remaining actionable findings or deferred minors.
- Final review boundary decisions: GUI credential entry and automatic model invocation remain unverified and are disclosed; durable cross-process budgets remain out of scope and are not promised; official catalog submission remains separate from this native-plugin delivery.
- Publication: implementation committed as `1b4c0e6`, fast-forwarded to main and pushed. Hosted CI run `35684727748` passed all five jobs. Three hosts installed version 0.2.0 from the Git marketplace and their installed MCP copies passed the zero-paid-request smoke check; Claude also passed its native MCP health check.
