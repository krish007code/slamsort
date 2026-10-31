import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { getApps } from 'firebase-admin/app';
import { createAiHandler } from '../apps/api/src/routes/ai.ts';
import { runtimeConfig, parseOrigins, parseFirebaseConfig } from '../apps/api/src/services/config.ts';
import { createTokenVerifier } from '../apps/api/src/services/firebase.ts';
import { validateApiBase, AiClient } from '../apps/web/src/ai/client.ts';
const { fetch, AbortController } = globalThis;
const project = 'slamsort-245f9';
const origin = `https://${project}.web.app`;
const firebase = { apiKey: `AIza${'x'.repeat(35)}`, authDomain: `${project}.firebaseapp.com`, projectId: project, appId: '1:000:web:abc123' };
const valid = 'synthetic-valid-user-a-token';
const second = 'synthetic-valid-user-b-token';
const plan = { sessionId: 'session-1', requestId: 'request-1', parentId: null, prompt: 'Synthetic organization', files: [] };
async function fixture(t, extra = {}) {
  let calls = 0, verified = 0;
  const handler = createAiHandler({ mode: 'public', enabled: true, configured: true, firebase, authProjectId: project, allowedOrigins: [origin, `https://${project}.firebaseapp.com`],
    verifyToken: async token => {
      verified++;
      if (![valid, second, 'synthetic-wrong-audience-token'].includes(token)) throw new Error('Expired, invalid or private provider context');
      const aud = token.includes('wrong') ? 'slamsort' : project;
      return { uid: token === second ? 'user-b' : 'user-a', aud, iss: `https://securetoken.google.com/${aud}` };
    },
    generate: async () => { calls++; return JSON.stringify({ categories: ['Notes'], explanation: 'Synthetic proposal' }); }, ...extra });
  const server = createServer((req, res) => void handler(req, res, new URL(req.url, 'http://localhost').pathname));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (token = valid, headers = {}) => fetch(`${base}/api/folder-plan`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(plan) });
  return { base, post, calls: () => calls, verified: () => verified };
}
test('runtime defaults disabled; distinct Firebase/Vertex projects and exclusive flags', () => {
  assert.equal(runtimeConfig({}, '/src/server.ts').enabled, false);
  assert.throws(() => runtimeConfig({ SLAMSORT_LOCAL_AI: 'true', SLAMSORT_PUBLIC_AI: 'true' }, '/src/server.ts'), /mutually/);
  const env = { SLAMSORT_PUBLIC_AI: 'true', GOOGLE_CLOUD_PROJECT: 'slamsort', GOOGLE_CLOUD_LOCATION: 'global', GEMINI_MODEL: 'synthetic', FIREBASE_AUTH_PROJECT_ID: project, FIREBASE_WEB_CONFIG: JSON.stringify(firebase), ALLOWED_ORIGINS: origin };
  const config = runtimeConfig(env, '/dist/server.js');
  assert.equal(config.enabled, true); assert.equal(config.authProjectId, project); assert.equal(config.bind, '0.0.0.0');
  assert.equal(runtimeConfig({ ...env, FIREBASE_AUTH_PROJECT_ID: 'slamsort' }, '/dist/server.js').enabled, false);
  assert.equal(runtimeConfig({ ...env, FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' }, '/dist/server.js').enabled, false);
  assert.equal(runtimeConfig({ SLAMSORT_LOCAL_AI: 'true' }, '/dist/server.js').enabled, false);
  assert.deepEqual(parseOrigins('https://evil.example/path'), []); assert.deepEqual(parseOrigins('*'), []);
  assert.equal(parseFirebaseConfig(JSON.stringify({ ...firebase, private_key: 'not-allowed' }), project), undefined);
});
test('Admin verifier explicitly initializes the Firebase project, never Vertex billing project', async () => {
  const verify = createTokenVerifier(project);
  await assert.rejects(verify('not-a-jwt'));
  const app = getApps().find(app => app.name === `slamsort-auth-${project}`);
  assert.equal(app.options.projectId, project);
});
test('public config exposes only public Firebase metadata and never a local token', async t => {
  const f = await fixture(t);
  const response = await fetch(`${f.base}/api/config`, { headers: { Origin: origin } });
  const config = await response.json();
  assert.equal(config.mode, 'public'); assert.equal(config.enabled, true); assert.deepEqual(config.firebase, firebase);
  assert.equal(config.sessionToken, undefined); assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.match(response.headers.get('vary'), /Origin/); assert.equal(f.verified(), 0); assert.equal(f.calls(), 0);
});
test('public missing, invalid, expired, wrong-audience and local tokens never invoke Gemini', async t => {
  const f = await fixture(t);
  for (const token of ['', 'synthetic-invalid-token', 'synthetic-expired-token', 'synthetic-wrong-audience-token']) assert.equal((await f.post(token)).status, 401);
  assert.equal((await f.post('', { 'X-SlamSort-Session': 'a'.repeat(64) })).status, 401);
  assert.equal(f.calls(), 0);
  assert.equal((await f.post()).status, 200); assert.equal(f.calls(), 1);
});
test('public preflight permits exact approved origins/routes/headers only', async t => {
  const f = await fixture(t);
  const headers = { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' };
  const response = await fetch(`${f.base}/api/folder-plan`, { method: 'OPTIONS', headers });
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), origin);
  const evil = await fetch(`${f.base}/api/folder-plan`, { method: 'OPTIONS', headers: { ...headers, Origin: 'https://evil.example' } });
  assert.equal(evil.status, 403); assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(`${f.base}/api/folder-plan`, { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Headers': 'x-slamsort-session' } })).status, 403);
  assert.equal((await fetch(`${f.base}/api/unknown`, { method: 'OPTIONS', headers })).status, 403);
  assert.equal(f.calls(), 0);
});
test('public missing Firebase config is disabled even with local bootstrap headers', async t => {
  const f = await fixture(t, { firebase: undefined });
  assert.equal((await f.post()).status, 503);
  const config = await (await fetch(`${f.base}/api/config`, { headers: { Origin: origin } })).json();
  assert.equal(config.enabled, false); assert.equal(config.sessionToken, undefined); assert.equal(f.calls(), 0);
});
test('public per-user limits work in addition to total instance limits', async t => {
  const f = await fixture(t, { userRateLimit: 1 });
  assert.equal((await f.post()).status, 200); assert.equal((await f.post()).status, 429);
  assert.equal((await f.post(second)).status, 200); assert.equal(f.calls(), 2);
});
test('public client base config accepts HTTPS origins only and bootstrap does not sign in', async () => {
  assert.equal(validateApiBase(''), ''); assert.equal(validateApiBase('https://example.run.app'), 'https://example.run.app');
  for (const raw of ['http://example.com', 'https://example.com/', 'https://user@example.com', 'https://example.com/path', '//example.com']) assert.throws(() => validateApiBase(raw));
  const old = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = async (_url, init) => {
    if (init.method) posts++;
    return { ok: true, json: async () => ({ mode: 'public', enabled: true, status: 'configured', firebase }) };
  };
  try {
    const client = new AiClient('https://example.run.app');
    assert.equal((await client.bootstrap()).enabled, true); assert.equal(posts, 0);
    // A cancelled consent request must not create an anonymous account.
    const controller = new AbortController(); controller.abort();
    await assert.rejects(client.plan(plan, controller.signal));
  } finally { globalThis.fetch = old; }
});
