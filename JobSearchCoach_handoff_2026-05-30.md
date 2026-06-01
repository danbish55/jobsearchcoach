# JobSearchCoach Handoff - May 30, 2026

This file is a practical handoff so you can open the project on another computer and continue editing with context.

## Project Location

Use:

```text
C:\Code\JobSearchCoach
```

Do not use the old OneDrive `Code` folder. Code projects belong in `C:\Code`.

## Git State

Branch:

```text
codex/dashboard-mission-refresh
```

Latest pushed commit at the time this handoff was created:

```text
fae3aa0 Smooth sidebar collapse animation
```

Recent commits:

```text
fae3aa0 Smooth sidebar collapse animation
c236802 Add briefing previews and coach session memory
93c0126 Update progress report nav icon
b2771b4 Refine sidebar utility and nav icons
e212afc Polish sidebar navigation collapse
0561d3f Add loading overlays for resources and resume
a2472b1 Improve startup sync and API reliability
b6bd358 Harden briefing room YouTube search
```

Important: `DaAPI.txt` is intentionally untracked and private. Do not stage, commit, push, or inspect it unless explicitly asked.

## How To Run

From the project folder, start the local app server the usual way, or run:

```powershell
python server.py
```

Then open:

```text
http://localhost:8765/
```

## Major Work Completed In This Chat

### Resume Deep Dive

- Added the Resume Deep Dive feature.
- Added three-column Deep Dive layout with independently scrolling columns.
- Added rewrite parsing for `SECTION / ORIGINAL / SUGGESTED`.
- Added suggested rewrite cards, accepted rewrite flow, revised resume modal, and rescore wiring.
- Adjusted the Deep Dive layout so the answer textarea remains visible on normal laptop screens.
- Added scroll controls and auto-scroll behavior.

### Resume Page

- Replaced the old quote panel with a score snapshot/comparison panel.
- Made `SCORE SNAPSHOT` readable in light mode.
- Removed the old arrow indicator from that panel.
- Added loading overlay behavior to the Resume File card while reading/rating a resume.

### Intelligence / Resources Page

- Added the Resources page under an `INTELLIGENCE` nav section.
- Added Market Intel, Field Strategy, and Briefing Room sections.
- Added refresh buttons, saved items, and content cards.
- Hardened Briefing Room parsing so YouTube results display even if Claude returns `youtube_url`, `youtubeUrl`, `video_url`, or loose bullet-style output instead of perfect JSON.
- Briefing Room now searches YouTube-focused content and prioritizes:
  - Alex The Analyst
  - Luke Barousse
  - Ken Jee
  - StatQuest with Josh Starmer
  - Data School
  - codebasics
  - Chandoo
  - Keith Galli
  - Tina Huang
  - 3Blue1Brown
  - Sundas Khalid
  - Sabrina Romonov
- Added section-level loading overlays on Resources sections instead of a separate progress panel.

### Daily Mission Briefing

- Added the Dashboard Daily Mission Briefing card.
- Bond/MI6 style: serious, dry, direct, not parody.
- Added `context/daily_mission_briefing.md` so the briefing behavior is documented outside the JS and included as app context.
- Briefing card now uses the width of the container better, with larger line spacing.
- Added sample briefing preview text for unavailable live briefing state.
- Added a bottom-right calendar button that opens a scrollable preview modal with sample briefings.
- Adjusted the `CLASSIFIED` stamp size and position.
- Moved the `007` watermark upward.

### Coach Memory

The coach already used:

- `context/corinne_claude_context.md`
- live app stats
- saved session history
- compressed old session summaries
- Google Drive sync for `sessions`

One gap was fixed:

- Active Coach chat now autosaves to `coach_current_session`.
- It reloads after app restart.
- It syncs through Google Drive because `coach_current_session` was added to `Storage.DRIVE_KEYS`.
- It is included in Settings backup/export.
- Clicking `New Session` saves it into normal session history and clears the active autosave.

### Sidebar / Navigation

- Added a polished left sidebar collapse/expand feature.
- Collapse state persists across reloads.
- Tooltips remain available in collapsed mode.
- Active nav highlighting is preserved.
- Settings and light/dark controls were moved below Progress Report and now collapse vertically as icons.
- Icons changed:
  - Coach: cap icon
  - Resume: writing hand
  - LinkedIn: blue `in` logo badge
  - Resources: trophy
  - Progress Report: stopwatch/gauge-style icon
- The sidebar collapse animation was improved after it became jumpy:
  - App shell changed from flex layout to grid.
  - `grid-template-columns` animates from `240px` to `72px`.
  - Nav labels are real `.nav-label` spans and fade/shrink instead of using `font-size: 0`.

### Workflow Activity History

- Added history containers to workflow pages below Applications.
- Follow Ups and related workflow pages now have compact history rows, edit/delete buttons, date sorting, and validation/normalization changes.
- Side Hustle capitalization issue was fixed.
- USC/Eller vague answers comment box was removed.

## Files Worth Knowing

Core app:

```text
index.html
css/styles.css
server.py
```

Main app shell and storage:

```text
js/app.js
js/ui.js
js/storage.js
js/drive.js
js/claude.js
```

Views heavily edited:

```text
js/views/dashboard.js
js/views/resources.js
js/views/resume.js
js/views/resume-deep-dive.js
js/views/coach.js
js/views/workflow-pages.js
js/views/gauges.js
js/views/settings.js
```

Context files:

```text
context/corinne_claude_context.md
context/daily_mission_briefing.md
```

## Important Behavioral Notes

- The app uses localStorage as primary local data storage.
- If Google Drive is connected, `Storage.set()` syncs keys to Drive.
- `Storage.syncFromDrive()` pulls keys on startup.
- Coach persistent memory depends on:
  - static markdown context,
  - `sessions`,
  - `coach_current_session`,
  - live app data such as jobs, gauges, milestones, resume, and progress.
- Daily Mission Briefing generates once per calendar day and stores:
  - `last_briefing_date`
  - `last_briefing_text`
- Briefing previews are sample text only and do not replace the live briefing.

## Current Caution

Briefing Room live search depends on the Claude API key/account supporting web search. The app-side parser and display logic were hardened, but a real live install still needs a working Claude key with web search available.

## Quick Verification Commands

```powershell
node --check js\views\dashboard.js
node --check js\views\coach.js
node --check js\views\resources.js
node --check js\views\resume.js
node --check js\ui.js
```

## Before Pushing From Another Computer

Run:

```powershell
git status --short --branch
git pull --ff-only
```

Then make changes, test, stage only intended files, and push.

Again: do not stage `DaAPI.txt`.
