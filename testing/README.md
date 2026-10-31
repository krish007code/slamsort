# SlamSort test folder

Open `testing/sample-folder` in the game, rather than the project root or `testing`.

The folder contains 18 fictional files, all directly inside it, so the four-file starting buffer can prepare immediately. They cover academics, skills, projects and personal life, with pairs for deeper sorting (biology/mathematics, guitar/Spanish, websites/robotics, travel/cooking).

Suggested Gemini prompt:

> Organize these sample files into Academics, Skills, Projects and Personal. Prepare useful subcategories for biology and mathematics, guitar and Spanish, websites and robotics, and travel and cooking.

`biology-lecture-notes-copy.txt` and `biology-lecture-notes-another-copy.txt` are byte-identical copies of `biology-lecture-notes.txt`. Use them to test the left Duplicates can; the app does not automatically detect duplicates.

A successful shot moves an actual sample file. Try reshooting, correcting a caught ball, undoing a verified move and completing a level to advance into populated bins. No credentials or real personal data are included.

After testing, restore the tracked sample files with `git restore -- testing/sample-folder`. This restores the originals but leaves created category folders in place; use a fresh copy of this sample folder for a clean second run.
