import { z } from 'zod';
export const reviewSchema = z.object({
  checkpointId: z.string().trim().min(1).max(128).describe('Stable task identifier. Reuse for the whole task; never rotate to bypass the two-attempt budget.'),
  task: z.string().trim().min(1).max(8000).describe('Requirements and acceptance criteria. Keep unchanged for comparable evaluations.'),
  diff: z.string().trim().min(1).max(120000).describe('Current task-owned diff. Exclude secrets and unrelated user changes.'),
  context: z.string().max(48000).optional().describe('Only relevant callers, contracts, repository conventions and actual validation results.'),
  files: z.array(z.object({ path: z.string().min(1).max(1000), content: z.string().max(48000) })).max(20).optional()
}).strict();
export type ReviewInput = z.infer<typeof reviewSchema>;
export const MAX_CONTEXT_BYTES = 48000;
function sensitivePath(value: string): boolean {
  const name = value.replace(/\\/g, '/').split('/').pop()?.replace(/"$/, '') ?? '';
  return /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|id_(?:rsa|ed25519)|credentials\.json)$/i.test(name) || /\.(pem|key|p12|pfx)$/i.test(name);
}
export function containsSensitiveContext(input: ReviewInput): boolean {
  if (input.files?.some(file => sensitivePath(file.path))) return true;
  const paths = input.diff.split('\n').filter(line => /^(diff --git |--- |\+\+\+ )/.test(line));
  if (paths.some(line => line.split(/[\s"]+/).some(sensitivePath))) return true;
  const text = JSON.stringify(input);
  return /-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9_]{20,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bapikey_[A-Za-z0-9_]{32,}|\bAKIA[A-Z0-9]{16}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/.test(text);
}
