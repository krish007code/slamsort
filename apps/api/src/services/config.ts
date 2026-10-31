import type { AiRuntimeConfig, FirebaseWebConfig } from '@slamsort/shared';
export function parseFirebaseConfig(raw: string | undefined, projectId: string | undefined): FirebaseWebConfig | undefined {
  if (!raw || !projectId || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) return;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || Array.isArray(value) || Object.keys(value).some(k => !['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId', 'storageBucket'].includes(k))) return;
    for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) if (typeof value[key] !== 'string' || !value[key] || (value[key] as string).length > 256) return;
    if (!/^AIza[A-Za-z0-9_-]{35}$/.test(value.apiKey as string) || !/^1:[0-9]+:web:[a-f0-9]+$/i.test(value.appId as string)) return;
    if (value.projectId !== projectId || value.authDomain !== `${projectId}.firebaseapp.com`) return;
    for (const key of ['messagingSenderId', 'storageBucket']) if (value[key] !== undefined && (typeof value[key] !== 'string' || (value[key] as string).length > 256)) return;
    return value as unknown as FirebaseWebConfig;
  } catch { return; }
}
export function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const origins = raw.split(',').map(v => v.trim());
  if (origins.length > 10) return [];
  try {
    if (origins.some(origin => { const u = new URL(origin); return u.protocol !== 'https:' || u.origin !== origin || !!u.username || !!u.password; })) return [];
    return [...new Set(origins)];
  } catch { return []; }
}
export function runtimeConfig(env: Record<string, string | undefined>, moduleUrl: string) {
  const local = env.SLAMSORT_LOCAL_AI === 'true', publicAI = env.SLAMSORT_PUBLIC_AI === 'true';
  if (local && publicAI) throw new Error('Local and public AI modes are mutually exclusive.');
  const production = env.NODE_ENV === 'production' || moduleUrl.includes('/dist/') || !!env.K_SERVICE || !!env.FUNCTION_TARGET;
  const vertex = [env.GOOGLE_CLOUD_PROJECT, env.GOOGLE_CLOUD_LOCATION, env.GEMINI_MODEL].every(v => !!v && !v.includes('<'));
  const firebase = parseFirebaseConfig(env.FIREBASE_WEB_CONFIG, env.FIREBASE_AUTH_PROJECT_ID);
  const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS);
  const mode: AiRuntimeConfig['mode'] = publicAI ? 'public' : local && !production ? 'local' : 'disabled';
  // Never accept emulator-issued unsigned tokens in the public mode.
  const configured = !!vertex && (mode !== 'public' || (!!firebase && allowedOrigins.length > 0 && !env.FIREBASE_AUTH_EMULATOR_HOST));
  return { mode, enabled: mode !== 'disabled' && configured, configured, allowedOrigins, firebase,
    authProjectId: env.FIREBASE_AUTH_PROJECT_ID, bind: local ? '127.0.0.1' : '0.0.0.0' };
}
