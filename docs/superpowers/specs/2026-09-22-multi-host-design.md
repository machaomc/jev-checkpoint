# Multi-host distribution design

The user approved one shared implementation with separate Codex, Claude Code and WorkBuddy installation packages. Preserve the existing Codex Git URL and plugin identity. Ship v0.2.0, update documentation, validate the outputs and publish through the existing repository.

## Distribution

- `src/` remains the only MCP implementation. Compile once and copy the same runtime into every package.
- `shared/` owns the host-neutral skill and credential helper. Platform templates under `packaging/` own only manifests, MCP launch configuration, metadata and installation notes.
- Keep Codex at `plugins/jev-checkpoint`. Generate Claude Code under `packages/claude/jev-checkpoint` and WorkBuddy under `packages/workbuddy/jev-checkpoint`.
- Generate repository marketplace entries for Claude and WorkBuddy; retain the existing Codex marketplace path. Each points to its own generated package.
- Generate three reproducible ZIP archives with a single `jev-checkpoint/` root and a SHA-256 index in ignored `artifacts/`. Each archive must run without repository source or node_modules after extraction.
- Build rejects symlinked template resources and copies only explicit shared/template inputs. Generated output directories are wholly owned by the builder; user credential files never belong there.

## WorkBuddy integration decision

WorkBuddy 5.5.6 is installed locally. Its bundled plugin documentation and loader support `.codebuddy-plugin/plugin.json`, a native marketplace, `${CODEBUDDY_PLUGIN_ROOT}`, and sensitive `userConfig` options. Use this native plugin route for installable Git URL distribution. A public connector submission is a separate distribution channel and is not required for this release. Do not create an unverified connector `mcp.json` using an invented root variable.

WorkBuddy's optional secret form injects `JEV_CHECKPOINT_PLUGIN_KEY`. Credential priority is an explicit nonempty `JEV_API_KEY`, then a nonempty plugin key, then the existing user credential file. An empty form must preserve the fallback and allow no-key diagnostics. No real API key is needed for packaging or CI.

## Skill behavior

Use host-neutral actor names. Resolve actual advertised tools from the Jev Checkpoint server, including host namespace prefixes; never invent tool names. Importing a skill alone does not install MCP. Missing tools/credentials continue local work with an explicit skipped result. A configured key needs no repeated setup.

Retain the two-attempt task policy, no score chasing, evidence checks, review-only behavior and privacy rules. Counters/cache are still process-local. A cross-host handoff carries checkpoint ID, task, attempts consumed and last evaluated diff/result; a fresh process does not renew the task budget. Do not claim cached comparison survives a host switch.

## Acceptance

All existing tests pass. Extracted packages start from a path with spaces outside the repository, discover both tools and handle missing credentials. WorkBuddy form values reach the core without appearing in status or logs. Archives are reproducible, version-aligned and self-contained. Native Codex, Claude Code and WorkBuddy CLI checks validate the relevant package/marketplace. Distinguish CLI/MCP checks from a full GUI/model workflow in public verification records. Preserve Node.js 20+ runtime compatibility and the existing fixed TypeSafe endpoint.
