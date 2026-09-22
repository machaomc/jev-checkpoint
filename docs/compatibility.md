# Host compatibility and installation / 三端兼容与安装

One implementation is packaged three ways. `src/` owns the MCP core; `shared/` owns the Skill and credential helper; `packaging/` owns host-specific configuration. Generated packages are self-contained and need Node.js 20+, but no npm install.

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

Each archive contains an outer `jev-checkpoint/` marketplace directory and its complete `plugins/jev-checkpoint/` plugin. Extract different host archives into separate directories: their outer names are intentionally the same.

Replace the Git URL in the marketplace-add command with the **absolute path to the extracted outer directory**, then use the normal install command. Keep that extracted directory in a stable location for local-marketplace updates. For temporary Claude Code/CodeBuddy development sessions, `--plugin-dir` instead points to the **inner plugin directory**.

GitHub Actions uploads the three archives together as `jev-checkpoint-installers`; downloads may require a GitHub login. Git URL installation needs neither the archive nor a local build.

ZIP 自带完整本地市场和插件，不需要再从源码拼装。三端包应分别解压，添加外层目录作为市场；临时 `--plugin-dir` 才指向内层插件。不要只导入 Skill，否则缺少 MCP。

## Credentials / 密钥

All three packages use the same credential loader:

1. Nonempty `JEV_API_KEY` inherited by MCP.
2. Nonempty `JEV_CHECKPOINT_PLUGIN_KEY` supplied by the WorkBuddy private plugin option `api_key`.
3. `~/.config/jev-checkpoint/credentials.json`, or the file selected by `JEV_CHECKPOINT_CONFIG`.

The WorkBuddy option is marked sensitive and defaults to empty. On clients exposing the private plugin configuration form, use it; an empty form preserves environment/file fallback. UI presentation and secure storage are host responsibilities. This release has tested the option's configuration and MCP injection, not an interactive secret-entry GUI flow.

The shared fallback on every host is `node "<configureScript returned by jev_checkpoint_status>"`. Run it in a terminal, enter the key at the hidden prompt, and never send keys in chat. The helper stores a plaintext key outside the plugin cache with POSIX file permissions 0600. An already-ready status does not require another setup step, but only a successful review verifies upstream authentication.

同一台机器、同一用户下，三端可以读取同一个凭据文件。远端机器和沙箱需要各自配置。密钥不包含在安装包内，插件卸载也不会自动清理单独保存的凭据文件。

## Invocation and updates

Open a new task/session after installation or update. Where supported, the host's documented plugin reload can also activate changes.

| Host | Explicit invocation | Update after marketplace refresh | Remove |
| --- | --- | --- | --- |
| Codex | `$jev-checkpoint` | `codex plugin marketplace upgrade jev-checkpoint`, then `codex plugin add jev-checkpoint@jev-checkpoint` | `codex plugin remove jev-checkpoint@jev-checkpoint` |
| Claude Code | `/jev-checkpoint:jev-checkpoint` | `claude plugin marketplace update jev-checkpoint`, then `claude plugin update jev-checkpoint@jev-checkpoint` | `claude plugin uninstall jev-checkpoint@jev-checkpoint` |
| WorkBuddy native CLI | Ask to use Jev Checkpoint / select the installed skill | `codebuddy plugin marketplace update jev-checkpoint`, then `codebuddy plugin update jev-checkpoint@jev-checkpoint` | `codebuddy plugin uninstall jev-checkpoint@jev-checkpoint` |

For WorkBuddy CLI commands, preserve the same profile selection used at install. Remove a no-longer-needed marketplace using the corresponding `plugin marketplace remove jev-checkpoint` command. Do not install two variants into the same host: the shared plugin identity deliberately stays the same.

Automatic Skill selection varies by host and model. Tool names can have namespace prefixes; the shared skill uses the actual advertised tools from the Jev Checkpoint server. This package does not install hooks to force every prompt through Jev.

## Cross-host task handoff / 跨端接力

Keep `{checkpointId, task, outgoingAttemptsUsed, lastEvaluatedDiff, lastResult}` with the task's notes, excluding secrets and respecting the project's data rules. A new process has fresh counters/cache, but does not renew the skill's two-attempt task policy. With two attempts consumed, continue locally; with one consumed, use at most the remaining attempt and compare with the carried result manually.

本版没有跨进程数据库或账户消费上限。跨客户端的预算依靠任务记录与 Skill 规则衔接，不能把它当作强制共享的额度限制。

## Evidence and sources

See [verification records](verification.md) for exact versions, checks and limits. Claude browser chat and arbitrary older WorkBuddy versions are not part of the tested compatibility claim.

- [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference) and [marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [WorkBuddy plugin system](https://www.codebuddy.cn/docs/workbuddy/Plugins) and [official connector channel](https://open.workbuddy.cn/docs/connector)
- WorkBuddy 5.5.6 also ships its native plugin reference and marketplace guide under its bundled CLI documentation. The native loader and documentation were inspected locally to verify `.codebuddy-plugin`, `CODEBUDDY_PLUGIN_ROOT`, `userConfig` and profile isolation.
