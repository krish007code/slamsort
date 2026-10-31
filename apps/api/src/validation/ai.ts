import type { AiFileSummary, BucketNode, FileHintRequest, FolderPlanRequest } from '@slamsort/shared';
export class InputError extends Error {}
type ObjectValue = Record<string, unknown>;
function object(value: unknown, keys: string[]): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Expected an object.');
  const result = value as ObjectValue;
  if (Object.keys(result).some(key => !keys.includes(key))) throw new InputError('Unexpected field.');
  return result;
}
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new InputError('Invalid text length.');
  return value;
}
function id(value: unknown): string {
  const result = text(value, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new InputError('Invalid identifier.');
  return result;
}
export function safeSegment(value: unknown): string {
  const name = text(value, 80);
  if (name.trim() !== name || /[<>:"/\\|?*]/.test(name) || Array.from(name).some(c => c.charCodeAt(0) < 32)
    || /[. ]$/.test(name) || name === '.' || name === '..' || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) throw new InputError('Unsafe folder name.');
  return name;
}
function labels(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw new InputError('Expected 1–5 categories.');
  const result = value.map(safeSegment);
  if (new Set(result.map(s => s.toLocaleLowerCase())).size !== result.length) throw new InputError('Duplicate categories.');
  return result;
}
function fileSummary(value: unknown): AiFileSummary {
  const f = object(value, ['fileId', 'mimeType', 'size', 'approvedName']);
  if (typeof f.size !== 'number' || !Number.isSafeInteger(f.size) || f.size < 0) throw new InputError('Invalid file size.');
  return { fileId: id(f.fileId), mimeType: text(f.mimeType, 120, true), size: f.size,
    ...(f.approvedName !== undefined ? { approvedName: text(f.approvedName, 255) } : {}) };
}
export function planRequest(value: unknown): FolderPlanRequest {
  const v = object(value, ['sessionId', 'requestId', 'parentId', 'parentLabel', 'prompt', 'files']);
  // This local boundary intentionally has no membership upload route.
  if (!Array.isArray(v.files) || v.files.length !== 0) throw new InputError('Folder membership is not accepted.');
  return { sessionId: id(v.sessionId), requestId: id(v.requestId), parentId: v.parentId === null ? null : id(v.parentId),
    prompt: text(v.prompt, 2000), files: [], ...(v.parentLabel !== undefined ? { parentLabel: safeSegment(v.parentLabel) } : {}) };
}
export function hintRequest(value: unknown): FileHintRequest {
  const v = object(value, ['sessionId', 'requestId', 'planId', 'file', 'approvedBuckets', 'approvedExcerpt']);
  if (!Array.isArray(v.approvedBuckets)) throw new InputError('Missing buckets.');
  const buckets: BucketNode[] = v.approvedBuckets.map(value => {
    const b = object(value, ['id', 'parentId', 'label', 'kind']);
    if (b.kind !== 'category') throw new InputError('Only category hints are supported.');
    return { id: id(b.id), parentId: b.parentId === null ? null : id(b.parentId), label: safeSegment(b.label), kind: 'category' };
  });
  labels(buckets.map(b => b.label));
  if (new Set(buckets.map(b => b.id)).size !== buckets.length) throw new InputError('Duplicate bucket IDs.');
  return { sessionId: id(v.sessionId), requestId: id(v.requestId), planId: id(v.planId), file: fileSummary(v.file), approvedBuckets: buckets,
    ...(v.approvedExcerpt !== undefined ? { approvedExcerpt: text(v.approvedExcerpt, 8000, true) } : {}) };
}
export function planOutput(value: unknown): { categories: string[]; explanation: string } {
  const v = object(value, ['categories', 'explanation']);
  return { categories: labels(v.categories), explanation: text(v.explanation, 1500) };
}
export function hintOutput(value: unknown, buckets: readonly BucketNode[]): { suggestedBucketId: string | null; explanation: string } {
  const v = object(value, ['suggestedBucketId', 'explanation']);
  if (v.suggestedBucketId !== null && !buckets.some(b => b.id === v.suggestedBucketId)) throw new InputError('Unknown bucket.');
  return { suggestedBucketId: v.suggestedBucketId as string | null, explanation: text(v.explanation, 1500) };
}
export const PLAN_SCHEMA = { type: 'object', additionalProperties: false, required: ['categories', 'explanation'], properties: {
  categories: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } }, explanation: { type: 'string' },
} };
export const HINT_SCHEMA = { type: 'object', additionalProperties: false, required: ['suggestedBucketId', 'explanation'], properties: {
  suggestedBucketId: { type: ['string', 'null'] }, explanation: { type: 'string' },
} };
