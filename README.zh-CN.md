# Jev Checkpoint

[English](README.md)

**一套核心代码，分别生成 Codex、Claude Code、WorkBuddy 三端安装包**，包含共用的 Skill 与两种可互换接口——自带的本地 **MCP 服务**和自带的**命令行工具（CLI）**；另有一个只含 CLI 的技能包用于 **WorkBuddy 技能市场**。当前编程助手负责实现、定位问题和测试，Jev 对提交的代码上下文提供质量信号。每个任务检查点最多发出两次 API 请求，失败请求也计入次数。

这是 machaomc 维护的社区项目，不是 OpenAI、Anthropic、腾讯或 TypeSafe 官方产品。它不会替换宿主模型，也不会自动接管每条需求的路由；没有固定提速或省钱倍数承诺。

## 从 GitHub URL 安装

需要支持插件市场的宿主、MCP 运行主机 PATH 中可用的 **Node.js 20+**，以及用户自己的 **TypeSafe API Key**。已验证版本与边界见[兼容性说明](docs/compatibility.md)。

**Codex：**仓库已经包含可运行的服务及依赖，安装插件不需要运行 npm install 或构建。

```sh
codex plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
codex plugin add jev-checkpoint@jev-checkpoint
```

**Claude Code：**

```sh
claude plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
claude plugin install jev-checkpoint@jev-checkpoint
```

**WorkBuddy 原生插件界面：**

```text
/plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
/plugin install jev-checkpoint@jev-checkpoint
```

WorkBuddy 使用原生插件通道，暂不提交官方连接器市场。独立安装的 CodeBuddy CLI 可能使用不同的用户配置目录，详见[三端安装指南](docs/compatibility.md)。

安装后开启一个**新任务或会话**，输入：

> 使用 Jev Checkpoint，先检查配置，告诉我本机密钥配置脚本的位置。

`jev_checkpoint_status` 返回 `configureScript`，用终端运行 `node "返回的脚本绝对路径"`，在隐藏输入提示中粘贴 TypeSafe 密钥。不要把密钥发到聊天里或放在命令行参数中。

也可以通过仓库副本配置，读取的是同一个用户级凭据文件：

```sh
git clone https://github.com/machaomc/jev-checkpoint.git
cd jev-checkpoint
node plugins/jev-checkpoint/scripts/configure.mjs
```

配置脚本将密钥以明文保存到 `~/.config/jev-checkpoint/credentials.json`，POSIX 系统文件权限为 `0600`，不在仓库或插件缓存中。Windows 用户应确保其位于私人用户目录并设置适当权限。服务每次评估都会重新读取该文件，因此桌面应用不必依赖终端环境继承。

