import { createServer } from 'node:http';
import { health } from './routes/health.ts';
import { createAiHandler } from './routes/ai.ts';
import { runtimeConfig } from './services/config.ts';
import { createTokenVerifier } from './services/firebase.ts';
import { createVertexClient } from './services/vertex.ts';
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const config = runtimeConfig(process.env, import.meta.url);
const ai = createAiHandler({ ...config,
  verifyToken: config.mode === 'public' && config.enabled ? createTokenVerifier(config.authProjectId!) : undefined,
  generate: async (contents, schema, signal) => {
  const { client, model } = createVertexClient();
  const result = await client.models.generateContent({ model, contents, config: {
    responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 1000,
    abortSignal: signal, httpOptions: { timeout: 24_000, retryOptions: { attempts: 1 } },
  } });
  return result.text ?? '';
} });
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (path === '/api/health') {
    if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET' }); response.end(JSON.stringify({ error: 'Method not allowed' })); return; }
    response.end(JSON.stringify(health())); return;
  }
  if (['/api/config', '/api/folder-plan', '/api/hint'].includes(path)) { void ai(request, response, path); return; }
  response.writeHead(404); response.end(JSON.stringify({ error: 'Not found' }));
});
server.requestTimeout = 30_000; server.headersTimeout = 10_000;
server.listen(port, config.bind, () => console.info(`SlamSort API listening on port ${port}; AI mode ${config.mode}; ${config.enabled ? 'enabled' : 'disabled'}`));
server.on('error', () => { console.error('API listener failed. Check port availability.'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close());
