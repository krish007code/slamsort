# SlamSort public deployment

The API and static website use separate Cloud Run services in `slamsort`. Firebase Authentication uses `slamsort-245f9`. No private environment/credential file was read. Source: https://github.com/krish007code/slamsort.

## Project ownership

| Purpose | Project |
| --- | --- |
| Website/API, Vertex inference, runtime billing, Cloud Run, Cloud Build, Artifact Registry | `slamsort` |
| Firebase Authentication, web app, ID token audience/issuer; optional Hosting | `slamsort-245f9` |

The Admin SDK is explicitly initialized with `FIREBASE_AUTH_PROJECT_ID` set to the Firebase project. It validates token signature, expiry, audience and issuer. It does not derive the auth project from ADC, Cloud Run or `GOOGLE_CLOUD_PROJECT`. Gemini remains configured with `GOOGLE_CLOUD_PROJECT=slamsort`. Verification uses public signing certificates; no cross-project Firebase user-management IAM or service-account JSON is needed. Revocation/user-disabled checks requiring Auth RPCs are not enabled; expiry/signature verification is enabled.

Hosting is **static** in the Firebase Spark project. There is no cross-project Cloud Run Hosting rewrite. The frontend calls the backend HTTPS origin directly using exact-origin CORS. Billing stays with the Cloud Run/Vertex project; Hosting does not need upgrading for this architecture.

## Public process configuration

| Variable | Required value/purpose |
| --- | --- |
| `SLAMSORT_PUBLIC_AI` | Exactly `true` to enable public Firebase-protected inference. Default disabled. |
| `SLAMSORT_LOCAL_AI` | Set `false` or omit in public mode; both true refuse startup. |
| `GOOGLE_CLOUD_PROJECT` | `slamsort` — Vertex/billing project. |
| `GOOGLE_CLOUD_LOCATION` | `global` — verified Vertex location. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` — verified public model identifier. |
| `FIREBASE_AUTH_PROJECT_ID` | `slamsort-245f9` — token audience/issuer project. |
| `FIREBASE_WEB_CONFIG` | JSON string with public browser config shown below. No server credentials. |
| `ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins: `https://slamsort-245f9.web.app,https://slamsort-245f9.firebaseapp.com`. No wildcard, trailing slash or URL path. |
| `PORT` | `8080` locally; Cloud Run supplies it. |
| `VITE_API_BASE_URL` | Frontend build only: exact HTTPS Cloud Run origin, without trailing slash or `/api`. This is the only frontend build-time setting. |

`FIREBASE_WEB_CONFIG` shape (replace placeholders manually with the **public web app** configuration; never use a service account):

```json
{
  "apiKey": "<PUBLIC_FIREBASE_WEB_API_KEY>",
  "authDomain": "slamsort-245f9.firebaseapp.com",
  "projectId": "slamsort-245f9",
  "appId": "<PUBLIC_FIREBASE_WEB_APP_ID>"
}
```

Optional string fields: `messagingSenderId`, `storageBucket`. No analytics initialization. Unknown fields (including credential/private-key fields) fail validation. The public config project must equal `FIREBASE_AUTH_PROJECT_ID`; authDomain must be that project's default firebaseapp.com domain. Missing/invalid Vertex, Firebase or origin config disables paid routes. `FIREBASE_AUTH_EMULATOR_HOST` must not be set in public mode; emulator configuration disables public inference.

A Firebase web API key and web app IDs are public client metadata. Google refresh/access tokens, ADC and private/service-account keys are credentials and must never enter source, build context, docs, browser bundles or logs. This deployment does not source `.env` files. Vite's isolated `envDir` is preserved.

## Human launch/build/deploy sequence

1. Finish registering the Firebase web app in **slamsort-245f9**, enable **Anonymous** sign-in, and check both Hosting domains under Auth authorized domains. Use only the public client configuration above.
2. Review the Cloud Run runtime identity in **slamsort** for the required Vertex inference permission and approved billing/quota/budget settings. The supervisor owns IAM decisions; this writer performs none. No downloaded service-account key is needed.
3. Set public variables explicitly in the shell. Do not source any environment file:

