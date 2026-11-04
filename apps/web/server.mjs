import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const apiOrigin = process.env.SLAMSORT_API_ORIGIN ?? 'https://slamsort-api-572891145234.asia-south1.run.app';
const firebaseAuthDomain = process.env.FIREBASE_AUTH_DOMAIN ?? 'curious-setup-512603-r3.firebaseapp.com';
const csp = `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' ${apiOrigin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com; frame-src https://${firebaseAuthDomain}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;

// Serve only built public assets; source, environment files and credentials are absent.
createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) { response.writeHead(404); response.end(); return; }
    let path = resolve(root, `.${pathname}`);
    if (path !== root.slice(0, -1) && !path.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(404); response.end(); return; }
    let info = await stat(path).catch(() => undefined);
    if (!info?.isFile()) {
      if (extname(pathname)) { response.writeHead(404); response.end(); return; }
      path = resolve(root, 'index.html'); info = await stat(path);
    }
    response.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    response.setHeader('Content-Length', info.size);
    response.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache');
    response.writeHead(200);
    if (request.method === 'HEAD') response.end();
    else createReadStream(path).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(400); response.end(); }
}).listen(Number(process.env.PORT ?? 8080), '0.0.0.0', () => console.info('SlamSort website ready.'));
