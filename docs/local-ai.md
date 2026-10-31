# Local Vertex integration

Public Firebase-authenticated mode is now implemented separately; see [two-project deployment](deployment.md). This page documents only the loopback development mode. Public mode never uses this local bootstrap token.

This is a **local development boundary**, not production authentication. No Firebase deployment, IAM changes, cloud creation or environment-file loading are needed or performed here. ADC was configured by the user; the SDK uses its normal credential chain without application code reading the credential file.

## Start

From `/home/krish/slamsort`, run the API with explicit public process configuration:

```sh
SLAMSORT_LOCAL_AI=true \
GOOGLE_CLOUD_PROJECT=slamsort \
GOOGLE_CLOUD_LOCATION=global \
GEMINI_MODEL=gemini-3.5-flash-lite \
PORT=8080 npm run dev:api
```

In another terminal:

```sh
npm run dev:web
```

Open **http://localhost:5173** (this exact dev origin is allowed). Use **Bins / timer / Gemini** in Demo, or **Open local folder** to enter setup. Type an organization prompt and click **Generate with Gemini · send prompt**. Edit the returned 1–5 safe folder names, then **Approve & play**. A successful generation confirms live Vertex access; config/bootstrap alone only confirms server configuration, not credentials.

The model/project/location above are public identifiers verified with real synthetic requests during this session. They remain process-configurable. Do not load private environment files or print ADC values to reproduce the check. Backend config changes require restarting the API and clicking Reconnect. Vite keeps its original isolated `envDir`.

The API binds **127.0.0.1** when the local flag is set. Compiled `dist` entrypoints, `NODE_ENV=production`, and managed Google runtime markers disable inference even with the flag. Without the flag, AI is disabled; manual mode works. Never tunnel or publicly proxy the dev servers. Public mode now has its separate Firebase ID-token verification boundary and limits; deployment is supervisor-owned and documented separately.

## Endpoints

All AI endpoints require an exact loopback Host (`localhost:<API port>`, `127.0.0.1:<API port>` or proxy-preserved `localhost:5173` / `127.0.0.1:5173`), a loopback peer, `Sec-Fetch-Site: same-origin`, and approved `Origin: http://localhost:5173` or same-origin Referer. A normal same-origin browser fetch through Vite supplies these headers. There is no CORS wildcard or cross-origin client mode.

| Endpoint | Contract |
| --- | --- |
| `GET /api/config` | `{enabled, status, sessionToken?}`; no-store bootstrap, token returned only when local AI is enabled and public configuration is present. |
| `POST /api/folder-plan` | `FolderPlanRequest`: `{sessionId, requestId, parentId: null \| id, parentLabel?, prompt, files: []}`. Membership uploads are rejected. Returns `{sessionId, requestId, planId, parentId, categories: BucketNode[], explanation}`. |
| `POST /api/hint` | `FileHintRequest`: `{sessionId, requestId, planId, file: {fileId, mimeType, size, approvedName?}, approvedBuckets: BucketNode[], approvedExcerpt?}`. Returns `{sessionId, requestId, planId, fileId, suggestedBucketId: id \| null, explanation}`. |
| `GET /api/health` | Unchanged health response; no inference or auth initialization. |

POST requests require `Content-Type: application/json` and `X-SlamSort-Session: <bootstrap token>`. Tokens are random, server-memory-only, never stored in IndexedDB/localStorage or logged, and expire on backend restart. The client keeps its token in a private in-memory client field. Do not paste a token into shell commands, docs, source or logs.

Limits: 24 KiB body, 2000-character organization prompt, 8000-character approved excerpt, 255-character optional filename, 1–5 unique safe sibling labels up to 80 characters, bounded IDs and metadata. Unknown request/output fields are rejected. No path separators, dot segments, control characters, Windows reserved basenames or trailing dots/spaces. Output must match a JSON schema; hint bucket IDs must belong to the approved plan. Provider messages are never exposed or logged.

The API admits at most 12 requests/minute and 2 simultaneous requests process-wide. Model calls have a 25-second deadline and abort signal, a 24-second SDK HTTP timeout, one attempt, and bounded output. Error statuses: 400 schema/JSON rejection; 403 origin/session failure; 405 method; 413 body size; 415 media type; 429 rate/concurrency; 503 disabled; 504 timeout; 502 sanitized provider failure. Model-output schema rejection also returns 400. No model error text or request payload is logged.

## Consent, drafts and stale responses

Planning sends the prompt only, with opaque session/request identifiers; it does not enumerate or transmit filenames. Next-level drafting is a separate opt-in before approval: the last successfully generated/approved organization prompt plus each approved category label, one sequential request per category per plan, at most five, with a 1.2-second gap between requests. No membership names or file contents are included. Failed requests leave manual refinement available. Active labels never change when a draft returns; entering a category shows an editable draft and requires another round approval.

Hints pause play and display the exact outgoing JSON before confirmation. Filename sharing is off by default. The default is file type/size plus opaque IDs and approved category labels. Users can explicitly load text prefixes or a first-page PDF excerpt locally, edit or clear it, and approve sending that payload. Loading an excerpt does not send it. Gemini explanations never award points or move files.

Folder/demo/plan changes invalidate outstanding browser requests and discard late responses. Responses also must match session/request/plan or parent IDs. Hints are tied to the reviewed file ID; active folder plans remain frozen until another approval. Browser cancellation cannot guarantee a provider-side call has not already been billed, so the client also suppresses stale results and duplicate per-category requests.

## Verification

`npm test` covers schema/path rejection, origin/Host/Fetch Metadata/token enforcement, disabled mode, body limits, rate/concurrency limits, timeouts, sanitized errors, correlated hints and stale-result rejection, alongside the original file engine and physics tests (now all 1–5 hoop counts). Two genuine tiny synthetic requests (plan + metadata-only hint) returned HTTP 200 using the configured Vertex model. No real file content or names were sent. The supervisor separately performs browser QA; this writer has no browser surface.

See [SECURITY.md](../SECURITY.md) for credential hygiene and the pre-publish checklist. See [cloud-setup.md](cloud-setup.md) for the future Firebase-authenticated deployment work. Do not deploy this local boundary as a paid public API.
