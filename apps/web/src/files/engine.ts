// Only this module mutates files. Browser copy/remove is deliberately not called atomic.
export interface LocalFile {
  kind: 'file'; name: string;
  getFile(): Promise<File>;
  isSameEntry(other: LocalFile | LocalDirectory): Promise<boolean>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
}
export interface LocalDirectory {
  kind: 'directory'; name: string;
  values(): AsyncIterable<LocalFile | LocalDirectory>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFile>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<LocalDirectory>;
  removeEntry(name: string): Promise<void>;
  isSameEntry(other: LocalFile | LocalDirectory): Promise<boolean>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}
export interface Fingerprint { size: number; modified: number; hashes: string[] }
export interface Entry {
  id: string; at: number; status: 'intent' | 'copied' | 'verified' | 'removing' | 'complete' | 'recovery' | 'retained';
  source: LocalDirectory; targetParent: LocalDirectory; target?: LocalDirectory; category?: string | undefined;
  sourceName: string; targetName: string; fingerprint: Fingerprint; destinationFingerprint?: Fingerprint; error?: string; undoOf?: string | undefined; undone?: boolean;
}
export interface Journal { put(entry: Entry): Promise<void>; all(): Promise<Entry[]> }
const CHUNK = 1024 * 1024;
export function validName(name: string): boolean {
  return name.trim() === name && name.length > 0 && name.length <= 80 && !/[<>:"/\\|?*]/.test(name) && !Array.from(name).some(c => c.charCodeAt(0) < 32) && !/[. ]$/.test(name) && name !== '.' && name !== '..' && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name);
}
export async function fingerprint(file: File): Promise<Fingerprint> {
  const hashes: string[] = [];
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    const hash = await crypto.subtle.digest('SHA-256', await file.slice(offset, offset + CHUNK).arrayBuffer());
    hashes.push(Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join(''));
  }
  return { size: file.size, modified: file.lastModified, hashes };
}
export function sameContent(a: Fingerprint, b: Fingerprint): boolean {
  return a.size === b.size && a.hashes.length === b.hashes.length && a.hashes.every((hash, i) => hash === b.hashes[i]);
}
export async function compare(a: File, b: File): Promise<boolean> {
  if (a.size !== b.size) return false;
  for (let offset = 0; offset < a.size; offset += CHUNK) {
    const [x, y] = await Promise.all([a.slice(offset, offset + CHUNK).arrayBuffer(), b.slice(offset, offset + CHUNK).arrayBuffer()]);
    const ax = new Uint8Array(x), by = new Uint8Array(y);
    if (ax.length !== by.length || ax.some((value, i) => value !== by[i])) return false;
  }
  return true;
}
async function absent(dir: LocalDirectory, name: string): Promise<boolean> {
  try { await dir.getFileHandle(name); return false; } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return true;
    // A directory with this name is a collision, too.
    if (error instanceof DOMException && error.name === 'TypeMismatchError') return false;
    throw error;
  }
}
async function freeName(dir: LocalDirectory, name: string): Promise<string> {
  if (await absent(dir, name)) return name;
  const dot = name.lastIndexOf('.'), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; i < 10000; i++) { const candidate = `${base} (${i})${ext}`; if (await absent(dir, candidate)) return candidate; }
  throw new Error('Too many name collisions. Choose another folder.');
}
export class FileEngine {
  private active = false;
  private journal: Journal;
  private exclusive: () => boolean;
  constructor(journal: Journal, exclusive: () => boolean) { this.journal = journal; this.exclusive = exclusive; }
  async move(source: LocalDirectory, name: string, targetParent: LocalDirectory, category?: string, undoOf?: string, expected?: Fingerprint): Promise<Entry> {
    if (this.active) throw new Error('Another file operation is active.');
    if (!this.exclusive()) throw new Error('Exclusive browser session lock is required.');
    if (category !== undefined && !validName(category)) throw new Error('Invalid category name.');
    this.active = true;
    let entry: Entry | undefined;
    try {
      if ((await this.journal.all()).some(e => !['complete', 'retained'].includes(e.status))) throw new Error('Resolve interrupted operations before moving files.');
      for (const dir of [source, targetParent]) if (await dir.queryPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Folder write permission is no longer granted. Reopen the folder.');
      const handle = await source.getFileHandle(name), original = await handle.getFile(), fp = await fingerprint(original);
      if (expected && (!sameContent(fp, expected) || fp.modified !== expected.modified)) throw new Error('The organized file has changed. Undo left it untouched.');
      if (await source.isSameEntry(targetParent) && !category) throw new Error('Source and destination are the same folder.');
      entry = { id: crypto.randomUUID(), at: Date.now(), status: 'intent', source, targetParent, category, sourceName: name, targetName: name, fingerprint: fp, undoOf };
      await this.journal.put(entry); // Durable intent precedes even category directory creation.
      const target = category ? await targetParent.getDirectoryHandle(category, { create: true }) : targetParent;
      if (await source.isSameEntry(target)) throw new Error('Source and destination are the same folder.');
      entry.target = target; entry.targetName = await freeName(target, name); await this.journal.put(entry);
      // No exclusive-create primitive exists in this API. Recheck before opening a writer;
      // external programs can still race us, so users must keep the chosen folder idle.
      if (!await absent(target, entry.targetName)) throw new Error('Destination appeared during copy.');
      const dest = await target.getFileHandle(entry.targetName, { create: true });
      if (await dest.isSameEntry(handle) || (await dest.getFile()).size !== 0) throw new Error('Destination identity or content conflict.');
      const writer = await dest.createWritable();
      try { await writer.write(original); await writer.close(); } catch (error) { try { await writer.abort(); } catch { /* Keep partial destination for recovery. */ } throw error; }
      entry.status = 'copied'; await this.journal.put(entry);
      const copied = await dest.getFile();
      if (!await compare(original, copied)) throw new Error('Full destination verification failed. Source retained.');
      entry.destinationFingerprint = { ...fp, modified: copied.lastModified };
      entry.status = 'verified'; await this.journal.put(entry);
      const currentHandle = await source.getFileHandle(name), current = await currentHandle.getFile();
      if (!await currentHandle.isSameEntry(handle) || current.lastModified !== original.lastModified || !await compare(original, current)) throw new Error('Source changed during copy. Both copies retained.');
      const currentDest = await target.getFileHandle(entry.targetName);
      const currentCopy = await currentDest.getFile();
      if (!await currentDest.isSameEntry(dest) || copied.lastModified !== currentCopy.lastModified || !await compare(copied, currentCopy)) throw new Error('Destination changed after verification. Source retained.');
      entry.status = 'removing'; await this.journal.put(entry);
      // Only an individually verified file is removed; never recursive, never on a miss.
      await source.removeEntry(name);
      entry.status = 'complete'; await this.journal.put(entry);
      return entry;
    } catch (error) {
      if (entry) {
        entry.status = 'recovery'; entry.error = error instanceof Error ? error.message : String(error);
        try { await this.journal.put(entry); } catch { /* Original durable intent remains the recovery anchor. */ }
      }
      throw error;
    } finally { this.active = false; }
  }
  async undo(entry: Entry): Promise<Entry> {
    if (entry.status !== 'complete' || !entry.target || entry.undone || entry.undoOf) throw new Error('This operation cannot be undone.');
    if ((await this.journal.all()).some(e => e.undoOf === entry.id && e.status === 'complete')) throw new Error('This move was already undone.');
    const result = await this.move(entry.target, entry.targetName, entry.source, undefined, entry.id, entry.destinationFingerprint ?? entry.fingerprint);
    // The completed undo link remains authoritative if this bookkeeping write fails.
    await this.journal.put({ ...entry, undone: true });
    return result;
  }
}
export async function scan(dir: LocalDirectory): Promise<{ files: LocalFile[]; directories: string[] }> {
  const files: LocalFile[] = [], directories: string[] = [];
  for await (const handle of dir.values()) { if (handle.kind === 'file') files.push(handle); else directories.push(handle.name); }
  files.sort((a, b) => a.name.localeCompare(b.name)); return { files, directories };
}
export async function inspectEntry(entry: Entry): Promise<string> {
  async function describe(dir: LocalDirectory | undefined, name: string) {
    if (!dir) return 'not recorded';
    try { const file = await (await dir.getFileHandle(name)).getFile(); return sameContent(await fingerprint(file), entry.fingerprint) ? 'matches verified original' : 'different or partial content'; }
    catch (e) { return e instanceof DOMException && e.name === 'NotFoundError' ? 'absent' : 'unreadable / permission needed'; }
  }
  return `Source: ${await describe(entry.source, entry.sourceName)}. Destination: ${await describe(entry.target, entry.targetName)}. No automatic deletion. Inspect both folders before acknowledging.`;
}
