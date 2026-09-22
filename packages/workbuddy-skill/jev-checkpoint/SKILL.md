---
name: jev-checkpoint
description: "Use when the user requests Jev Checkpoint, or when a coding task changes behavior, contracts, reliability, security boundaries, or multiple related files. Usually skip formatting and prose-only edits. 当用户要求 Jev 检查点，或代码改动涉及行为、接口契约、可靠性、安全边界或多个相关文件时使用；纯格式与文案改动跳过。"
allowed-tools: Read, Write, Bash
display_name: "Jev 代码质量检查点"
display_name_en: "Jev Checkpoint"
description_zh: "在关键代码改动后，用 Jev 检查点给本次 diff 打分（六个维度各 0–4 分并附置信度），把评分当作质量信号辅助自查，每个任务最多评估两次。技能自带命令行工具，装完即可使用，只需另行配置一个 TypeSafe API 密钥；评估时当前任务的代码 diff 会发送到 TypeSafe 服务。"
description_en: "Score a focused code change with Jev checkpoints (six dimensions, 0-4 each, plus confidence) as an extra quality signal after a coding task, at most two evaluations per task. Ships its own command-line tool, so no MCP setup is required; a TypeSafe API key is needed and the task diff is sent to the TypeSafe service for scoring."
author: "machaomc"
homepage: "https://github.com/machaomc/jev-checkpoint"
license: "MIT"
version: "0.2.0"
---

# Jev Checkpoint

Use Jev as a quality signal for a focused change. The current coding assistant owns diagnosis, code changes, validation and final judgment. Jev returns scores and confidence, not explanations or proven defects.

## Interface

Jev is reachable through one of two interchangeable interfaces. Both use the same endpoint, rubric, input limits, attempt budget and error codes. Pick whichever is available and keep it for the whole checkpoint.

- **MCP tools**, when a Jev Checkpoint MCP server is configured. Hosts may prefix their names; use the actual advertised names corresponding to `jev_checkpoint_status` and `jev_checkpoint_review`. If multiple servers expose these names, select the configured Jev Checkpoint server rather than guessing.
- **The bundled CLI**, `cli.cjs`, run through the shell tool. It is part of this package: `dist/cli.cjs` relative to the plugin root in a plugin install, `scripts/cli.cjs` relative to this skill's directory in a skill-market install. The status result reports its absolute path as `cliScript`; prefer that path over guessing.

Installing this skill does not by itself register an MCP server. Do not run both interfaces over the same task.

## Start

Check status before the first evaluation: call `jev_checkpoint_status` over MCP, or run `node "<cliScript>" status`. `ready` means credentials exist, not that authentication succeeded. If neither interface is available, or no credential exists, continue authorized local work and report that Jev evaluation did not run. If ready, use the existing configuration without requesting another key. Otherwise, use the host's private credential form or the returned `configureScript`, a local Node script the user runs in a terminal. Never request a key in chat or put one in tool arguments. Read [setup](references/setup.md) only for installation or configuration problems.

Choose one stable `checkpointId` for the task. Preserve it across retries and changes; recover it from earlier tool calls when resuming. If the previous ID or attempt count cannot be recovered, continue local review and disclose the uncertainty instead of opening a fresh budget. Use this workflow instead of running a second `jev-review` loop over the same work.

When handing the task to another host or interface, carry the checkpoint ID, unchanged task wording, outgoing attempts consumed, and last evaluated diff/result. A fresh MCP process has no previous counters, cache or comparison state; a different interface does not renew the task's two-attempt policy either. If two attempts were already consumed, continue locally. If one remains, use it at most once and compare against the carried result yourself; do not claim server-side history survived the switch.

## Evaluate and improve

1. Implement the requested change and run relevant checks. For a review-only request, inspect and report without editing. If there is no actual change diff, review locally and disclose that this diff-oriented Jev workflow was skipped; do not invent a diff.
2. Collect the current task-owned diff. Include untracked files only when part of this task; leave unrelated user changes untouched. Add callers, contracts or validation evidence only when necessary. Exclude secrets, credential files and unrelated private content. The submitted context goes to TypeSafe; follow the user's data-sharing restrictions. If essential context cannot be shared, skip external review and disclose the limitation.
3. Submit the review, keeping task wording and scope stable.
   - Over MCP: call `jev_checkpoint_review` with `checkpointId`, `task`, `diff`, and optional `context` / `files`.
   - Over the CLI: write that same JSON object to a temporary file outside the repository and run `node "<cliScript>" review <payload.json>`, or pipe it to stdin. Pass the payload as a file or stdin, never as a command argument, and delete the temporary file once the review returns. The CLI prints one JSON object on stdout and exits non-zero unless `status` is `evaluated`; read `status` and `error.code` before acting.

   Submit current code, not an obsolete diff. The combined JSON-serialized `task`, `diff`, `context` and `files` is limited to 48,000 UTF-8 bytes; select a coherent slice rather than blindly truncating evidence.
4. Inspect weak or uncertain dimensions against actual code and requirements. Scores use **0–4**, higher is better. `assessable:false` means insufficient evidence. `needsInspection` is a hint, not a defect. There is no overall pass score. Do not rewrite code to chase a number.
5. If a concrete problem warrants a change within the user's request, make the smallest justified fix and validate it. Use the same checkpoint ID for one follow-up evaluation; comparison is computed locally. Stop when no evidence-backed improvement remains or the two-attempt budget is exhausted.

Two outgoing attempts are allowed per checkpoint, including failures; identical successful inputs are cached. Over MCP the budget lives in that server process. Over the CLI it is recorded per user for the machine and entries expire after twelve hours, so re-running the command does not reset the count. Do not resubmit unchanged inputs for a different score, rotate IDs, restart, or switch interfaces to evade the task budget. An authentication or timeout error is not a passing review. Fix its cause before considering a retry within the remaining budget. If work changes after the last evaluation, identify that result as stale.

## Final report

Briefly state: code-backed findings and actions; checks actually run; whether Jev evaluated the final diff, was skipped, failed, or became stale; attempts used and relevant remaining uncertainty. Scores never replace tests or user acceptance criteria. Do not claim measured speedups or cost savings without a baseline.
