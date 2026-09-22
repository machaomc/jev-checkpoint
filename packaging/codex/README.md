# Jev Checkpoint for Codex

Requires Node.js 20+ on the MCP host and your own TypeSafe API key.

Install the complete plugin from the repository marketplace:

```sh
codex plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
codex plugin add jev-checkpoint@jev-checkpoint
```

For a downloaded ZIP, extract it and run `codex plugin marketplace add /absolute/path/to/jev-checkpoint`, then the same plugin-add command. The archive includes its own marketplace. Use the extracted directory containing `.agents/plugins/marketplace.json`, not the inner plugin directory.

Open a new task. Ask Jev Checkpoint to check status and return configureScript. Run `node "<returned absolute path>"` in a terminal; enter the key in the hidden prompt. Alternatively, from this extracted plugin directory run `node scripts/configure.mjs`.

Use `$jev-checkpoint` to review a focused code change after local validation. Context is sent to TypeSafe. Maximum two outgoing attempts per task, including failures. Server counters are per process, not shared across hosts. Scores are hints, not proven defects.

Update with `codex plugin marketplace upgrade jev-checkpoint`, then `codex plugin add jev-checkpoint@jev-checkpoint` and open a new task. Remove with `codex plugin remove jev-checkpoint@jev-checkpoint` and, if no longer needed, `codex plugin marketplace remove jev-checkpoint`.

Full English/Chinese instructions: https://github.com/machaomc/jev-checkpoint
