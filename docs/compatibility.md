# Host compatibility and installation / 三端兼容与安装

One implementation is packaged three ways as a plugin, plus a fourth CLI-only archive for the WorkBuddy skill marketplace. `src/` owns the MCP core and the CLI; `shared/` owns the Skill and credential helper; `packaging/` owns host-specific configuration. Generated packages are self-contained and need Node.js 20+, but no npm install.

| Host | Repository marketplace | Generated plugin | Root substitution |
| --- | --- | --- | --- |
| Codex | `.agents/plugins/marketplace.json` | `plugins/jev-checkpoint` | `${PLUGIN_ROOT}` |
| Claude Code | `.claude-plugin/marketplace.json` | `packages/claude/jev-checkpoint` | `${CLAUDE_PLUGIN_ROOT}` |
| WorkBuddy | `.codebuddy-plugin/marketplace.json` | `packages/workbuddy/jev-checkpoint` | `${CODEBUDDY_PLUGIN_ROOT}` |

## Install from the same GitHub URL

Codex:

```sh
codex plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
codex plugin add jev-checkpoint@jev-checkpoint
```

Claude Code:

```sh
claude plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
claude plugin install jev-checkpoint@jev-checkpoint
```

WorkBuddy uses its native CodeBuddy-compatible plugin system. In a native plugin command interface:

```text
/plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
/plugin install jev-checkpoint@jev-checkpoint
```

The CLI equivalents are `codebuddy plugin marketplace add <URL>` and `codebuddy plugin install jev-checkpoint@jev-checkpoint`. A separately installed CodeBuddy CLI normally uses its own profile; installing there is not proof that the WorkBuddy desktop app has the plugin. Use the desktop's plugin management, or its bundled CLI with the desktop profile. For a standard macOS WorkBuddy installation using `~/.workbuddy`:

```sh
CODEBUDDY_CONFIG_DIR="$HOME/.workbuddy" "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy" plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
CODEBUDDY_CONFIG_DIR="$HOME/.workbuddy" "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy" plugin install jev-checkpoint@jev-checkpoint
```

If your organization or installation uses a different profile, use that configured path. This is a native plugin distribution, not a listing in WorkBuddy's official connector market. The official connector route uses different metadata and review requirements; it is not necessary for native Git marketplace installation.

## ZIP installers / ZIP 安装包

`npm run package` emits these archives and `SHA256SUMS.json` under `artifacts/`:

- `jev-checkpoint-codex-0.2.0.zip`
- `jev-checkpoint-claude-0.2.0.zip`
- `jev-checkpoint-workbuddy-0.2.0.zip`
- `jev-checkpoint-skill-0.2.0.zip` — WorkBuddy skill marketplace, CLI only, no MCP server

Each archive contains an outer `jev-checkpoint/` marketplace directory and its complete `plugins/jev-checkpoint/` plugin. Extract different host archives into separate directories: their outer names are intentionally the same.

Replace the Git URL in the marketplace-add command with the **absolute path to the extracted outer directory**, then use the normal install command. Keep that extracted directory in a stable location for local-marketplace updates. For temporary Claude Code/CodeBuddy development sessions, `--plugin-dir` instead points to the **inner plugin directory**.

GitHub Actions uploads every archive together as `jev-checkpoint-installers`; downloads may require a GitHub login. Git URL installation needs neither the archive nor a local build.

ZIP 自带完整本地市场和插件，不需要再从源码拼装。三端包应分别解压，添加外层目录作为市场；临时 `--plugin-dir` 才指向内层插件。不要只导入 Skill，否则缺少 MCP。

## WorkBuddy skill marketplace / 技能市场

The skill-market channel installs an instruction-only skill and never registers an MCP server, so it gets its own archive rather than one of the three plugin archives:

| Archive | Contains | Does not contain |
| --- | --- | --- |
| `jev-checkpoint-skill-0.2.0.zip` | `SKILL.md`, `LICENSE`, `references/setup.md`, `scripts/cli.cjs`, `scripts/configure.mjs`, `scripts/THIRD_PARTY_LICENSES.txt` | `dist/server.cjs`, `.mcp.json`, plugin manifests |

Upload the ZIP itself; the marketplace rejects or mis-handles deeper nesting, so do not repackage it. Inside the archive the skill directory is two levels deep at most (`scripts/cli.cjs`), every byte stays under the 3 MB limit, and the frontmatter carries the required marketplace fields on top of the shared skill body. The MCP-based plugin packages also carry the same CLI at `dist/cli.cjs`, so a plugin install can fall back to it when no MCP host is available.

技能包只安装说明文档和脚本，不注册 MCP，所以单独出一个压缩包。上传时直接用 ZIP；插件包内也带了同一个 CLI（`dist/cli.cjs`），在无法使用 MCP 的环境里可作兜底。一个检查点只选用一种接口。

## Credentials / 密钥

All four packages use the same credential loader:

