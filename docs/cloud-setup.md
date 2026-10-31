# Historical cloud setup guide — human-run

Current two-project architecture, production authentication and exact deployment commands are in [deployment.md](deployment.md). Firebase Hosting/Auth use slamsort-245f9, while Vertex/Cloud Run use slamsort. Do not use the older single-project examples below for this deployment.

Local update: the user has enabled billing/Vertex and configured CLI/ADC; guarded local plan/hint calls now work. Use [local AI](local-ai.md) for the implemented development path. The steps below are a historical setup/deployment guide, not instructions to redo completed authentication or enablement. No deployment has been performed.

Target project ID: `slamsort`. This is configuration, not a credential. No cloud
login, credentials, resource creation, API enablement, IAM change, deployment or
paid inference is needed for the current shell. This guide describes a later
phase; do not run its commands as part of initial setup.

## Configuration ownership

| Variable | Process / purpose |
| --- | --- |
| `PORT=8080` | API HTTP listener; Cloud Run supplies its port at runtime |
| `GOOGLE_CLOUD_PROJECT=slamsort` | API, future Vertex project |
| `GOOGLE_CLOUD_LOCATION=<location supporting the chosen model>` | API, future model endpoint location |
| `GEMINI_MODEL=<supported model ID>` | API only, future inference model |
| `SLAMSORT_API_ORIGIN=http://127.0.0.1:8080` | Vite config, development proxy only |
| `VITE_FIREBASE_API_KEY` | Future browser public Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Future browser public Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Future browser public Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Future browser public web config, if provided; no file uploads planned |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Future browser public web config; messaging not initialized |
| `VITE_FIREBASE_APP_ID` | Future browser public Firebase app ID |

The Firebase fields above are public identifiers, not authorization. No analytics
measurement ID is needed. Only initialize modular `firebase/app` and
`firebase/auth` when implemented. Keep all AI model settings and secrets on the
backend. No service-account JSON key is needed or should be generated.

The user creates/populates `.env` manually; no command here sources it. The API
has no dotenv loader and reads explicit process values. Vite deliberately uses
`apps/web/env-public`, not the root or application directory, for environment
loading. That directory is tracked and secret-free. Current checks require no
environment variables. Do not change `envDir` to a private directory as a shortcut.

## 1. Check account, project and organizational permissions

Install Google Cloud CLI and Firebase CLI later using their official guides.
Confirm with the project administrator that `slamsort` is the intended existing
project, that billing is approved, and that your account can use it. If it is
unavailable or belongs to another organization, resolve that with the owner.
Do not create another project automatically.

College organization policies can prevent API enablement, service-account use,
service deployment, external identities or public ingress. Ask the administrator
for the required access; do not bypass policies or download keys.

A human can later authenticate and select the project:

```sh
gcloud auth login
gcloud config set project slamsort
```

CLI login authorizes **gcloud commands**. It does not configure local Application
Default Credentials for application libraries. For future local Vertex calls,
a human separately runs:

```sh
gcloud auth application-default login
```

ADC is managed locally by gcloud. Do not inspect or commit its credential file.
Use an attached service account for Cloud Run, rather than copying local ADC or
using a service-account key in an image.

## 2. Choose model/location and approve cost

Before populating the placeholders, check the current Google model availability
matrix and lifecycle information for the exact stable model ID, supported Vertex
location, project access, quotas and intended data handling. Availability varies
by model and endpoint; this setup intentionally hardcodes neither model nor
location. The lazy SDK factory uses `vertexai: true` and explicit project/location.
It is not a working inference endpoint.

Only after approval, enable the Vertex AI API (`aiplatform.googleapis.com`).
Cloud Run source builds may also require Cloud Run, Cloud Build and Artifact
Registry APIs. Arrange billing budgets/alerts and request quotas/rate limits
before inference becomes reachable. These actions may create charges and are
outside initial setup.

## 3. Add authentication before inference

In the Firebase console, associate Firebase with the intended project, register
a web app, enable the chosen Firebase Authentication provider, and set authorized
domains. Retrieve the public web configuration for the placeholders. Do not
initialize Analytics, Firestore or cloud storage for local files.

Implement browser sign-in, send an ID token with AI requests, and verify the token
server-side with the Firebase Admin SDK in a later phase. That SDK is not needed
for a health-only server and is not installed now. Verify issuer/audience and
project, then enforce payload bounds, per-user limits, consent and runtime
response validation. CORS and a Hosting rewrite are not authentication.
Keep AI paths returning 404 until these protections exist. Never send browser
handles; only approved metadata and explicitly approved content may leave the
browser.

## 4. Prepare Cloud Run later

Create a dedicated runtime service account with the least permissions needed for
Vertex inference (commonly Vertex AI User, subject to administrator review).
Build/deploy identities have separate requirements; do not grant broad project
roles to the runtime identity. Review the current deployment IAM requirements.

Prepare and review a container/build configuration that compiles the API and
shared declarations, installs only required runtime dependencies, and starts
`apps/api/dist/server.js`. The current server listens on `0.0.0.0` and respects
`PORT`. No container or deployment has been created in this setup.

After that artifact and IAM are ready, a later human-run command can follow this
shape (replace all placeholders before use):

```sh
gcloud run deploy slamsort-api \
  --project slamsort \
  --region <chosen-cloud-run-region> \
  --image <reviewed-artifact-registry-image> \
  --service-account <runtime-service-account-email> \
  --set-env-vars GOOGLE_CLOUD_PROJECT=slamsort,GOOGLE_CLOUD_LOCATION=<supported-location>,GEMINI_MODEL=<supported-model-id>
```

Choose ingress/IAM deliberately. If the browser-facing service allows unauthenticated
Cloud Run transport, its paid application endpoints must still require verified
Firebase tokens. Do not expose paid inference during that transition. Use the
attached runtime identity for ADC; do not set a service-account key path.

## 5. Prepare Firebase Hosting later

A human can later run `firebase login`, then `firebase init hosting` and select
`slamsort`, with public directory `apps/web/dist`. Review generated configuration
before accepting any overwrites. Add the `/api/**` Cloud Run rewrite before the
SPA fallback rewrite, and use the actual supported service region. Build with
explicit public Firebase configuration only when authentication is implemented.

Validate the health rewrite and authenticated request flow in a controlled
preview before a human explicitly deploys with `firebase deploy --only hosting
--project slamsort`. Real-folder permissions are browser-origin scoped; a deployed
origin requires its own consent. HTTPS supports the secure-context requirement
but does not guarantee a browser supports the directory picker.

## Official references

- [Google Gen AI SDK](https://googleapis.github.io/js-genai/)
- [Model and endpoint availability](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)
- [Google Cloud authentication basics](https://cloud.google.com/docs/authentication)
- [Local ADC login](https://cloud.google.com/sdk/gcloud/reference/auth/application-default/login)
- [Cloud Run service identity](https://cloud.google.com/run/docs/securing/service-identity)
- [Firebase modular setup](https://firebase.google.com/docs/web/setup)
- [Verify Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase Hosting rewrites](https://firebase.google.com/docs/hosting/full-config)
