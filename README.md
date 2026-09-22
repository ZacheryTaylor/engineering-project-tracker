# Engineering Project Tracker

Shared land-development tracker for kickoff through plat recording. Built from the All Projects / All Jobs columns in the Pensacola tracker workbook.

**PIN:** `0000` unlocks editing. Locking saves and publishes so others see the update on the site.

## How teammates edit

1. Open the GitHub Pages site (or `index.html` via Pages).
2. Click **Unlock**, enter `0000`.
3. Edit project status, dates, comments, and immediate needs.
4. Click **Lock & save**. That writes `data/state.json` in this repo. Anyone who refreshes the site gets the new status.

Each editor needs a GitHub personal access token with **Contents: Read and write** on this repository. Paste it once under **Settings** (stored only in that browser). Do not commit the token.

## GitHub Pages

Settings → Pages → Deploy from branch `main` / root. Private Pages requires GitHub Pro; otherwise make the repo public or serve internally.

Config at the top of `index.html`: `owner`, `repo`, `branch`, `dataPath`, `pin`.
