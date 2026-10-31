import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { validateApiBase } from '../apps/web/src/ai/client.ts';
// Only public API origin is read. No dotenv, credentials or environment dump.
const origin = validateApiBase(process.env.VITE_API_BASE_URL ?? '');
if (!origin) throw new Error('Set VITE_API_BASE_URL to the deployed HTTPS API origin.');
const path = new URL('../firebase.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
const headers = config.hosting.headers.find(rule => rule.source === '**').headers;
const csp = headers.find(header => header.key === 'Content-Security-Policy');
csp.value = csp.value.replace(/connect-src [^;]+/, `connect-src 'self' ${origin} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com`);
await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
console.info('Hosting CSP prepared with the exact public API origin. No deployment performed.');
