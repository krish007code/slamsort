# SlamSort submission copy

## Required fields

**Project name:** SlamSort

**GitHub:** https://github.com/krish007code/slamsort

**Deployed project:** https://slamsort-web-162765212832.asia-south1.run.app

**Short description:**

SlamSort turns sorting a messy folder into a basketball cannon game. Select a local folder, approve category hoops once, and shoot each file as a paper ball into its destination. Every settled basket performs a real file move through a journaled copy-and-verify engine; misses keep the file unchanged and verified undo restores it. Gemini on Google Cloud Vertex AI proposes categories and prepares future levels while you play, optionally using consented file-name/type metadata. A live folder flowchart shows the hierarchy. Cloud Run hosts the website and API, with Firebase Authentication protecting AI requests. Local file contents stay on the device unless the user separately approves an individual AI hint excerpt.

## One-line pitch

A little aim, a lot less clutter: every basket organizes a real file.

## Two-minute demonstration

- **0:00–0:15 — Problem:** People postpone sorting folders because each file requires a repetitive decision. Introduce the challenge: gameplay must perform the chore.
- **0:15–0:35 — Start:** Open the Cloud Run URL in desktop Chromium. Select a disposable copy of the repository's sample folder. Enter: “Organize into Academics, Skills, Projects and Personal, with relevant subcategories.” Optionally enable filename/type context and generate bins.
- **0:35–0:55 — Plan:** Show the editable glowing flowchart. Approve once. Explain that child plans prepare from sorted file metadata while level one is played, when consent is enabled.
- **0:55–1:20 — Prove the chore:** Shoot a file into the correct hoop, or use Fire for a reliable demonstration. Wait for verified completion. Show the real destination in the file manager.
- **1:20–1:40 — Trust:** Demonstrate Undo restoring the actual file. Explain the one-second correction window and that the left Duplicates bin retains files.
- **1:40–2:00 — Implementation:** Show Vertex AI usage, the public GitHub source, and verification commands. Explain the automatic next levels, local file handling and Google Cloud deployment.

Do not claim the practice demo moves real files. A file-manager before/after view is the strongest evidence for this challenge.

## Suggested pitch-deck content

1. **SlamSort — Shoot files. Clear clutter.** A real filesystem chore completed through play; live URL.
2. **Problem and target users.** Students and individual creators accumulate unsorted files; the repetitive decision process encourages postponement. This is the target hypothesis, not measured research.
3. **Solution and workflow.** Select folder → Gemini/manual bins → approve once → paper-ball shot → verified move → automatic child level.
4. **Live proof.** Show the game and actual before/after folder state. Include Undo and the retained Duplicates bin.
5. **Google Cloud architecture and trust.** Browser file engine + React/Phaser; Firebase token → Cloud Run API → Gemini on Vertex AI. No credentials in source or file-content upload for planning.
6. **Engineering evidence.** 68 automated tests, dependency/security checks, keyboard assisted controls, bounded preparation and documented limitations.
7. **Next steps and business hypothesis.** Start with free individual use; validate demand with student/creator pilots. Potential paid customization and saved workflows are hypotheses, not implemented billing. Track completion, time-to-sort, errors and voluntary repeat usage only after consent and future implementation.

## Before using a scored attempt

- Open the public GitHub URL in a signed-out browser.
- Open the Cloud Run URL; use a fresh disposable test folder in Chromium.
- Verify one real move and Undo, and one Gemini request. Ensure only one SlamSort tab holds the local session lock.
- Submit the repository URL, deployed URL and description in the correct event portal fields. Confirm the portal has saved the final version.
- The supplied guide allows two scored submissions; the last completed attempt counts, not the best. A technical-failure retry is not a free extra scored attempt.
- The supplied agenda lists submission/evaluation at 5:00–5:30 PM, after 4:00–5:00 PM pitch preparation. The actual portal timer and organizer announcements should resolve any changed schedule.

## Questions to answer candidly

**Why is this more than gamification?** A successful gameplay event triggers an actual folder move; the reward follows verified completion.

**What does Gemini do?** It proposes top-level and child categories and optional hints. It never receives filesystem handles or executes moves.

**Can it lose files?** Verification, collision handling, journaling and undo reduce risk. Browser moves are not atomic against external changes; uncertain interruptions require manual review.

**Does it detect duplicates automatically?** No. Users choose the retained Duplicates target; automated detection is future work.

**What is the business model?** This is a working hackathon prototype. Pricing and adoption assumptions have not been validated.

**Which AI built the code?** Development was AI-assisted with Codex. Runtime organization uses Gemini on Vertex AI. Do not claim development used Antigravity if it did not; confirm event-specific tool eligibility with the organizer if required.
