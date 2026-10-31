# Setup validation and dependency review

Validation date: 2026-10-31. Node 26.9.0, npm 11.19.1.
No private environment files were read or loaded. Vite retains the isolated
`apps/web/env-public` directory. No cloud operations or deployment occurred.

## Checks

| Check | Result |
| --- | --- |
| `npm run build` | Passed: shared declarations, compiled API and web assets |
| `npm run typecheck` | Passed for all three workspaces |
| `npm run lint` | Passed with zero lint warnings |
| `npm ls --depth=0` | Passed; workspace dependencies resolve |
| Compiled API request handler | GET health 200 with expected JSON; POST health 405; unimplemented AI route 404 |
| API bind configuration | Checked default 8080 and `0.0.0.0` using an in-memory HTTP server substitute |
| Vite configuration | Checked `/api` target and absolute isolated `envDir` |
| Prebuilt SDK import smoke check | Gen AI, `firebase/app`, `firebase/auth` import without initializing clients |
| Live API and Vite | Blocked: sandbox rejects socket binds with `EPERM` |
| Browser rendering/lifecycle | Not verified: computer-use inventory has no browser surface |
| Online `npm audit --json` | Blocked: registry DNS `EAI_AGAIN` |

Vite emits a size warning for the separately loaded Phaser chunk (about 1.37 MB,
358 KB gzip). This is not a build failure. No chunk-limit increase or warning
suppression was added. Gameplay/asset optimization remains outside setup scope.
The socketless handler/config checks do not prove live HTTP forwarding or browser
layout, rendering and cleanup.

## Known remaining vulnerabilities

The online audit could not complete. An offline audit returned zero, but that
result did not reproduce cached advisory records and is **not** a security
clearance. The following is a limited review of cached npm advisories matched to
the installed lockfile and confirmed against the linked GitHub advisories, not
a complete fresh npm audit count. Parent packages can be reported multiple times
by npm for the same underlying issue.

| Underlying package | Severity and advisory | Dependency path / impact | Fix assessment |
| --- | --- | --- | --- |
| `@grpc/grpc-js@1.9.16` | High: [certificate authorization context](https://github.com/advisories/GHSA-m9gg-hp2v-232j); low: [handler error disclosure](https://github.com/advisories/GHSA-f596-whhp-79r4) | Production dependency tree: web → `firebase@12.19.0` → `@firebase/firestore@4.17.2` → gRPC; also through Firestore compat. Firebase/Firestore are not imported into the current browser shell, and the API does not depend on them. These remain installed production-tree risks, despite no current runtime use. | Patched in 1.13.6 and 1.14.5 on their respective lines. Firestore pins `~1.9.0`; cached newest within that range is 1.9.16. A forced override would exceed the parent's tested range. |
| `minimatch@10.2.6` | Moderate: [glob pattern amplification denial of service](https://github.com/advisories/GHSA-g3hv-75wg-m249) | Development only: ESLint → minimatch; ESLint → config-array → minimatch; typescript-eslint → typescript-estree → minimatch. Not shipped as application runtime code. | Patched in 11.0.1. Installed parents require `^10.2.x`; cached newest compatible is 10.2.6. No compatible patch is available in the reviewed metadata. |

`npm explain @grpc/grpc-js` and `npm explain minimatch` confirmed these paths.
Cached metadata lists Firebase 13.1.0 and minimatch 11.0.3, but those are major
upgrades outside current ranges; current ESLint 10.14.0 and typescript-eslint
8.72.1 still require minimatch 10. Firebase 12.19.0 is the newest cached compatible
Firebase 12 release. No force fix, unvalidated override, downgrade, finding
suppression or global script enablement was applied. Recheck current upstream
releases and a live audit when network access is available before selecting a
supported upgrade. Do not assume this list excludes other advisories.

The Firebase package installs its full dependency graph even when consumers use
modular imports. This does not mean this application initializes Analytics,
Firestore or other Firebase products; it currently initializes none.

## Install-script decisions

`package.json` now records explicit `allowScripts: false` entries for these three
packages. `npm approve-scripts --allow-scripts-pending` reports no unreviewed
scripts. None was approved or rerun because none is necessary for this shell.
These decisions do not suppress vulnerability findings.

- `@google/genai@2.32.0`: registry install hook is `echo 'preinstall: no-op'`.
  No build/install action is required for its shipped distribution. Its manifest
  also lists a repository prepare command; no Git-source dependency is used here.
- `protobufjs@7.6.6`: postinstall reads package manifests and warns about version
  schemes. It returns immediately without `versionScheme`; it does not generate
  the runtime. Optional diagnostic only.
- `@firebase/util@1.15.3`: postinstall may read the file named by
  `FIREBASE_WEBAPP_CONFIG`, call the Google web-config endpoint, and write generated
  defaults modules. That automatic config mechanism is unnecessary for the
  explicit public Firebase configuration planned here, so it is denied. Do not
  rerun it against inherited configuration. Any future requirement must be
  reviewed separately and exercised with explicitly isolated configuration.

The prebuilt SDK import checks passed with the existing installation. A future
clean-install validation should confirm the same behavior under these denials;
do not infer that previously run scripts have been undone. The user's earlier
installation ran with npm's default policy before this review. No claim is made
about which scripts ran during that earlier install.

## Remaining local checks when restrictions are lifted

Without loading `.env`, run these in separate terminals:

```sh
npm ci
npm run dev:api
npm run dev:web
```

Then:

```sh
curl -i http://127.0.0.1:8080/api/health
curl -i http://localhost:5173/api/health
npm audit
npm audit --omit=dev
npm run build
npm run typecheck
npm run lint
```

Check the browser at `http://localhost:5173`: canvas renders once, reload and
mount/unmount leave no extra canvases, narrow message is readable, and no folder
permission prompt occurs. No folder selection or file mutation is needed for
these setup checks. Do not deploy or invoke AI to validate the shell.
