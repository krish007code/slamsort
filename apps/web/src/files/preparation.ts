import type { LocalFile } from './engine';
export interface PreparedFile { file: File; snippet: string }
const TEXT = /\.(txt|md|csv|json|log|css|html|js|ts|py|yaml|yml)$/i;
/** Local-only readiness: open the file and prepare a bounded preview before play. */
export async function prepareFile(handle: LocalFile): Promise<PreparedFile> {
  const file = await handle.getFile();
  const snippet = TEXT.test(file.name) ? await file.slice(0, 1800).text() : '';
  // Other formats are ready with metadata; the preview renderer may enhance them.
  return { file, snippet };
}
export function bufferTarget(total: number) { return Math.min(4, Math.max(0, total)); }
