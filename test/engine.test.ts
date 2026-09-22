import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CheckpointService } from '../src/engine.ts';

const dimensions = ['correctness', 'maintainability', 'tests', 'reliability', 'security', 'compatibility'];
function response(score = 3) {
  const answers: Record<string, unknown> = {};
  for (const key of dimensions) {
    answers[`${key}_evidence`] = { type: 'noul', noul: 0.95 };
    answers[key] = { type: 'score', score, confidence: 0.85,
      legend: { '0': 'Critical weaknesses', '1': 'Major weaknesses', '2': 'Mixed evidence', '3': 'Good', '4': 'Strong' },
      probabilities: { '0': 0, '1': 0, '2': 0, '3': 1, '4': 0 } };
  }
  return { model: 'jev-test', answers, usage: { input_tokens: 1200, output_tokens: 100 } };
}
const input = { checkpointId: 'task-1', task: 'Fix total calculation', diff: '- total = price\n+ total = price * quantity' };
function harness(body: unknown = response(), status = 200) {
  const requests: { url: string; init: RequestInit }[] = [];
  const service = new CheckpointService({ getApiKey: () => 'test-key', fetch: async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }});
  return { service, requests };
}

test('calls the documented endpoint with focused state and independent rubric questions', async () => {
  const { service, requests } = harness();
  const result = await service.review(input);
  assert.equal(result.status, 'evaluated');
  assert.equal(result.metrics?.correctness.score, 3);
  assert.equal(result.requestsRemaining, 1);
  assert.equal(requests[0].url, 'https://api.typesafe.ai/v1/systemone');
  const payload = JSON.parse(requests[0].init.body as string);
  assert.equal(payload.model, 'jev-latest');
  assert.equal(payload.state.diff, input.diff);
  assert.equal(payload.state.checkpointId, undefined);
  assert.equal(payload.questions.correctness.type, 'score');
  assert.equal(payload.questions.correctness.criteria.length, 5);
  assert.equal(payload.questions.correctness_evidence.type, 'noul');
});
test('identical requests reuse cached evaluation without spending again', async () => {
  const { service, requests } = harness();
  await service.review(input);
  const cached = await service.review(input);
  assert.equal(cached.cached, true);
  assert.equal(cached.requestsRemaining, 1);
  assert.equal(requests.length, 1);
});
test('changed code compares scores locally and a third attempt is blocked', async () => {
  const { service, requests } = harness();
  await service.review(input);
  const second = await service.review({ ...input, diff: input.diff + '\n+ validate(quantity)' });
  assert.equal(second.comparison?.correctness, 0);
  assert.equal(second.requestsRemaining, 0);
  const third = await service.review({ ...input, diff: input.diff + '\n+ third()' });
  assert.equal(third.error?.code, 'BUDGET_EXHAUSTED');
  assert.equal(requests.length, 2);
});
test('parallel identical inputs are deduplicated and changed requests respect the same budget', async () => {
  const { service, requests } = harness();
  const results = await Promise.all([service.review(input), service.review(input),
    service.review({ ...input, diff: '+ second()' }), service.review({ ...input, diff: '+ third()' })]);
  assert.equal(requests.length, 2);
  assert.equal(results.filter(r => r.error?.code === 'BUDGET_EXHAUSTED').length, 1);
});
test('missing credentials make no network request', async () => {
  let calls = 0;
  const service = new CheckpointService({ getApiKey: () => undefined, fetch: async () => { calls++; throw Error(); } });
  const result = await service.review(input);
  assert.equal(result.error?.code, 'MISSING_API_KEY');
  assert.equal(result.requestsRemaining, 2);
  assert.equal(calls, 0);
});
for (const status of [401, 429, 500]) test(`HTTP ${status} is not retried and never leaks upstream content`, async () => {
  const { service, requests } = harness({ message: 'secret-error-body' }, status);
  const result = await service.review(input);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.requestsRemaining, 1);
  assert.equal(requests.length, 1);
  assert.ok(!JSON.stringify(result).includes('secret-error-body'));
});
test('malformed or missing metric answers are rejected, not made into passing scores', async () => {
  const { service } = harness({ model: 'jev-test', answers: {}, usage: { input_tokens: 1, output_tokens: 1 } });
  const result = await service.review(input);
  assert.equal(result.error?.code, 'INVALID_RESPONSE');
  assert.equal(result.metrics, undefined);
});
test('out-of-range scores and incomplete probability distributions are rejected', async () => {
  for (const patch of [{ score: 4.1 }, { confidence: -0.1 }, { probabilities: { '0': 1 } }]) {
    const body = response();
    body.answers.correctness = { ...(body.answers.correctness as object), ...patch };
    const result = await harness(body).service.review(input);
    assert.equal(result.error?.code, 'INVALID_RESPONSE');
  }
});
test('network failure counts as an attempt without exposing exception text', async () => {
  let calls = 0;
  const service = new CheckpointService({ getApiKey: () => 'test-key', fetch: async () => { calls++; throw Error('secret-in-exception'); } });
  const first = await service.review(input);
  assert.equal(first.error?.code, 'NETWORK_ERROR');
  assert.ok(!JSON.stringify(first).includes('secret-in-exception'));
  await service.review(input);
  assert.equal((await service.review(input)).error?.code, 'BUDGET_EXHAUSTED');
  assert.equal(calls, 2);
});
test('context limit counts UTF-8 bytes, not JavaScript characters', async () => {
  const { service, requests } = harness();
  assert.equal((await service.review({ ...input, diff: '界'.repeat(17000) })).error?.code, 'CONTEXT_TOO_LARGE');
  assert.equal(requests.length, 0);
});
test('insufficient evidence does not expose a quality score', async () => {
  const body = response();
  body.answers.security_evidence = { type: 'noul', noul: 0.2 };
  const { service } = harness(body);
  const result = await service.review(input);
  assert.equal(result.metrics?.security.assessable, false);
  assert.equal(result.metrics?.security.score, undefined);
});
test('empty and excessive context is rejected before a paid request', async () => {
  const { service, requests } = harness();
  assert.equal((await service.review({ ...input, diff: ' ' })).error?.code, 'INVALID_INPUT');
  assert.equal((await service.review({ ...input, diff: 'x'.repeat(100_001) })).error?.code, 'CONTEXT_TOO_LARGE');
  assert.equal(requests.length, 0);
});
test('known credential material and sensitive file paths are rejected without echoing secrets', async () => {
  const { service, requests } = harness();
  const key = 'ghp_' + 'a'.repeat(36);
  for (const extra of [{ diff: '+ token = "' + key + '"' }, { files: [{ path: '.env.production', content: 'VALUE=1' }] },
    { diff: 'diff --git a/.env b/.env\n+VALUE=1' }]) {
    const result = await service.review({ ...input, ...extra });
    assert.equal(result.error?.code, 'SENSITIVE_CONTEXT');
    assert.ok(!JSON.stringify(result).includes(key));
  }
  assert.equal(requests.length, 0);
});
test('changing a checkpoint task is rejected to keep comparisons meaningful', async () => {
  const { service, requests } = harness();
  await service.review(input);
  const result = await service.review({ ...input, task: 'Unrelated feature' });
  assert.equal(result.error?.code, 'TASK_MISMATCH');
  assert.equal(requests.length, 1);
});
test('credential-bearing checkpoint identifiers are never reflected in errors', async () => {
  const { service, requests } = harness();
  for (const checkpointId of ['ghp_' + 'b'.repeat(36), 'test-key']) {
    const result = await service.review({ ...input, checkpointId });
    assert.equal(result.error?.code, 'SENSITIVE_CONTEXT');
    assert.ok(!JSON.stringify(result).includes(checkpointId));
  }
  assert.equal(requests.length, 0);
});
test('timeout ends a hanging upstream call without a hidden retry', async () => {
  let calls = 0;
  const service = new CheckpointService({ getApiKey: () => 'test-key', timeoutMs: 20,
    fetch: async (_url: string, init: RequestInit) => { calls++; return new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }); } });
  const result = await service.review(input);
  assert.equal(result.error?.code, 'TIMEOUT');
  assert.equal(result.requestsRemaining, 1);
  assert.equal(calls, 1);
});
