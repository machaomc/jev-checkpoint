# Jev Checkpoint for WorkBuddy

Native WorkBuddy/CodeBuddy plugin package. Requires Node.js 20+ on the MCP host. Target verification version: WorkBuddy 5.5.6. This is not an official connector-marketplace submission.

Use the native plugin marketplace commands in the WorkBuddy plugin interface or its CodeBuddy CLI:

```text
/plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
/plugin install jev-checkpoint@jev-checkpoint
```

CLI equivalents are `codebuddy plugin marketplace add <URL>` and `codebuddy plugin install jev-checkpoint@jev-checkpoint`. The CLI must use the same product configuration directory as WorkBuddy; a standalone CodeBuddy CLI can have a different user profile. See the repository's compatibility guide for tested host commands and limitations.

For a downloaded ZIP, extract it and add `/absolute/path/to/jev-checkpoint` as a local marketplace, then install the plugin. The directory contains `.codebuddy-plugin/marketplace.json`. The native CLI's `--plugin-dir /absolute/path/to/jev-checkpoint/plugins/jev-checkpoint` loads the inner plugin for a temporary session. Do not import only SKILL.md; it cannot register MCP. The native manifest is .codebuddy-plugin/plugin.json and MCP uses CODEBUDDY_PLUGIN_ROOT.

The optional private plugin option `api_key` accepts a TypeSafe API key. Leaving it blank preserves JEV_API_KEY or the existing credential-file fallback. If the client does not expose that form, ask the status tool for configureScript and run `node "<returned absolute path>"` in a terminal. From the inner plugin directory, `node scripts/configure.mjs` is the same helper. Never paste keys into chat.

Open a new session and ask to use Jev Checkpoint for a code change. Context is sent to TypeSafe. Maximum two attempts per task, including failures; MCP counters/cache are per process, and switching hosts or interfaces does not renew a task budget.

This plugin also bundles the CLI at `dist/cli.cjs`, which reaches the same rubric when the MCP server is unavailable; ask the status result for `cliScript`. For a standalone skill instead of this plugin, use `artifacts/jev-checkpoint-skill-<version>.zip` from the repository or the corresponding skill-marketplace listing.

Update through `/plugin marketplace update jev-checkpoint` and `/plugin update jev-checkpoint@jev-checkpoint`, then open a new session. Remove through `/plugin uninstall jev-checkpoint@jev-checkpoint` and optionally `/plugin marketplace remove jev-checkpoint`.

Full English/Chinese instructions: https://github.com/machaomc/jev-checkpoint
