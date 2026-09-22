import { createHash } from 'node:crypto';
import { reviewSchema, containsSensitiveContext, MAX_CONTEXT_BYTES, type ReviewInput } from './input.js';
import { questions, parseEvaluation, type Evaluation } from './rubric.js';
export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const MAX_ATTEMPTS = 2;
type Result = {
  status: 'evaluated' | 'unavailable' | 'blocked'; requestsRemaining: number;
  checkpointId?: string; error?: { code: string; message: string }; cached?: boolean;
  metrics?: Evaluation['metrics']; model?: string; usage?: Evaluation['usage'];
  comparison?: Record<string, number>; scoreRange?: [number, number];
  attempts?: number; contextHash?: string;
};
type Checkpoint = { task: string; attempts: number; cached: Map<string, Result>; previous?: Evaluation };
type Options = { getApiKey: () => string | undefined; fetch?: (url: string, init: RequestInit) => Promise<Response>; timeoutMs?: number };
class UpstreamError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
async function readResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new UpstreamError('INVALID_RESPONSE', 'Jev returned an empty response.');
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 256000) {
        await reader.cancel();
        throw new UpstreamError('INVALID_RESPONSE', 'Jev returned an oversized response.');
      }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
export class CheckpointService {
  private readonly checkpoints = new Map<string, Checkpoint>();
  private readonly locks = new Map<string, Promise<void>>();
  private readonly fetcher: NonNullable<Options['fetch']>;
  constructor(private readonly options: Options) { this.fetcher = options.fetch ?? fetch; }
  async review(raw: unknown): Promise<Result> {
    const parsed = reviewSchema.safeParse(raw);
    if (!parsed.success) return this.failure('INVALID_INPUT', 'Provide a stable checkpointId, task and nonempty focused diff; check field sizes and types.', 0);
    const input = parsed.data;
    const prior = this.locks.get(input.checkpointId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.locks.set(input.checkpointId, current);
    await prior;
    try { return await this.evaluate(input); }
    finally { release(); if (this.locks.get(input.checkpointId) === current) this.locks.delete(input.checkpointId); }
  }
  private failure(code: string, message: string, attempts: number, checkpointId?: string, status: Result['status'] = 'blocked'): Result {
    return { status, error: { code, message }, attempts,
      requestsRemaining: Math.max(0, MAX_ATTEMPTS - attempts) };
  }
  private async evaluate(input: ReviewInput): Promise<Result> {
    const { checkpointId, task, diff, context, files } = input;
    let checkpoint = this.checkpoints.get(checkpointId);
    const fail = (code: string, message: string, unavailable = false) => this.failure(code, message, checkpoint?.attempts ?? 0, checkpointId, unavailable ? 'unavailable' : 'blocked');
    const state = { task, diff, ...(context !== undefined ? { context } : {}), ...(files !== undefined ? { files } : {}) };
    const serialized = JSON.stringify(state);
    if (Buffer.byteLength(serialized) > MAX_CONTEXT_BYTES) return fail('CONTEXT_TOO_LARGE', 'Reduce unrelated context or review a coherent slice; limit is 48,000 UTF-8 bytes. Do not blindly truncate contracts.');
    if (containsSensitiveContext(input)) return fail('SENSITIVE_CONTEXT', 'Remove credential material and sensitive files before submitting. No content was sent.');
    if (checkpoint && checkpoint.task !== task) return fail('TASK_MISMATCH', 'Keep the same task and review scope within a checkpoint. A genuinely different task needs its own ID.');
    const hash = createHash('sha256').update(serialized).digest('hex');
    const cached = checkpoint?.cached.get(hash);
    if (cached) return { ...cached, cached: true, attempts: checkpoint!.attempts, requestsRemaining: MAX_ATTEMPTS - checkpoint!.attempts };
    if (checkpoint && checkpoint.attempts >= MAX_ATTEMPTS) return fail('BUDGET_EXHAUSTED', 'Two outgoing attempts used. Continue local validation; do not rotate IDs or restart to evade the task budget.');
    let apiKey: string | undefined;
    try { apiKey = this.options.getApiKey()?.trim(); }
    catch { return fail('INVALID_CONFIG', 'Could not read credentials. Re-run the local configure helper; never paste keys into chat.', true); }
    if (!apiKey) return fail('MISSING_API_KEY', 'Configure your TypeSafe key with the local configure helper or JEV_API_KEY. A Vercel Gateway key is not supported.', true);
    if (JSON.stringify(input).includes(apiKey)) return fail('SENSITIVE_CONTEXT', 'The configured API key appears in the input. Remove it before submitting.');
    if (!checkpoint) {
      if (this.checkpoints.size >= 500) return fail('CAPACITY_REACHED', 'This MCP process has tracked 500 tasks. Start a new session for new work; existing budgets are not evicted.');
      checkpoint = { task, attempts: 0, cached: new Map() };
      this.checkpoints.set(checkpointId, checkpoint);
    }
    // Reserve before awaiting I/O. Failed or timed-out requests may still be billed.
    checkpoint.attempts++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30000);
    try {
      const response = await this.fetcher(ENDPOINT, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'jev-latest', state, questions: questions() })
      });
      if (!response.ok) {
        await response.body?.cancel();
        const code = response.status === 401 ? 'AUTH_FAILED' : response.status === 429 ? 'RATE_LIMITED' : 'API_ERROR';
        throw new UpstreamError(code, `TypeSafe returned HTTP ${response.status}. No automatic retry was made. Check credentials, quota or service availability as appropriate.`);
      }
      let evaluation: Evaluation;
      try { evaluation = parseEvaluation(await readResponse(response)); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new UpstreamError('INVALID_RESPONSE', 'Jev returned a response outside the expected schema. No quality result is available.');
      }
      const comparison: Record<string, number> = {};
      if (checkpoint.previous) for (const [key, metric] of Object.entries(evaluation.metrics)) {
        const old = checkpoint.previous.metrics[key];
        if (metric.assessable && old?.assessable && metric.score !== undefined && old.score !== undefined)
          comparison[key] = Math.round((metric.score - old.score) * 1000) / 1000;
      }
      const result: Result = { status: 'evaluated', checkpointId, contextHash: hash, cached: false,
        scoreRange: [0, 4], ...evaluation, ...(checkpoint.previous ? { comparison } : {}),
        attempts: checkpoint.attempts, requestsRemaining: MAX_ATTEMPTS - checkpoint.attempts };
      checkpoint.previous = evaluation;
      checkpoint.cached.set(hash, result);
      return result;
    } catch (error) {
      if (controller.signal.aborted) return fail('TIMEOUT', 'Jev timed out. This attempt counts toward the budget; no automatic retry was made.', true);
      if (error instanceof UpstreamError) return fail(error.code, error.message, true);
      return fail('NETWORK_ERROR', 'Could not reach TypeSafe. This attempt counts toward the budget; no automatic retry was made.', true);
    } finally { clearTimeout(timeout); }
  }
}
