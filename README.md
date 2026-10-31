# SlamSort

**Shoot files. Clear clutter.** A local playable React/TypeScript + Phaser basketball sorting game. The default **Demo** uses clearly labeled fictional files and never changes disk files. Local folder mode starts only from **Open a local folder**; only explicitly approved AI prompts and optional approved filename/excerpts leave your device.

## Run locally

Dependencies are already installed. Use Node.js 24.12+ and npm 11. From the repository root:

```sh
npm run dev:web
```

Open **http://localhost:5173**. Demo and real folder organization work without the API. For the health-only API and Vite proxy, run in another terminal:

```sh
npm run dev:api
curl http://localhost:5173/api/health
```

The API defaults to `0.0.0.0:8080`; Vite proxies `/api` to `127.0.0.1:8080`. Different ports can be supplied explicitly, without sourcing an environment file:

```sh
PORT=8081 npm run dev:api
SLAMSORT_API_ORIGIN=http://127.0.0.1:8081 npm run dev:web
```

No credentials are required for manual play. For real Gemini, use the user-configured ADC and explicit public process variables described in [local AI setup](docs/local-ai.md). `npm ci` reproduces the installed dependency lockfile. No dependency upgrades were forced.

## Play

- Read the current filename and local preview. The paper crumples into a ball after a brief preview interval.
- Drag **back and down** from the ball, then release. Power is clamped; dots follow the same launch velocity and gravity as the ball. Floor, walls and rims bounce. A downward crossing inside a hoop opening scores; a miss retries the same file.
- Keyboard: choose a bin with **1–5**, then **Space**, or use the destination selector and **Fire** button for an assisted arc. Pointer cancellation cancels the aim. Enable original synthesized effects with **Sound on**.
- **Inspect** pauses the timer. Manual pause, file I/O, hidden document, setup, recovery and unavailable local storage/lock each independently pause it. The default is **120 seconds**, configurable in setup. Expiry stops new shots, settles a shot/operation already in progress, then shows a result. Resume remaining includes skipped files.
- **Configure next round / timer** opens manual setup. Choose 1–5 distinct safe category names and freeze the plan. The current round's hoop targets remain fixed.

## Local files

Use desktop Chrome or Edge on localhost/HTTPS with a disposable sample folder for the first run. The directory picker requires an explicit click and browser permission. Unsupported/restricted browsers keep Demo available.

Only loose files are scanned. Existing directories, including created category directories, are deferred. Images under 30 MiB, text prefixes and the first PDF page under 25 MiB have local previews; other formats/sizes show metadata. PDF.js and its matching worker load only for PDF previews. Object URLs and PDF tasks are released.

On a successful basket, the separate serial engine:

1. Requires an exclusive Web Lock and granted write permission.
2. Persists a strict IndexedDB write-ahead intent before creating even a category directory.
3. Chooses a collision-safe destination name, copies, closes, and compares **every byte in bounded 1 MiB chunks**.
4. Rechecks source content, timestamp and identity, and destination content, timestamp and identity.
5. Persists the removal stage, removes only the individually verified source file, then persists completion. Only then is a point awarded.

No overwrite is intentional, no directory is recursively deleted, and misses never call the engine. If IndexedDB or Web Locks are unavailable, local mutation is disabled. Undo follows the same verified copy/remove sequence, preserves a newly appeared original through collision-safe naming, and refuses changed organized files.

**These browser operations are not atomic.** File System Access has no exclusive-create or compare-and-delete primitive: external applications can race between final checks and mutations. Keep the chosen folder idle in other applications. Read/write/verification/journal errors before removal preserve the source and may leave a partial destination. If the final journal write fails after removal, the verified destination remains and the operation requires recovery; no point is awarded.

On reload, nonterminal journal records block further mutations. **Check both copies** reads actual content against recorded chunk hashes; nothing is automatically retried or deleted. Inspect both folders manually, retain uncertain copies, then acknowledge manual recovery and **Refresh loose files / review plan**. Handles are origin-bound and may need renewed permission through the folder picker. Do not clear browser storage while an operation is unresolved. Journal history is local and currently has no pruning UI.

Completed first-level moves create actual category folders. **Refine [category]** enters that folder, lets you edit next-level bins, and freezes a new round. Repeat at any depth supported by the OS, or stop and keep the existing organization. Reopen the root folder to choose a different branch. Undo history persists across those rounds.

Duplicate detection is deferred. The duplicates basket is disabled, no uncertain matches are labeled duplicates, and no copies are discarded. Real Gemini plans/hints are available through explicitly enabled local or public Firebase-authenticated APIs. Manual bins always work. Approved prompts and optional approved filename/excerpts go to Google Vertex AI; other file content stays local. See [local AI setup and endpoint contracts](docs/local-ai.md).

## Verification

```sh
npm run build
npm run typecheck
npm run lint
npm test
```

Tests cover downward score crossings, matching trajectory integration, reachable 1–5-hoop layouts, strength clamps, rim/floor/wall bounces, multi-chunk verification, collisions, journal failure stages, permissions, serialization, changed source/destination, recovery and real undo logic through a File System Access test adapter. The supervisor verified the previous court, first/second assisted hoops, single scoring, queue advancement and pause behavior. This update puts the file preview beside the court, adds a persistent filename strip and crumpled paper projectile. The supervisor is separately checking the updated browser UI; no browser surface is available to this code writer. Live web/API health and Vite proxy returned HTTP 200. Build emits the existing large Phaser chunk warning; PDF.js is separately lazy-loaded.

The root build generates shared declarations, `apps/api/dist` and `apps/web/dist`. `npm run preview -w @slamsort/web` serves the built web app; Vite's development proxy is not a production API routing configuration. The historical dependency review remains in [setup validation](docs/setup-validation.md).

## Public deployment and authentication

The app supports default-disabled AI, local loopback AI, and explicitly enabled public Firebase-authenticated AI. Hosting/Auth use **slamsort-245f9**; Vertex/Cloud Run/billing use **slamsort**. Their project IDs are deliberately separate: Admin verifies the Firebase audience/issuer, while Gemini uses the Vertex project.

For the supervisor's exact environment variables, public Firebase config shape, Docker build/run, Cloud Run source deployment, static Hosting/CSP preparation and GitHub handoff, see [deployment instructions](docs/deployment.md). The root Dockerfile and allowlisted upload/build contexts exclude private material. `firebase.json` serves only `apps/web/dist` with a static SPA fallback; it has no cross-project Run rewrite.

Only `VITE_API_BASE_URL=https://<API_ORIGIN>` is needed at frontend build time. Firebase public web metadata is fetched from runtime `/api/config`; no server credentials are bundled. Public anonymous sign-in happens only after an explicit AI action and reuses the current in-memory user. API requests use Firebase Bearer tokens, strict exact-origin CORS, bounded schemas, per-user/per-instance rate/concurrency limits and sanitized errors. Manual play works on auth/network failure. `npm run prepare:hosting` pins the CSP to that same exact API origin before Hosting deploy.

Vite's isolated `apps/web/env-public` environment directory remains intact; there is no dotenv loader. No private environment/credential file was read or modified. No deployment, IAM, commit or publication was performed by this writer. [SECURITY.md](SECURITY.md) describes the credential boundary and pre-publish review.
