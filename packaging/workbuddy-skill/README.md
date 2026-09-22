# WorkBuddy skill-market build

This folder holds the field overrides for the fourth distribution: the **skill-market archive**
(`artifacts/jev-checkpoint-skill-<version>.zip`, generated into `packages/workbuddy-skill/jev-checkpoint/`).

That channel distributes instructions plus scripts and does **not** register an MCP server, so this
build ships the bundled CLI (`scripts/cli.cjs`) instead of `dist/server.cjs`. The MCP server, the
`.mcp.json` wiring and the host plugin manifests are deliberately absent here; users who want the MCP
tools should install the plugin package instead.

- `frontmatter.json` — marketplace-only SKILL.md fields. Keys that already exist in
  `shared/skills/jev-checkpoint/SKILL.md` are replaced in place; new keys are appended. `version` is
  always taken from `package.json`, so it is not listed here.
- The SKILL.md **body** is never duplicated in this folder; it always comes from
  `shared/skills/jev-checkpoint/SKILL.md`. Edit the shared file, not the generated output.

Archive layout (two levels below the archive root, the marketplace limit):

```
jev-checkpoint/SKILL.md
jev-checkpoint/LICENSE
jev-checkpoint/references/setup.md
jev-checkpoint/scripts/cli.cjs
jev-checkpoint/scripts/configure.mjs
jev-checkpoint/scripts/THIRD_PARTY_LICENSES.txt
```

Regenerate with `npm run build` (or `npm run package`), then confirm the SHA-256 in
`artifacts/SHA256SUMS.json`. Upload the ZIP itself to the skill marketplace; do not upload the
extracted directory or a single SKILL.md.
