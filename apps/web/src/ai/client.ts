import type { AiRuntimeConfig, FolderPlanRequest, FolderPlanResponse, FileHintRequest, FileHintResponse } from '@slamsort/shared';
import type { Auth, UserCredential } from 'firebase/auth';
export type AiStatus = Pick<AiRuntimeConfig, 'mode' | 'enabled' | 'status'>;
export function validateApiBase(raw: string): string {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && url.origin === raw && !url.username && !url.password) return raw;
  } catch { /* Manual mode remains available if the public build is misconfigured. */ }
  throw new Error('VITE_API_BASE_URL must be an HTTPS origin without a path or trailing slash.');
}
function authError(error: unknown): Error {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/operation-not-allowed': 'Enable Anonymous sign-in in the Firebase Authentication project.',
    'auth/unauthorized-domain': 'Add this website to Firebase Authentication authorized domains.',
    'auth/invalid-api-key': 'The public Firebase web API key configuration is invalid.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The public Firebase web API key configuration is invalid.',
    'auth/network-request-failed': 'Firebase sign-in network request failed. Check the connection and retry.',
    'auth/too-many-requests': 'Firebase sign-in is rate limited. Try again later.',
  };
  return new Error(messages[code] ?? `Firebase sign-in failed${/^auth\/[a-z-]+$/.test(code) ? ` (${code})` : ''}. Manual bins work.`);
}
export class AiClient {
  private token = '';
  private config: AiRuntimeConfig | undefined;
  private base = '';
  private auth: Promise<Auth> | undefined;
  private signingIn: Promise<UserCredential> | undefined;
  private rawBase: string;
  constructor(rawBase = import.meta.env?.VITE_API_BASE_URL ?? '') { this.rawBase = rawBase; }
  async bootstrap(): Promise<AiStatus> {
    this.base = validateApiBase(this.rawBase);
    const response = await fetch(`${this.base}/api/config`, { cache: 'no-store', credentials: this.base ? 'omit' : 'same-origin' });
    if (!response.ok) throw new Error(`AI API unavailable (${response.status}). Manual bins work.`);
    const data = await response.json() as AiRuntimeConfig;
    if (!['disabled', 'local', 'public'].includes(data.mode) || typeof data.enabled !== 'boolean' || typeof data.status !== 'string') throw new Error('AI API configuration is invalid. Manual bins work.');
    this.token = data.mode === 'local' ? data.sessionToken ?? '' : '';
    if (this.config?.firebase?.projectId !== data.firebase?.projectId) this.auth = undefined;
    this.config = data;
    const enabled = data.enabled && (data.mode === 'public' ? !!data.firebase : data.mode === 'local' && !!this.token);
    return { mode: data.mode, enabled, status: data.status };
  }
  private async idToken(): Promise<string> {
    const config = this.config?.firebase;
    if (!config) throw new Error('Firebase public configuration is missing.');
    try {
      this.auth ??= (async () => {
        const [{ getApps, initializeApp }, { initializeAuth, getAuth, inMemoryPersistence }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
        const name = `slamsort-public-${config.projectId}`;
        const existing = getApps().find(app => app.name === name);
        const auth = existing ? getAuth(existing) : initializeAuth(initializeApp(config, name), { persistence: inMemoryPersistence });
        await auth.authStateReady(); return auth;
      })();
      const auth = await this.auth;
      if (!auth.currentUser) {
        const { signInAnonymously } = await import('firebase/auth');
        this.signingIn ??= signInAnonymously(auth);
        try { await this.signingIn; } finally { this.signingIn = undefined; }
      }
      if (!auth.currentUser) throw new Error('No Firebase user.');
      return await auth.currentUser.getIdToken();
    } catch (error) { this.auth = undefined; throw authError(error); }
  }
  private async post<T>(path: string, payload: unknown, signal: AbortSignal): Promise<T> {
    if (signal.aborted) throw new Error('AI request cancelled.');
    if (!this.config?.enabled) throw new Error('AI is not enabled. Manual bins work.');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // This is the only sign-in entry: called after explicit AI consent, never bootstrap.
    if (this.config.mode === 'public') headers.Authorization = `Bearer ${await this.idToken()}`;
    else if (this.config.mode === 'local' && this.token) headers['X-SlamSort-Session'] = this.token;
    else throw new Error('AI authentication unavailable.');
    if (signal.aborted) throw new Error('AI request cancelled.');
    const response = await fetch(`${this.base}${path}`, { method: 'POST', credentials: this.base ? 'omit' : 'same-origin', signal, headers, body: JSON.stringify(payload) });
    const value = await response.json();
    if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : 'AI request failed.');
    return value as T;
  }
  plan(payload: FolderPlanRequest, signal: AbortSignal) { return this.post<FolderPlanResponse>('/api/folder-plan', payload, signal); }
  hint(payload: FileHintRequest, signal: AbortSignal) { return this.post<FileHintResponse>('/api/hint', payload, signal); }
}
// A plan/folder transition invalidates every older response, including requests
// whose provider work finishes after browser cancellation.
export class RequestScope {
  private generation = 0;
  private controllers = new Set<AbortController>();
  invalidate() { this.generation++; for (const c of this.controllers) c.abort(); this.controllers.clear(); }
  begin() {
    const generation = this.generation, controller = new AbortController(); this.controllers.add(controller);
    return { signal: controller.signal, current: () => generation === this.generation && !controller.signal.aborted,
      cancel: () => controller.abort(), finish: () => this.controllers.delete(controller) };
  }
}
export function matchesResponse(expected: { sessionId: string; requestId: string; planId?: string }, actual: { sessionId: string; requestId: string; planId?: string }): boolean {
  return expected.sessionId === actual.sessionId && expected.requestId === actual.requestId && (expected.planId === undefined || expected.planId === actual.planId);
}