```sh
export SLAMSORT_PUBLIC_AI=true
export SLAMSORT_LOCAL_AI=false
export GOOGLE_CLOUD_PROJECT=slamsort
export GOOGLE_CLOUD_LOCATION=global
export GEMINI_MODEL=gemini-3.5-flash-lite
export FIREBASE_AUTH_PROJECT_ID="<YOUR_FIREBASE_PROJECT_ID>"
export FIREBASE_WEB_CONFIG='<PUBLIC_WEB_APP_JSON_FROM_ABOVE>'
export ALLOWED_ORIGINS='https://slamsort-245f9.web.app,https://slamsort-245f9.firebaseapp.com'
```

Local compiled API launch for supervisor verification:

```sh
npm run build --workspace=@slamsort/shared
npm run build --workspace=@slamsort/api
PORT=8080 npm run start --workspace=@slamsort/api
```

Public mode binds `0.0.0.0`. Local mode binds `127.0.0.1` and accepts exactly `http://localhost:5173` and `http://127.0.0.1:5173`. The local-only mode remains disabled in compiled/production/managed-runtime entrypoints. Both modes cannot run together.

Optional Docker build/run (no credentials copied or mounted):

```sh
docker build -t slamsort-api:local .
docker run --rm -p 127.0.0.1:8080:8080 \
  -e SLAMSORT_PUBLIC_AI -e SLAMSORT_LOCAL_AI \
  -e GOOGLE_CLOUD_PROJECT -e GOOGLE_CLOUD_LOCATION -e GEMINI_MODEL \
  -e FIREBASE_AUTH_PROJECT_ID -e FIREBASE_WEB_CONFIG -e ALLOWED_ORIGINS \
  slamsort-api:local
```

A local container can test config/auth rejection without ADC. Real Vertex calls require a permitted runtime identity; do not copy local ADC into the image. The root Dockerfile uses Node 24, `npm ci --ignore-scripts`, separate build/runtime dependencies, explicit source copies and a non-root runtime. `.dockerignore` and `.gcloudignore` allow only required build inputs and exclude private material, Git, logs, tests, stores and artifacts.

Supervisor-only Cloud Run source deploy command (choose approved region and existing runtime identity before running):

```sh
gcloud run deploy slamsort-api \
  --project slamsort \
  --region '<APPROVED_CLOUD_RUN_REGION>' \
  --source . \
  --service-account '<APPROVED_RUNTIME_SERVICE_ACCOUNT_EMAIL>' \
  --allow-unauthenticated \
  --max-instances 1 --concurrency 16 --timeout 60 \
  --set-env-vars "^@^SLAMSORT_PUBLIC_AI=true@SLAMSORT_LOCAL_AI=false@GOOGLE_CLOUD_PROJECT=slamsort@GOOGLE_CLOUD_LOCATION=global@GEMINI_MODEL=gemini-3.5-flash-lite@FIREBASE_AUTH_PROJECT_ID=slamsort-245f9@FIREBASE_WEB_CONFIG=${FIREBASE_WEB_CONFIG}@ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
```

Cloud Run transport must be reachable by the browser, so health/config/preflights are public; **paid application routes still require verified Firebase Bearer tokens**. The custom `@` delimiter keeps commas inside public JSON/origin values intact. Do not include `@` in those values. These are public config values, not credentials. Review the command instead of blindly copying placeholders. Existing build/deploy IAM is managed by the supervisor; no IAM change is implied here.

After the API URL is known, build static Hosting and prepare an **exact API origin** in the CSP:

```sh
export VITE_API_BASE_URL='https://<ACTUAL_CLOUD_RUN_HOST>'
npm run build
npm run prepare:hosting
firebase deploy --only hosting --project slamsort-245f9
```

`prepare:hosting` only updates the CSP in `firebase.json`; it does not deploy or read credentials. Review that diff before publication. The initial CSP deliberately has no external API origin until this command supplies it. Firebase SDKs are bundled and lazy-loaded; CSP allows the exact API host, Firebase Auth Google APIs, local/blob images, local/blob PDF workers and WebAssembly evaluation for PDF rendering. The static SPA fallback has no Cloud Run rewrite. `apps/web/dist` is the only Hosting public directory.

Correct local web command with forwarded arguments:

```sh
npm run dev:web -- --host 127.0.0.1
# Equivalent:
npm run dev --workspace=@slamsort/web -- --host 127.0.0.1
```

