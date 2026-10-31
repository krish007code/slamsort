import type { LocalDirectory } from './engine';
export interface FolderPickerHost {
  isSecureContext: boolean;
  showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<LocalDirectory>;
}
// Do not detach this native method or await anything before it: both receiver and
// transient user activation must be preserved from the Select Folder click.
export function pickFolder(browser: FolderPickerHost): Promise<LocalDirectory> {
  if (!browser.isSecureContext || typeof browser.showDirectoryPicker !== 'function') {
    throw new DOMException('Local folder access requires a supported secure browser.', 'NotSupportedError');
  }
  return browser.showDirectoryPicker({ mode: 'readwrite' });
}
