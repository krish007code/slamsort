# Architecture and implementation sequence

## Ownership

React owns the application UI. Phaser owns rendering and deterministic projectile
simulation; React stays outside the per-frame loop. Phaser emits **intentions**
(`GameIntent`), never filesystem commands or successful-operation claims.
The React session controller owns round snapshots, approvals, selection, pause
reasons and orchestration. Only the local file engine may mutate selected files.
Gemini can propose folders and hints through the guarded local API; it cannot execute operations.
Cloud services never receive browser file handles. Filenames and file contents
must not be uploaded without explicit approval. Prompts and category labels can
also contain private information; make the outgoing payload reviewable.

The API uses Node's built-in HTTP server. Health remains public and inference-free.
`GET /api/config`, `POST /api/folder-plan` and `POST /api/hint` are local-development
only: explicit enablement, loopback binding/Host, same-origin checks, ephemeral
bootstrap token, bounded validated JSON, rate/concurrency limits and timeouts.
Production/public mode now uses a separate Firebase Admin token boundary with
exact-origin CORS. Firebase Hosting/Auth use slamsort-245f9 while Vertex/Run use
slamsort; local and public modes cannot both be enabled. Compiled entrypoints
still disable local-only inference. See [deployment](deployment.md). No ADC or environment-file inspection is needed.
See [local AI contracts and launch](local-ai.md) and [security](../SECURITY.md).

## Playable slice status (2026-10-31)

The default Demo is playable with original graphics, sample previews, pull/release
shots, assisted keyboard arcs, fixed-step physics, downward hoop crossings and
synthesized sound. `game/physics.ts` is pure and tested independently of Phaser.
React owns the frozen plan, queue, points, configurable timer and pause reasons;
Phaser emits shot/basket intentions and never accesses file handles.

`files/engine.ts` is the sole filesystem mutation boundary. It serializes moves
and undo; `storage/journal.ts` persists strict IndexedDB stages and holds a
browser-wide exclusive Web Lock. Incomplete entries require manual recovery;
actual source/destination content is inspected and no automatic deletion occurs.
Full bounded byte comparisons protect copy verification. SHA-256 chunk manifests
support later inspection and undo; they are not advertised as duplicate detection.
The unavoidable external-process race and post-removal journal-failure case are
explained in README and the local UI. These operations are not atomic.

Local previews support bounded images/text and first-page PDFs. Native browser
permission and IndexedDB behavior and rendered layout still require browser QA;
the available computer tool exposed no browser. Build/types/lint and deterministic
physics/file-engine tests pass; live health and proxy respond successfully.

Manual category refinement and opt-in local Vertex planning/hints are implemented. Public Firebase auth is implemented; duplicate grouping,
folder crates, automatic recovery, journal pruning, worker hashing and deployment
remain deferred. The older staged sequence below records the original roadmap;
its safety invariants remain requirements, not a claim of browser validation.

## Current tree

- `apps/web/src/app`: session controller, setup, pause/timer, journal and recovery UI.
- `apps/web/src/game`: original playable Phaser court, pure physics and React lifecycle adapter.
- `apps/web/src/files`: capability detection, local previews and serial move/undo engine.
- `apps/web/src/storage`: IndexedDB journal and exclusive session lock.
- `apps/web/src/styles`: responsive landscape visual direction.
- `apps/web/public/assets`: original basketball favicon.
- `apps/web/env-public`: tracked secret-free Vite environment directory.
- `apps/api/src/routes`: health and guarded local AI routes.
- `apps/api/src/validation`: strict request/model-output schemas.
- `apps/web/src/ai`: ephemeral client, consent UI, stale-response scopes and draft scheduling.
- `apps/api/src/services`: lazy Vertex client configuration.
- `packages/shared/src`: JSON-safe contracts, exported only as TypeScript types.

Add `web/src/workers` for expensive hashing when duplicate detection is built. Do not fill these directories with empty stubs.
Native IndexedDB, Web Workers and File System Access need no separate wrapper
packages initially. PDF.js is reserved for local PDF previews, with its worker
resolved from the same package version as the renderer. Revoke preview object
URLs and terminate workers when released.

Shared contracts build to declarations. Both consumers depend on the npm
workspace package; all imports use `import type`. Its `types` export points to
built declarations, with no runtime export and no aliases to source paths.
Root build/typecheck and web development commands build declarations first.
The API's native Node development entry strips types; compiled production JS
uses rewritten relative import extensions. Run root checks after contract edits.

