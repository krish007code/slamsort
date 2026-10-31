# Evaluation evidence

This is a factual map from the supplied PromptWars x OUTLIER 2026 participant guide to implemented behavior. It is not an official scoring prediction. The guide gives criteria but no weights, evaluator model, or scoring algorithm.

## Challenge alignment

The challenge asks for a fast-paced game or interactive story whose play actually completes a digital chore. SlamSort addresses messy local folders. The player chooses the destination by shooting a file-shaped paper ball into a category hoop. A settled basket invokes a real, verified filesystem move; a missed shot performs no move. Points are awarded only after completion. Demo mode is explicitly fictional.

## Criteria mapped to evidence

| Guide criterion | Implemented evidence | Source / verification |
|---|---|---|
| Code quality | TypeScript strict checking; React session controller; Phaser rendering; separate file mutation, planning and validation modules | `apps/web/src/app/App.tsx`, `apps/web/src/game/physics.ts`, `apps/web/src/files/engine.ts`, `npm run typecheck`, `npm run lint` |
| Security | Firebase ID-token validation, exact-origin CORS, bounded schemas, rate limits, secret-free runtime identity; local journaled copy/verify/remove; consent for AI metadata | `SECURITY.md`, `apps/api/src/routes/ai.ts`, `apps/api/src/validation/ai.ts`, `tests/public-ai.test.mjs`, `tests/file-context.test.mjs`, `tests/engine.test.mjs` |
| Efficiency | Four-file starting buffer, two concurrent preview reads, lazy Phaser/PDF imports, serialized cached child planning, bounded byte comparison, 12-file AI metadata cap | `files/useFileBuffer.ts`, `files/preparation.ts`, `ai/useAi.ts`, `files/engine.ts` under `apps/web/src` |
| Testing | 59 meaningful tests, including failure paths and rejection before inference; reproducible combined check; CI clean installation | `tests/`, `npm run check`, `.github/workflows/verify.yml` |
| Accessibility | Native labeled controls, visible keyboard focus, assisted Fire button and category selection, keyboard shortcuts, pause, status announcements and reduced-motion hero/chart animations | `app/App.tsx`, `app/FolderEntry.tsx`, `app/LevelTree.tsx`, `styles/global.css` under `apps/web/src` |
| Problem alignment | The winning basket changes the real folder, with correction grace, safe retry and verified undo | `settle()` in `apps/web/src/app/App.tsx`, `game/catchWindow.ts`, `files/engine.ts`; real-folder demo below |
| Effective Google services | Gemini on Vertex AI proposes organization categories and optional hints; Cloud Run hosts both website and API; Firebase Authentication protects public AI calls | `apps/api/src/services/vertex.ts`, `services/firebase.ts`, `Dockerfile`, `Dockerfile.web`, `apps/web/src/ai/client.ts` |

## Honest limits

- Real folder mutation requires a supported desktop Chromium browser, secure origin, user permission, Web Locks and IndexedDB. Other browsers can use the fictional demo.
- Pointer correction inside the canvas is not fully equivalent to a screen-reader workflow. Native assisted controls help, but no WCAG conformance audit has been completed.
- Copy/verify/remove is not atomic against external applications. Users should keep the selected folder idle; uncertain operations require manual recovery.
- The Duplicates target retains user-selected files. Automatic duplicate detection is not implemented.
- AI metadata is a sample of at most 12 names/types/sizes with explicit setup consent. Planning does not inspect full document content. Optional individual hints have their own reviewed excerpt consent.
- Single-file groups and groups that do not become smaller finish. Unrelated folders and Duplicates are not traversed automatically.
- Provider errors or rate limits can leave an earlier draft or local fallback. These states are labeled. There are no measured productivity gains or user-study results yet.

## Source references

The participant-provided `participants_guide.pdf`, pages 4–8, specifies public GitHub, deployed link, brief description, assessment criteria, two scored attempts and last-attempt scoring. Page 8 requires a working Cloud Run deployment for shortlist eligibility. The guide is not redistributed in this repository.

[Hack2skill PromptWars Community](https://hack2skill.com/pw-community/) confirms submission tracking, scoring and leaderboard infrastructure for community editions. [Hack2skill submission documentation](https://docs.hack2skill.com/vision-by-h2s/vision-for-innovators-participants/team-dashboard-roadmap/submissions) explains the submission sections and timer. Neither page publishes the hidden evaluator algorithm. Follow the event guide and organizer instructions for this specific edition.