1. Nonempty `JEV_API_KEY` inherited by MCP.
2. Nonempty `JEV_CHECKPOINT_PLUGIN_KEY` supplied by the WorkBuddy private plugin option `api_key`.
3. `~/.config/jev-checkpoint/credentials.json`, or the file selected by `JEV_CHECKPOINT_CONFIG`.

The WorkBuddy option is marked sensitive and defaults to empty. On clients exposing the private plugin configuration form, use it; an empty form preserves environment/file fallback. UI presentation and secure storage are host responsibilities. This release has tested the option's configuration and MCP injection, not an interactive secret-entry GUI flow.

The shared fallback on every host is `node "<configureScript returned by jev_checkpoint_status>"` over MCP, or `node "<configureScript from the CLI status>"` in the skill archive. Run it in a terminal, enter the key at the hidden prompt, and never send keys in chat. The helper stores a plaintext key outside the plugin cache with POSIX file permissions 0600. An already-ready status does not require another setup step, but only a successful review verifies upstream authentication.

同一台机器、同一用户下，三端可以读取同一个凭据文件。远端机器和沙箱需要各自配置。密钥不包含在安装包内，插件卸载也不会自动清理单独保存的凭据文件。

## Invocation and updates

Open a new task/session after installation or update. Where supported, the host's documented plugin reload can also activate changes.

| Host | Explicit invocation | Update after marketplace refresh | Remove |
| --- | --- | --- | --- |
| Codex | `$jev-checkpoint` | `codex plugin marketplace upgrade jev-checkpoint`, then `codex plugin add jev-checkpoint@jev-checkpoint` | `codex plugin remove jev-checkpoint@jev-checkpoint` |
| Claude Code | `/jev-checkpoint:jev-checkpoint` | `claude plugin marketplace update jev-checkpoint`, then `claude plugin update jev-checkpoint@jev-checkpoint` | `claude plugin uninstall jev-checkpoint@jev-checkpoint` |
| WorkBuddy native CLI | Ask to use Jev Checkpoint / select the installed skill | `codebuddy plugin marketplace update jev-checkpoint`, then `codebuddy plugin update jev-checkpoint@jev-checkpoint` | `codebuddy plugin uninstall jev-checkpoint@jev-checkpoint` |
| WorkBuddy skill marketplace | Ask to use Jev Checkpoint, then follow the reported `cliScript` path | Re-upload the rebuilt ZIP | Remove the skill in the marketplace UI |

For WorkBuddy CLI commands, preserve the same profile selection used at install. Remove a no-longer-needed marketplace using the corresponding `plugin marketplace remove jev-checkpoint` command. Do not install two variants into the same host: the shared plugin identity deliberately stays the same.

### Interfaces / 接口

The plugin packages expose the MCP tools and the CLI (`dist/cli.cjs`); the skill archive exposes the CLI only (`scripts/cli.cjs`). Both interfaces share the endpoint, rubric, input limits, error codes and two-attempt budget, and neither resets the other. Counters differ in lifetime: MCP counts per server process, the CLI counts per user and machine in `~/.config/jev-checkpoint/checkpoints.json` with entries expiring after twelve hours. Pick one interface per checkpoint.

插件包同时提供 MCP 工具与 CLI（`dist/cli.cjs`），技能包只提供 CLI（`scripts/cli.cjs`）。两者共用端点、评分维度、输入上限、错误码和两次额度，且互不重置；MCP 计数随进程，CLI 计数按用户与机器持久化十二小时。一个检查点只选用一种，不要用切换接口的办法换取额外次数。

Automatic Skill selection varies by host and model. Tool names can have namespace prefixes; the shared skill uses the actual advertised tools from the Jev Checkpoint server. This package does not install hooks to force every prompt through Jev.

## Cross-host task handoff / 跨端接力

Keep `{checkpointId, task, outgoingAttemptsUsed, lastEvaluatedDiff, lastResult}` with the task's notes, excluding secrets and respecting the project's data rules. A new process has fresh counters/cache and a different interface keeps its own counter store, but neither renews the skill's two-attempt task policy. With two attempts consumed, continue locally; with one consumed, use at most the remaining attempt and compare with the carried result manually.

本版没有跨进程数据库或账户消费上限。跨客户端或跨接口的预算依靠任务记录与 Skill 规则衔接，不能把它当作强制共享的额度限制；也不得靠切换接口换取额外次数。

## Evidence and sources

See [verification records](verification.md) for exact versions, checks and limits. Claude browser chat and arbitrary older WorkBuddy versions are not part of the tested compatibility claim.

- [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference) and [marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [WorkBuddy plugin system](https://www.codebuddy.cn/docs/workbuddy/Plugins) and [official connector channel](https://open.workbuddy.cn/docs/connector)
- WorkBuddy 5.5.6 also ships its native plugin reference and marketplace guide under its bundled CLI documentation. The native loader and documentation were inspected locally to verify `.codebuddy-plugin`, `CODEBUDDY_PLUGIN_ROOT`, `userConfig` and profile isolation.
