export function supportsLocalFolders(): boolean {
  return window.isSecureContext
    && 'showDirectoryPicker' in window
    && typeof window.showDirectoryPicker === 'function';
}
