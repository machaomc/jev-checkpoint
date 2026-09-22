# Jev Checkpoint for Claude Code

Requires Node.js 20+ on the MCP host and your own TypeSafe API key. This package targets Claude Code, not a plain browser chat.

```sh
claude plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
claude plugin install jev-checkpoint@jev-checkpoint
```

For a downloaded ZIP, extract it and run `claude plugin marketplace add /absolute/path/to/jev-checkpoint`, then the same plugin-install command. The directory contains the archive's `.claude-plugin/marketplace.json`. For a temporary session, `claude --plugin-dir /absolute/path/to/jev-checkpoint/plugins/jev-checkpoint` points to the inner plugin.

Open a new session. Invoke `/jev-checkpoint:jev-checkpoint` or ask to use Jev Checkpoint. Tools are namespaced by Claude Code; select the actual advertised Jev status/review tools. Importing only the skill does not install MCP.

Ask the status tool for configureScript and run `node "<returned absolute path>"` in a terminal. From the inner plugin directory, `node scripts/configure.mjs` uses the same user-local credential file. Do not paste keys into chat. Inherited JEV_API_KEY takes precedence.

Context is sent to TypeSafe. Maximum two outgoing attempts per task, including failures. A host switch does not renew this policy; transfer the ID, attempts used and last result. Server counters/cache are process-local.

Update with `claude plugin marketplace update jev-checkpoint` and `claude plugin update jev-checkpoint@jev-checkpoint`, then reload plugins or open a new session. Remove with `claude plugin uninstall jev-checkpoint@jev-checkpoint` and optionally `claude plugin marketplace remove jev-checkpoint`.

Full English/Chinese instructions: https://github.com/machaomc/jev-checkpoint
