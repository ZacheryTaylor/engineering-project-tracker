# Engineering Project Tracker

Shared land-development project tracker for All Projects metrics, Immediate Needs, individual workspaces, kickoff, milestones, and action items. Editing is PIN-locked. Shared updates save as GitHub commits to `data/state.json`.

Live site (after Pages is enabled): [https://zacherytaylor.github.io/engineering-project-tracker/](https://zacherytaylor.github.io/engineering-project-tracker/)

## Features

- Responsive All Projects dashboard and portfolio metrics
- Search plus phase and health filters
- Immediate Needs dashboard (overdue, due soon, high priority)
- Individual project workspaces
- Project kickoff / New Project form
- Milestones and action items with owners, due dates, priorities, statuses, and notes
- `0000` unlock / Lock & Save workflow
- Browser-only editor name and GitHub token (never stored in the repo)
- GitHub commit-based shared saving across computers
- Public seed data: Herons Landing TH, Benjamins Run, Cedar Ridge 10 Mile Road

## GitHub Pages

1. Open the repository **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and folder to `/ (root)`.
4. Save. The site publishes at `https://<username>.github.io/engineering-project-tracker/`.
5. If the app is in a project site (not a user site), keep relative paths (`data/state.json`) as shipped.

No Jekyll processing is required. Static HTML/CSS/JS only.

## Operating instructions

### View (anyone)

Open the Pages URL or `index.html`. The dashboard loads public `data/state.json`. The app is read-only until unlocked.

### Edit on any computer

1. Click **Settings** and enter your **editor name**.
2. Create a GitHub personal access token with `repo` scope (private) or `public_repo` (this public repo).
3. Paste the token in Settings. It stays in this browser only (`localStorage`). Do not commit tokens.
4. Click **Unlock**, enter PIN `0000`.
5. Edit projects, milestones, and actions.
6. Click **Lock & Save**. The app commits `data/state.json` to `main` with your editor name in the commit message, then locks again.

If two people save at once, GitHub may reject a stale SHA. Reload, re-apply the change, and save again.

### New project kickoff

Unlock, open **New Project**, complete name, client, location, phase, health, PM, kickoff date, and notes, then save. Open the project workspace to add milestones and action items.

### PIN

Default unlock PIN is `0000`. Change it in `app.js` (`UNLOCK_PIN`) if you fork a private copy. Do not put a production PIN in a public repo if that is a concern; this tracker is designed as a lightweight shared office board, not a security boundary.

## Data

Canonical file: [`data/state.json`](data/state.json).

Seed projects:

| Project | Type / notes |
| --- | --- |
| Herons Landing TH | Townhome land development |
| Benjamins Run | Subdivision / site development |
| Cedar Ridge 10 Mile Road | Roadway / 10 Mile Road corridor |

## Local use

Serve the folder over HTTP so `fetch('data/state.json')` works (GitHub Pages, or `npx serve .`). Opening the file as `file://` may block fetch.
