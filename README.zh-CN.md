# Jev Checkpoint

[English](README.md)

一个完整的 Codex 插件，包含 **Skill + 本地 MCP 服务**。Codex 负责实现、定位问题和测试，Jev 对提交的代码上下文提供质量信号。每个任务检查点在同一个 MCP 进程内最多发出两次 API 请求，失败请求也计入次数。

这是 machaomc 维护的社区项目，不是 OpenAI 或 TypeSafe 官方产品。它不会替换 Codex 模型，也不会自动接管每条需求的路由；没有固定提速或省钱倍数承诺。

## 从 GitHub URL 安装

需要支持插件市场的当前 Codex 桌面版或 CLI、运行主机 PATH 中可用的 **Node.js 20+**，以及用户自己的 **TypeSafe API Key**。仓库已经包含可运行的服务及依赖，安装插件不需要运行 npm install 或构建。

```sh
codex plugin marketplace add https://github.com/machaomc/jev-checkpoint.git
codex plugin add jev-checkpoint@jev-checkpoint
```

安装后开启一个**新的 Codex 任务**，输入：

> 使用 Jev Checkpoint，先检查配置，告诉我本机密钥配置脚本的位置。

`jev_checkpoint_status` 返回 `configureScript`，用终端运行 `node "返回的脚本绝对路径"`，在隐藏输入提示中粘贴 TypeSafe 密钥。不要把密钥发到聊天里或放在命令行参数中。

也可以通过仓库副本配置，读取的是同一个用户级凭据文件：

```sh
git clone https://github.com/machaomc/jev-checkpoint.git
cd jev-checkpoint
node plugins/jev-checkpoint/scripts/configure.mjs
```

配置脚本将密钥以明文保存到 `~/.config/jev-checkpoint/credentials.json`，POSIX 系统文件权限为 `0600`，不在仓库或插件缓存中。Windows 用户应确保其位于私人用户目录并设置适当权限。服务每次评估都会重新读取该文件，因此桌面应用不必依赖终端环境继承。

如 MCP 进程继承了 `JEV_API_KEY`，它优先于文件。可用 `JEV_CHECKPOINT_CONFIG` 指定其他文件位置，但配置脚本和 MCP 进程都必须获得这一设置。密钥来自 [TypeSafe 控制台](https://console.typesafe.ai/)，API 用量独立计费；当前版本不能直接使用 Vercel AI Gateway 密钥。

`ready: true` 只表示本机存在配置；真实评估成功才说明认证和 API 调用正常。

## 日常使用

> 使用 $jev-checkpoint 完成这个修改。先运行相关检查，再评估当前任务的 diff；只修复有代码证据的问题。

流程是：实现与验证 → 首次评估 → Codex 核实问题 → 必要时修复与验证 → 最多一次复评。纯文案、格式修改通常跳过。只要求评审时，Skill 不应自行改代码；没有真实变更 diff 时进行本地评审，并说明跳过了这个面向 diff 的 Jev 流程。如果已安装 `jev-review`，每个任务选用一套流程，避免重复调用。

工具：

| 工具 | 作用 |
| --- | --- |
| `jev_checkpoint_status` | 本地检查配置，不调用 API，不显示密钥。 |
| `jev_checkpoint_review` | 把明确提交的上下文发送给 TypeSafe，不自动读取或修改仓库。 |

评估字段为 `checkpointId`、`task`、`diff`，可选 `context` 和 `files`。同一任务保持检查点 ID、任务说明和评审范围一致。复评提交当前代码；无需传入上次评分，服务在本地比较。

## 评分与预算

- 独立评估正确性、可维护性、测试、可靠性、安全性、兼容性六个维度。
- 分数范围 **0–4**，越高越好；没有综合分或自动通过线。
- 证据概率低于 `0.8` 时返回 `assessable:false`，不展示该维度分数。这是保守的、尚未校准的产品规则；并不代表代码有错或没错。
- 可评估维度分数低于 `3` 或置信度低于 `0.6` 时提示检查，不能直接据此重写代码。
- 上下文最多 48,000 UTF-8 字节，最多显式提供 20 个文件。字节数不等于 token 数，上游仍可能拒绝超限请求。
- 每个检查点在同一进程内最多两次发出请求，失败和超时也计入；单次超时 30 秒，没有自动重试。
- 相同的**成功请求**会复用缓存，并发请求按检查点串行处理。失败后的再次请求仍会消耗一次机会。
- 预算不是账户消费上限：新 ID 或进程重启会产生新计数。Skill 要求不得通过换 ID 或重启绕过任务限制。
- 密钥缺失、API 故障、格式不兼容、预算耗尽都会明确报错。评分不能代替测试，最终代码变化后旧结果必须标为过期。

## 数据边界

`task`、`diff`、可选的 `context` 和 `files` 会发送至 TypeSafe。MCP 进程在本地运行不代表模型推理离线。检查点 ID 和历史比较不作为评估状态发送；密钥仅用于固定 HTTPS 端点的认证头，禁止重定向。没有作者运营的代理或遥测。

服务会拦截部分常见凭据格式、凭据文件路径和已配置的密钥，但这不是完整的秘密扫描器。提交前仍须选择和检查上下文，遵守项目的数据共享约束。MCP 不将代码写入磁盘；宿主和 TypeSafe 有各自的数据政策。参阅 [TypeSafe 隐私政策](https://typesafe.ai/privacy)。

## 更新、卸载与故障排查

```sh
codex plugin marketplace upgrade jev-checkpoint
codex plugin add jev-checkpoint@jev-checkpoint
```

更新后开启新任务。卸载时运行：

```sh
codex plugin remove jev-checkpoint@jev-checkpoint
codex plugin marketplace remove jev-checkpoint
```

单独保存的密钥文件不会自动删除。

找不到工具时检查插件是否启用、Node 是否对桌面应用可见，并开启新任务。`MISSING_API_KEY` / `INVALID_CONFIG` 时重新运行配置脚本；`AUTH_FAILED` 时检查 TypeSafe 密钥；`CONTEXT_TOO_LARGE` 时缩小无关上下文；`BUDGET_EXHAUSTED` 时继续本地验证并如实报告。不要输出凭据文件内容。

## 开发与验证

```sh
npm ci --ignore-scripts
npm run validate
```

默认测试使用本地响应样例，不产生真实 API 费用。覆盖预算、并发、缓存、异常响应、凭据边界，以及实际 MCP stdio 通信。独立安装测试只复制插件目录，在没有 node_modules 的位置启动。

已配置密钥后，可以显式运行 `npm run smoke:live`。它会产生两次真实 API 请求，只使用合成示例，验证接口、缓存及第三次请求拦截，不提交你的仓库。联网成功不等于已证明评审准确性或节省成本。具体证据见 [验证记录](docs/verification.md)。

## GitHub URL 与官方市场

这个仓库包含 `.agents/plugins/marketplace.json`，可作为 **Codex 自定义插件市场**通过 GitHub URL 添加，再安装其中的完整插件。它不会自动进入 OpenAI 官方公共目录；官方收录需要另行提交审核，常规 With MCP 提交通道目前要求公开 HTTPS MCP 端点，而这一版使用本地 stdio。[官方打包说明](https://developers.openai.com/plugins/build/plugins)

插件位于 `plugins/jev-checkpoint` 子目录。请使用上面的市场安装命令；普通“从 URL 安装 Skill”可能只安装指令，遗漏 MCP 服务。

本项目受到 [jev-review](https://github.com/NiazMorshed2007/jev-review) 启发，采用独立实现。许可：[MIT](LICENSE)。
