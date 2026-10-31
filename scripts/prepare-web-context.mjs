import { cp, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.argv[2]) throw new Error('Pass an empty build-context directory outside the repository.');
const target = resolve(process.argv[2]);
if (target.startsWith(root)) throw new Error('Use a build directory outside the repository.');
const files = ['package.json', 'package-lock.json', 'tsconfig.base.json', 'apps/api/package.json', 'apps/web/package.json', 'apps/web/tsconfig.json', 'apps/web/vite.config.ts', 'apps/web/index.html', 'apps/web/server.mjs', 'packages/shared/package.json', 'packages/shared/tsconfig.json'];
// Explicit allowlist prevents private configuration entering the cloud upload.
for (const file of files) { const destination = resolve(target, file); await mkdir(dirname(destination), { recursive: true }); await copyFile(resolve(root, file), destination); }
for (const directory of ['apps/web/src', 'apps/web/public', 'packages/shared/src']) {
  await cp(resolve(root, directory), resolve(target, directory), { recursive: true, filter: source => !/(?:^|\/)\.env(?:\.|$)|\.(?:pem|key)$/.test(source) });
}
await copyFile(resolve(root, 'Dockerfile.web'), resolve(target, 'Dockerfile'));
await writeFile(resolve(target, '.gcloudignore'), '.git\nnode_modules\n**/.env\n**/.env.*\n*.log\n');
console.info('Public-source frontend build context prepared. No deployment performed.');