密钥优先级为：非空 `JEV_API_KEY` → WorkBuddy 私密插件表单注入的 `JEV_CHECKPOINT_PLUGIN_KEY` → 本地凭据文件。WorkBuddy 的可选 `api_key` 表单留空时，会继续使用现有环境变量或凭据文件；已配置成功无需反复录入。可用 `JEV_CHECKPOINT_CONFIG` 指定其他文件位置，但配置脚本和 MCP 进程都必须获得这一设置。密钥来自 [TypeSafe 控制台](https://console.typesafe.ai/)，API 用量独立计费；当前版本不能直接使用 Vercel AI Gateway 密钥。

`ready: true` 只表示本机存在配置；真实评估成功才说明认证和 API 调用正常。

## 作为 WorkBuddy 技能安装（仅 CLI）

WorkBuddy 技能市场只分发说明文档和脚本，不会注册 MCP 服务。针对这个渠道，本仓库额外生成一个自带 CLI 的独立压缩包：

```sh
npm run build
# artifacts/jev-checkpoint-skill-0.2.0.zip   （SHA-256 见 artifacts/SHA256SUMS.json）
```

上传时直接使用该 ZIP，不要上传解压后的目录或单个 `SKILL.md`。安装后开启新任务并指定使用 Jev Checkpoint，技能会给出当前副本的 `cliScript` 与 `configureScript` 路径。仍然需要 TypeSafe 密钥，48,000 字节上下文上限和两次评估额度同样适用。CLI 的调用次数按用户和机器记录，因此跨多次终端调用仍然累计，并在十二小时后过期。

上面三个插件包也在 `dist/cli.cjs` 内置了同一个 CLI。一个任务只选用一种接口，切换接口不会重置额度。

## 日常使用

> 使用 Jev Checkpoint 完成这个修改。先运行相关检查，再评估当前任务的 diff；只修复有代码证据的问题。

流程是：实现与验证 → 首次评估 → 当前编程助手核实问题 → 必要时修复与验证 → 最多一次复评。纯文案、格式修改通常跳过。只要求评审时，Skill 不应自行改代码；没有真实变更 diff 时进行本地评审，并说明跳过了这个面向 diff 的 Jev 流程。如果已安装 `jev-review`，每个任务选用一套流程，避免重复调用。

Codex 可用 `$jev-checkpoint`，Claude Code 可用 `/jev-checkpoint:jev-checkpoint`；WorkBuddy 可选择已安装的 Skill 或自然语言指定。是否自动触发仍取决于宿主与模型，安装成功不代表每个任务都会自动调用。工具名可能带有平台前缀。

工具：

| 工具 | 作用 |
| --- | --- |
| `jev_checkpoint_status` | 本地检查配置，不调用 API，不显示密钥。 |
| `jev_checkpoint_review` | 把明确提交的上下文发送给 TypeSafe，不自动读取或修改仓库。 |

两种接口调用同一套逻辑，请以 status 结果中的 `cliScript` 为准，不要猜测路径。用 CLI 提交时，把同一个 JSON 对象写到仓库外的临时文件再运行：

```sh
node "<cliScript>" review /tmp/jev-payload.json
node "<cliScript>" review - < /tmp/jev-payload.json
```

它在标准输出打印一个 JSON 对象，`status` 不是 `evaluated` 时以非零码退出。内容只走文件或标准输入，绝不能作为命令行参数传入；用完请删除临时文件。

评估字段为 `checkpointId`、`task`、`diff`，可选 `context` 和 `files`。同一任务保持检查点 ID、任务说明和评审范围一致。复评提交当前代码；无需传入上次评分，服务在本地比较。跨宿主接力时带上 ID、原任务说明、已消耗次数及最后的 diff/结果；新进程不保留旧缓存和比较记录，也不代表任务重新获得两次额度。

## 评分与预算

- 独立评估正确性、可维护性、测试、可靠性、安全性、兼容性六个维度。
- 分数范围 **0–4**，越高越好；没有综合分或自动通过线。
- 证据概率低于 `0.8` 时返回 `assessable:false`，不展示该维度分数。这是保守的、尚未校准的产品规则；并不代表代码有错或没错。
- 可评估维度分数低于 `3` 或置信度低于 `0.6` 时提示检查，不能直接据此重写代码。
- 上下文最多 48,000 UTF-8 字节，最多显式提供 20 个文件。字节数不等于 token 数，上游仍可能拒绝超限请求。
- 每个检查点最多两次发出请求，失败和超时也计入；单次超时 30 秒，没有自动重试。MCP 的次数记在该服务进程内；CLI 按用户和机器记录在 `~/.config/jev-checkpoint/checkpoints.json`，条目十二小时后过期。
- 相同的**成功请求**会复用缓存，并发请求按检查点串行处理。失败后的再次请求仍会消耗一次机会。
- 预算不是账户消费上限：新 ID 或进程重启会产生新计数。Skill 要求不得通过换 ID、重启或切换接口绕过任务限制。
- 密钥缺失、API 故障、格式不兼容、预算耗尽都会明确报错。评分不能代替测试，最终代码变化后旧结果必须标为过期。

## 数据边界

`task`、`diff`、可选的 `context` 和 `files` 会发送至 TypeSafe。MCP 进程在本地运行不代表模型推理离线。检查点 ID 和历史比较不作为评估状态发送；密钥仅用于固定 HTTPS 端点的认证头，禁止重定向。没有作者运营的代理或遥测。

服务会拦截部分常见凭据格式、凭据文件路径和已配置的密钥，但这不是完整的秘密扫描器。提交前仍须选择和检查上下文，遵守项目的数据共享约束。MCP 不将代码写入磁盘；宿主和 TypeSafe 有各自的数据政策。参阅 [TypeSafe 隐私政策](https://typesafe.ai/privacy)。

## 更新、卸载与故障排查

```sh
codex plugin marketplace upgrade jev-checkpoint
codex plugin add jev-checkpoint@jev-checkpoint
```

以上是 Codex 的更新命令；Claude Code 与 WorkBuddy 的命令见[兼容性说明](docs/compatibility.md)。更新后开启新任务。Codex 卸载时运行：

```sh
codex plugin remove jev-checkpoint@jev-checkpoint
codex plugin marketplace remove jev-checkpoint
```

单独保存的密钥文件不会自动删除。

找不到工具时检查插件是否启用、Node 是否对桌面应用可见，并开启新任务。`MISSING_API_KEY` / `INVALID_CONFIG` 时重新运行配置脚本；`AUTH_FAILED` 时检查 TypeSafe 密钥；`CONTEXT_TOO_LARGE` 时缩小无关上下文；`BUDGET_EXHAUSTED` 时继续本地验证并如实报告；`TASK_MISMATCH`（CLI）表示该 ID 在本机已用于另一段任务说明，确实不同的任务应另起 ID。不要输出凭据文件内容。

## 开发与验证

```sh
npm ci --ignore-scripts
npm run validate
```

默认测试使用本地响应样例，不产生真实 API 费用。覆盖预算、并发、缓存、异常响应、凭据边界，以及实际 MCP stdio 通信。独立安装测试只复制插件目录，在没有 node_modules 的位置启动。

`npm run build` 或 `npm run package` 会从 `src/` 编译 MCP 服务和 CLI，生成三端目录、技能渠道目录 `packages/workbuddy-skill/jev-checkpoint`，以及 `artifacts/` 中的四个 ZIP 和 SHA-256 校验文件。插件 ZIP 自带本地市场入口：解压后将外层 `jev-checkpoint` 目录添加到对应平台的市场，再安装插件。GitHub Actions 会提供名为 `jev-checkpoint-installers` 的构建产物。

开发只修改 `src/`、`shared/`、`packaging/`；版本以 `package.json` 为准。生成的三端目录、技能目录和市场清单随代码提交，CI 检查重新生成后是否一致。

已配置密钥后，可以显式运行 `npm run smoke:live`。它会产生两次真实 API 请求，只使用合成示例，验证接口、缓存及第三次请求拦截，不提交你的仓库。联网成功不等于已证明评审准确性或节省成本。具体证据见 [验证记录](docs/verification.md)。

## GitHub URL 与官方市场

这个仓库分别提供 `.agents/plugins`、`.claude-plugin`、`.codebuddy-plugin` 市场入口，同一 GitHub URL 可供各宿主选择对应安装包。它不会自动进入 OpenAI 官方公共目录；官方收录需要另行提交审核，常规 With MCP 提交通道目前要求公开 HTTPS MCP 端点，而这一版使用本地 stdio。[官方打包说明](https://developers.openai.com/plugins/build/plugins)

Codex 包位于 `plugins/jev-checkpoint`，Claude Code 和 WorkBuddy 包分别位于 `packages/claude/jev-checkpoint`、`packages/workbuddy/jev-checkpoint`。请使用上面的市场安装命令；在插件宿主上用普通“从 URL 安装 Skill”的流程可能只安装指令，遗漏 MCP 服务。

WorkBuddy 技能市场是独立渠道，有自己的制品：它接受纯指令型技能，因此本项目把 CLI 打进包内，技能也不会声称注册了 MCP。详见[技能打包说明](packaging/workbuddy-skill/README.md)。

本项目受到 [jev-review](https://github.com/NiazMorshed2007/jev-review) 启发，采用独立实现。许可：[MIT](LICENSE)。
