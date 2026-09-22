---
name: jev-checkpoint
description: Use when the user requests Jev Checkpoint, or when a coding task changes behavior, contracts, reliability, security boundaries, or multiple related files and Jev Checkpoint tools are available. Usually skip formatting and prose-only edits.
---

# Jev Checkpoint

Use Jev as a quality signal for a focused change. The current coding assistant owns diagnosis, code changes, validation and final judgment. Jev returns scores and confidence, not explanations or proven defects.

## Start

Find the tools advertised by the Jev Checkpoint MCP server. Hosts may prefix their names; use the actual advertised names corresponding to `jev_checkpoint_status` and `jev_checkpoint_review`. If multiple servers expose these names, select the configured Jev Checkpoint server rather than guessing. Importing this skill alone does not install its MCP server.

Call `jev_checkpoint_status` before the first evaluation. `ready` means credentials exist, not that authentication succeeded. If tools or credentials are unavailable, continue authorized local work and report that Jev evaluation did not run. If ready, use the existing configuration without requesting another key. Otherwise, use the host's private credential form or the returned `configureScript`, a local Node script the user runs in a terminal. Never request a key in chat or put one in tool arguments. Read [setup](references/setup.md) only for installation or configuration problems.

Choose one stable `checkpointId` for the task. Preserve it across retries and changes; recover it from earlier tool calls when resuming. If the previous ID or attempt count cannot be recovered, continue local review and disclose the uncertainty instead of opening a fresh budget. Use this workflow instead of running a second `jev-review` loop over the same work.

When handing the task to another host, carry the checkpoint ID, unchanged task wording, outgoing attempts consumed, and last evaluated diff/result. A fresh MCP process has no previous counters, cache or comparison state; it does not renew the task's two-attempt policy. If two attempts were already consumed, continue locally. If one remains, use it at most once and compare against the carried result yourself; do not claim server-side history survived the switch.

## Evaluate and improve

1. Implement the requested change and run relevant checks. For a review-only request, inspect and report without editing. If there is no actual change diff, review locally and disclose that this diff-oriented Jev workflow was skipped; do not invent a diff.
2. Collect the current task-owned diff. Include untracked files only when part of this task; leave unrelated user changes untouched. Add callers, contracts or validation evidence only when necessary. Exclude secrets, credential files and unrelated private content. The submitted context goes to TypeSafe; follow the user's data-sharing restrictions. If essential context cannot be shared, skip external review and disclose the limitation.
3. Call `jev_checkpoint_review` with `checkpointId`, `task`, `diff`, and optional `context` / `files`. Keep task wording and scope stable. Submit current code, not an obsolete diff. The combined JSON-serialized `task`, `diff`, `context` and `files` is limited to 48,000 UTF-8 bytes; select a coherent slice rather than blindly truncating evidence.
4. Inspect weak or uncertain dimensions against actual code and requirements. Scores use **0–4**, higher is better. `assessable:false` means insufficient evidence. `needsInspection` is a hint, not a defect. There is no overall pass score. Do not rewrite code to chase a number.
5. If a concrete problem warrants a change within the user's request, make the smallest justified fix and validate it. Use the same checkpoint ID for one follow-up evaluation; comparison is computed locally. Stop when no evidence-backed improvement remains or the two-attempt budget is exhausted.

The server allows two outgoing attempts per checkpoint per process, including failures. Identical successful inputs are cached. Do not resubmit unchanged inputs for a different score, rotate IDs, or restart to evade the task budget. An authentication or timeout error is not a passing review. Fix its cause before considering a retry within the remaining budget. If work changes after the last evaluation, identify that result as stale.

## Final report

Briefly state: code-backed findings and actions; checks actually run; whether Jev evaluated the final diff, was skipped, failed, or became stale; attempts used and relevant remaining uncertainty. Scores never replace tests or user acceptance criteria. Do not claim measured speedups or cost savings without a baseline.
