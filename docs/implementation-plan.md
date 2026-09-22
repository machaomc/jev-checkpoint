# Jev Checkpoint v0.1

Deliver a public Codex plugin with its own bundled stdio MCP server and a focused review skill. Publish to the existing machaomc/jev-checkpoint repository after verification. The repository is also a custom plugin marketplace; official directory submission is separate.

## Scope and acceptance

1. Package at `plugins/jev-checkpoint`: portable manifest, Codex compatibility manifest, MCP definitions, prebuilt Node 20+ server, credential setup helper, and skill. Installing the plugin requires no npm build.
2. MCP exposes readiness and focused review. TypeSafe direct API only; fixed HTTPS endpoint, no remote proxy. Six independent dimensions use documented Score and Noul responses. Missing evidence is not a passing score.
3. Per checkpoint, per process: at most two outgoing attempts, no automatic retries, cached identical successful input, serialized concurrent calls, and local comparison against prior results. Failed requests may be retried explicitly within the budget. This is not an account-wide spending cap. Store no code on disk.
4. Read credentials from JEV_API_KEY or a user-local config file. Never return or log credentials or raw upstream errors. Provide hidden-input configuration and no-key diagnostics.
5. Skill: focus task-owned context, inspect before acting on low scores, preserve validation and scope, reuse checkpoint ID, do not chase numerical targets, report failures honestly.
6. Validate TypeScript, protocol behavior, package schemas and paths, budget and concurrency behavior, malformed responses, timeouts, credential handling, and install from GitHub URL. Add CI for Node 20/22/24 on Linux plus Windows and macOS smoke coverage.
7. Live API validation is a separate opt-in test and needs the user's TypeSafe key. Offline tests must never silently make paid requests.

## Execution

- Inspect official API and Codex package contracts; initialize the empty repository.
- Write failing boundary tests before implementing the engine, client, credential helper, and protocol entrypoint.
- Implement the bounded review workflow and distributable plugin; document English/Chinese setup and privacy.
- Run independent skill scenarios and code review, resolve actionable findings, run the full suite and clean-install checks.
- Commit and push, then add the remote marketplace and install its plugin with the actual Codex CLI. Compare installed artifact with repository output and record exact results.

## Review focus

Concurrent requests cannot spend past the limit; upstream failures consume attempted requests; comparisons stay within a task; sensitive content does not enter an API request after being rejected; GUI credential loading works without shell inheritance; artifacts run after copying only the plugin directory.
