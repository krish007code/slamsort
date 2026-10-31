import type { AiFileSummary } from '@slamsort/shared';
import type { LocalFile } from './engine';
export function shareableName(name: string) {
  return !name.startsWith('.') && !/[/\\]/.test(name) && !/(?:credential|secret|password|token|oauth|application_default|firebase-adminsdk|service[-_]?account|private[-_]?key|^id_(?:rsa|dsa|ecdsa|ed25519))|\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(name);
}
/** Only called with setup consent. Read metadata, never file contents. */
export async function fileContext(items: readonly { name: string; handle?: LocalFile }[]): Promise<AiFileSummary[]> {
  return Promise.all(items.filter(item => item.handle && shareableName(item.name)).slice(0, 12).map(async item => {
    const file = await item.handle!.getFile();
    return { fileId: crypto.randomUUID(), approvedName: item.name.slice(0, 255), mimeType: file.type.slice(0, 120), size: file.size };
  }));
}
