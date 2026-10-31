import type { LocalDirectory, LocalFile, scan } from './engine';
export interface LevelJob {
  dir: LocalDirectory; path: string[]; levelPath: string[];
  files: LocalFile[]; directories: string[];
}
/** Only revisit destinations from this round; never walk unrelated user directories. */
export async function nextBranches(dir: LocalDirectory, labels: string[], path: string[], levelPath: string[], parentCount: number, scanDirectory: typeof scan): Promise<LevelJob[]> {
  const jobs: LevelJob[] = [];
  for (const label of labels) {
    if (label.toLocaleLowerCase() === 'duplicates') continue;
    try {
      const child = await dir.getDirectoryHandle(label), found = await scanDirectory(child);
      // Singletons are done. An unchanged group would otherwise nest forever.
      if (found.files.length >= 2 && found.files.length < parentCount)
        jobs.push({ dir: child, path: [...path, label], levelPath: [...levelPath, label], ...found });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error;
    }
  }
  return jobs;
}