Do not stop another running supervisor dev server. API/process configuration changes require an API restart and client Reconnect/reload.

## API contract and auth flow

- `GET /api/health`: unauthenticated health; no inference/auth initialization.
- `GET /api/config`: `{mode: 'disabled'|'local'|'public', enabled, status, firebase?, sessionToken?}`. Public mode exposes public Firebase client metadata and **never** a local bootstrap token. Public cross-origin calls require an approved Origin. Config fetch does not create an account.
- `OPTIONS /api/config`, `/api/folder-plan`, `/api/hint`: approved exact-origin preflights only; GET or POST as appropriate, allowed headers `Authorization, Content-Type`; `Vary: Origin`; no wildcard or credentials cookies.
- `POST /api/folder-plan`: existing `FolderPlanRequest` JSON (`sessionId`, `requestId`, `parentId`, optional `parentLabel`, `prompt`, `files: []`). Returns correlated `FolderPlanResponse` with editable categories and explanation.
- `POST /api/hint`: existing `FileHintRequest` JSON with approved buckets, file type/size, optional explicitly approved name/excerpt. Returns correlated suggestion/explanation; no file operation.

Public POSTs require `Authorization: Bearer <Firebase ID token>` and JSON. Local POSTs require their memory-only local bootstrap header instead; it cannot authorize public inference. The modular frontend initializes Firebase and calls `signInAnonymously` **only on an explicit AI request** (or an approved background plan), reuses `currentUser`, and sends refreshed ID tokens. Anonymous auth state stays in memory; there is no account creation during bootstrap. Auth/network/config errors leave manual game play available and show safe actionable messages.

Unchanged limits: body 24 KiB, prompt 2000 chars, excerpt 8000 chars, 1–5 safe unique folders, 25-second model timeout, 24-second SDK timeout, one model attempt. Total per instance: 12 admitted inference requests/minute and 2 concurrent; per verified UID: 6/minute and 1 concurrent. Auth verification has an 8-request in-flight cap and 8-second timeout. UID state prunes inactive entries after one minute and never exceeds 1000 entries. Limits are in-memory/per-instance, not durable distributed quotas; Anonymous sign-in is not abuse-proof. The one-instance deployment cap limits scale, and billing/alerts remain operator responsibilities.

## Handoff checks

Build/typecheck/lint and automated tests cover the prior file safety/physics checks plus public auth rejection, explicit audience selection, CORS, disabled defaults, token-mode separation and no sign-in on config bootstrap. Live public auth and public URL acceptance require the user's completed Firebase web config/provider setup and the supervisor's deployment. Verify actual Anonymous sign-in, plan, approved hint, manual play, local folder permission/undo, PDF worker and responsive layout on the deployed origin before sharing the GitHub/playable URLs.

No GitHub Actions or private deployment keys are introduced. The supervisor owns GitHub publication after reviewing tracked paths, diffs and secret scanning. Do not publish private sample files, credentials, build caches or logs.

## Active Cloud Run website

Firebase Hosting was unavailable to the deployment account, so the public website is served by a second Cloud Run service.

- Website: https://slamsort-web-162765212832.asia-south1.run.app
- API: https://slamsort-api-162765212832.asia-south1.run.app
- Region: `asia-south1`
- Both services scale to zero with a one-instance maximum.
- `slamsort-web` runtime has no Vertex role. The `slamsort-api` runtime has Vertex AI User.
- Exact website origin is included in the API's allowed origins.

Prepare an explicit, credential-free website build context outside the repository:

```sh
node scripts/prepare-web-context.mjs /tmp/slamsort-web-build
gcloud run deploy slamsort-web --project=slamsort --region=asia-south1 \
  --source=/tmp/slamsort-web-build \
  --service-account=slamsort-web@slamsort.iam.gserviceaccount.com \
  --build-service-account=projects/slamsort/serviceAccounts/slamsort-build@slamsort.iam.gserviceaccount.com \
  --max-instances=1 --min-instances=0 --memory=256Mi --port=8080 \
  --no-invoker-iam-check
```

Cloud Run permits HTTP transport for browser access. The API independently verifies Firebase ID tokens before model inference. Anonymous authentication plus per-instance limits is suitable for the hackathon demo; it is not a global spending cap or strong protection against determined anonymous-account abuse. Budgets notify rather than automatically stop spending.
