# SlamSort

**Shoot files. Clear clutter.** A React/TypeScript + Phaser basketball game that organizes real files. The opening screen asks you to select a folder. The optional **Demo** uses clearly labeled fictional files and never changes disk files. Local folder mode starts only from **Open a local folder**; only explicitly approved AI prompts and optional approved filename/excerpts leave your device.

## Links

- [Play SlamSort](https://slamsort-web-162765212832.asia-south1.run.app)
- [Source repository](https://github.com/krish007code/slamsort)

## Evaluate in three minutes

1. Open the public link and select **Take a practice shot** for a permission-free demo. Choose a destination and press **Fire**. Demo files are fictional and never touch disk.
2. For the real chore, use desktop Chrome, Chromium, or Edge. Clone/download this repository and make a disposable copy of [`testing/sample-folder`](testing/sample-folder). Select that folder in SlamSort, approve bins once, and land a shot.
3. Check the folder in your file manager: the source file is now inside the chosen category. Use **Undo last verified move** and check that it returns. This real filesystem action is the core challenge outcome.
4. For Gemini, enter an organization goal and select **Generate with Gemini**. Optionally consent to filename/type metadata. The flowchart displays upcoming categories while you play; completed levels progress automatically.

[Judging criteria and source evidence](docs/evaluation.md) · [Submission text and demo script](docs/submission.md) · [Architecture](docs/architecture.md) · [Security](SECURITY.md)

## Run locally

Use Node.js 24.12+ and npm 11. From a fresh checkout, run `npm ci --ignore-scripts`. Then, from the repository root:

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

Before each initial round, a loading screen prepares four local file previews (or all available files when there are fewer than four). File-read errors block play with a recovery action. Subsequent lookahead prepares the next files while the user plays. Snippet preparation remains local; it does not automatically upload contents to Gemini.

- Select a folder first, review destination names, and approve the round. A left-hand assembly line carries each file-type document through a crumpler and into the teal launcher. Read the filename and local preview beside the court.
- Drag **back and down** from the ball, then release. Power is clamped; dots follow the same launch velocity and gravity as the ball. Floor, walls and rims bounce. A downward crossing inside a hoop opening starts a one-second correction window. Grab the visible paper ball to pause that window, then drop it into any hoop to change the destination. Dropping outside returns the file unchanged. Only the settled destination triggers a file move; a miss retries the same file.
- Keyboard: choose a bin with **1–5**, then **Space**, or use the destination selector and **Fire** button for an assisted arc. Pointer cancellation cancels the aim. Enable original synthesized effects with **Sound on**.
- **Reshoot** resets a missed or active shot without moving anything. After a successful basket, it uses the verified undo engine to restore the last file before retrying; demo mode restores its sample and score.
- **Inspect** pauses the timer. Manual pause, file I/O, hidden document, setup, recovery and unavailable local storage/lock each independently pause it. The default is **120 seconds**, configurable in setup. Expiry stops new shots, settles a shot/operation already in progress, then shows a result. Resume remaining includes skipped files.
- Initial setup selects 1–5 categories and the timer. Later populated branches continue automatically. **Finish session** stops progression; current hoop targets stay fixed during each round.

## Local files

Use desktop Chrome or Edge on localhost/HTTPS with a disposable sample folder for the first run. The directory picker requires an explicit click and browser permission. Unsupported/restricted browsers keep Demo available.

Files directly inside the selected folder are scanned. If that queue is empty, the app blocks play and shows buttons to open subfolders instead of presenting a disabled court. Existing directories are opened separately; no directory is automatically moved. Images under 30 MiB, text prefixes and the first PDF page under 25 MiB have local previews; other formats/sizes show metadata. PDF.js and its matching worker load only for PDF previews. Object URLs and PDF tasks are released.

On a successful basket, the separate serial engine:

1. Requires an exclusive Web Lock and granted write permission.
2. Persists a strict IndexedDB write-ahead intent before creating even a category directory.
3. Chooses a collision-safe destination name, copies, closes, and compares **every byte in bounded 1 MiB chunks**.
4. Rechecks source content, timestamp and identity, and destination content, timestamp and identity.
5. Persists the removal stage, removes only the individually verified source file, then persists completion. Only then is a point awarded.

No overwrite is intentional, no directory is recursively deleted, and misses never call the engine. If IndexedDB or Web Locks are unavailable, local mutation is disabled. Undo follows the same verified copy/remove sequence, preserves a newly appeared original through collision-safe naming, and refuses changed organized files.

**These browser operations are not atomic.** File System Access has no exclusive-create or compare-and-delete primitive: external applications can race between final checks and mutations. Keep the chosen folder idle in other applications. Read/write/verification/journal errors before removal preserve the source and may leave a partial destination. If the final journal write fails after removal, the verified destination remains and the operation requires recovery; no point is awarded.

On reload, nonterminal journal records block further mutations. **Check both copies** reads actual content against recorded chunk hashes; nothing is automatically retried or deleted. Inspect both folders manually, retain uncertain copies, then acknowledge manual recovery and **Refresh loose files**. Handles are origin-bound and may need renewed permission through the folder picker. Do not clear browser storage while an operation is unresolved. Journal history is local and currently has no pruning UI.

Approve destinations once at the beginning. A glowing flowchart shows editable bins at setup and the live hierarchy beside the court. Gemini prepares child destinations while you play. With the optional setup consent for file names/types, planning starts when two files reach a bin, uses metadata for up to 12 files, and refreshes with final membership before entering that level. Without consent it uses only the prompt/category labels. File bytes and folder paths are never sent by folder planning; sensitive and hidden filenames are excluded. Cached branches appear in the left sidebar. Completed rounds automatically continue breadth-first into their populated category folders, with the local preview buffer prepared before shooting. Singletons and groups that have not become smaller finish rather than nesting forever. Duplicates and unrelated directories are not traversed. Provider failures use clearly marked local fallback bins. Finish session stops progression; undo history persists across levels.

A small left trash-can target moves files into a **Duplicates** folder and retains them. This is a user-selected destination, not automatic duplicate detection; no files are permanently discarded. Automatic duplicate detection is deferred. Real Gemini plans/hints are available through explicitly enabled local or public Firebase-authenticated APIs. Manual bins always work. Approved prompts and optional approved filename/excerpts go to Google Vertex AI; other file content stays local. See [local AI setup and endpoint contracts](docs/local-ai.md).

## Verification

```sh
npm run build
npm run typecheck
npm run lint
npm test
```

The automated suite contains 68 tests covering physics, correction windows, file integrity, undo, recovery, hierarchy traversal, metadata consent, validation, authentication and rate limits. Run `npm run check` for type checking, lint, tests and build. GitHub Actions repeats these checks from a clean install and audits dependencies. Test counts and audit results describe the current revision, not an assurance about future dependencies.

Live web/API and real Gemini requests have been smoke-tested. Native folder permissions and the full pointer/keyboard game still need a human browser check; no full WCAG conformance or end-to-end browser automation is claimed. The build reports a large lazy-loaded Phaser chunk; PDF support also loads separately.

The root build generates shared declarations, `apps/api/dist` and `apps/web/dist`. `npm run preview -w @slamsort/web` serves the built web app; Vite's development proxy is not a production API routing configuration. The historical dependency review remains in [setup validation](docs/setup-validation.md).

## Public deployment and authentication

The app supports default-disabled AI, local loopback AI, and explicitly enabled public Firebase-authenticated AI. Authentication uses **slamsort-245f9**. The website, API, Vertex AI, and runtime billing use Cloud Run project **slamsort**. Firebase Hosting configuration is retained as an optional deployment target. Their project IDs are deliberately separate: Admin verifies the Firebase audience/issuer, while Gemini uses the Vertex project.

For environment variables, public Firebase config shape, Docker build/run, Cloud Run source deployment, static Hosting/CSP preparation and GitHub handoff, see [deployment instructions](docs/deployment.md). The root Dockerfile and allowlisted upload/build contexts exclude private material. `firebase.json` serves only `apps/web/dist` with a static SPA fallback; it has no cross-project Run rewrite.

Only `VITE_API_BASE_URL=https://<API_ORIGIN>` is needed at frontend build time. Firebase public web metadata is fetched from runtime `/api/config`; no server credentials are bundled. Public anonymous sign-in happens only after an explicit AI action and reuses the current in-memory user. API requests use Firebase Bearer tokens, strict exact-origin CORS, bounded schemas, per-user/per-instance rate/concurrency limits and sanitized errors. Manual play works on auth/network failure. `npm run prepare:hosting` pins the CSP to that same exact API origin before Hosting deploy.

Vite's isolated `apps/web/env-public` environment directory remains intact; there is no dotenv loader. No private environment/credential file was read or modified. The API and website are deployed on Cloud Run with separate service accounts. Only the API identity has Vertex AI access. [SECURITY.md](SECURITY.md) describes the credential boundary and pre-publish review.