## Round semantics

A round organizes one folder level. Gemini proposes at most five category nodes
under the selected parent. The player reviews and approves them before play.
The separate **Duplicates — kept** basket is local policy, outside the category
limit; it relocates verified duplicate copies and never permanently discards them.
Keep one representative of each duplicate group in the normal collection.
Similar names are not evidence of duplicate content.

Freeze the active plan, bucket IDs and targets for the round. Draft subfolders
may be prepared while the player plays, but never replace active targets. Require
approval before entering a child round. Every batch/crate tracks each file's
individual status and journal entry.

The timer starts with a configurable **120-second default**. Maintain a set of
pause reasons (inspection, hints, file operation, hidden tab) so removing one
reason cannot resume another paused activity. Show files remaining and verified
successful baskets. Expiry stops new shots without deleting files or cancelling
an operation midway; settle and record the current operation first. The setup
shell displays no fake running timer or success counts.

## File-safety invariants

1. Persist journal intent in IndexedDB before any filesystem mutation. Start
   with one operation at a time, with separately tracked files in batches.
2. Never overwrite an existing destination. Detect destination conflicts before
   writing and during recovery; coordinate application operations, but recognize
   external processes can still race. Browser file operations are **not atomic**.
3. Copy → close writer → verify destination → recheck source → remove source.
   Record durable stages, content verification and source fingerprints. If the
   source changed or verification failed, keep it and require recovery.
4. Award success only after the file operation is verified and journaled. A miss
   leaves files untouched; entering a basket alone never awards success.
5. Recover interruptions by inspecting actual source and destination files,
   rather than trusting journal stages alone. Distinguish a partial destination
   from a verified copy before deciding what can be resumed.
6. Implement real undo with source/destination identity and conflict checks;
   link undo entries to their original operation. Never silently overwrite a
   file that appeared after the original move.
7. Never recursively delete a source tree. Remove only the individually
   verified source file, and do not interpret a folder/crate score as permission
   to delete a tree.
8. Treat permission revocation, disk full, locks, quota exhaustion, journal write
   failure and external file changes as recoverable states, not successful moves.

Types document intent but do not enforce these invariants. Runtime validation,
failure-path testing and real-folder verification belong to their implementation
milestones, before mutation features are enabled.

## Staged implementation

1. Finish dependency resolution/lockfile and verify this shell: build, types,
   lint, health/proxy, browser layout and StrictMode mount/unmount behavior.
2. Add read-only folder selection and enumeration on a user gesture, local image,
   text and PDF previews, capability/permission UI, and local session persistence.
3. Implement a serial journaled file engine with conflict handling, verification,
   interrupted-operation recovery and real undo. Test only on disposable copies;
   prove missed shots cannot mutate files before connecting gameplay.
4. Add worker content hashing and verified duplicate groups; retain a normal
   representative and keep duplicate copies in the separate basket.
5. Implement Firebase Auth and backend token verification, request limits and
   runtime schemas. Add consent-reviewed folder plans and hints, reject unsafe
   folder names and stale/mismatched IDs, and keep a maximum of five categories.
6. Connect Phaser shot intentions to the session controller and verified file
   operations; add paper/ball animation, reachable targets, scoring and timer
   pause/expiry behavior. Approve child drafts between rounds.
7. Exercise real-folder demos, browser permission loss, hidden tabs, external
   modifications, reload recovery and undo, then prepare deployment separately.

## Browser and privacy constraints

`showDirectoryPicker` has limited browser availability and requires a secure
context and transient user activation. Never request access on initial load.
Handles in IndexedDB are origin-bound and local; persistence does not guarantee
permission on a later visit. Keep previews local. Use disposable sample copies
for demos, include name collisions and interruptions, and inspect actual files
after every safety scenario. No cloud file storage is needed for this design.

References: [directory picker constraints](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker),
[Phaser React lifecycle example](https://github.com/phaserjs/template-react/blob/main/src/PhaserGame.jsx),
[Vite envDir](https://vite.dev/config/shared-options#envdir),
[typescript-eslint compatibility](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/typescript-eslint/package.json).
TypeScript stays on the supported 6.0 line because the checked lint package's
peer range excludes 6.1 and newer; do not blindly upgrade to TypeScript's latest
major without checking parser support.

The API uses [Node’s native type stripping](https://nodejs.org/api/typescript.html)
with erasable syntax and requires Node 24.12+ for stable support. This avoids a
separate development runner dependency.
