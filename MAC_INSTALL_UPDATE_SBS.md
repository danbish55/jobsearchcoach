# JobSearchCoach Mac Install/Update — Step-by-Step (Dan)

This is your repeatable process for Corinne's MacBook Air.

## What this gives you
- Installer package (`.pkg`) and shareable disk image (`.dmg`)
- Postinstall automation that:
  - clears quarantine on installed app (`xattr -dr`)
  - sets executable permissions
  - adds a Desktop app shortcut

Important: without Apple signing/notarization, macOS may still show a Gatekeeper warning when opening the installer.

---

## A) Build artifacts (run on a Mac)

1. Open Terminal on your Mac build machine.
2. Go to the project folder:
```bash
cd /path/to/JobSearchCoach
```
3. Run build:
```bash
chmod +x scripts/macos/build_macos_installer.sh scripts/macos/postinstall
./scripts/macos/build_macos_installer.sh
```
4. Confirm output files:
- `dist/macos/JobSearchCoach.app`
- `dist/macos/JobSearchCoach-unsigned.pkg`
- `dist/macos/JobSearchCoach-unsigned.dmg`

---

## B) Send installer to Corinne

Recommended file to share:
- `dist/macos/JobSearchCoach-unsigned.dmg`

(You can also share the `.pkg` directly.)

---

## C) Corinne install steps (first install)

1. Double-click `JobSearchCoach-unsigned.dmg`
2. Double-click `JobSearchCoach-unsigned.pkg`
3. If macOS blocks it:
   - System Settings -> Privacy & Security -> Open Anyway
   - or right-click package -> Open
4. Complete installer flow.
5. After install, app should be at:
   - `/Applications/JobSearchCoach.app`
6. Desktop shortcut should exist:
   - `~/Desktop/JobSearchCoach.app`
7. Double-click `JobSearchCoach.app` (opens Terminal and starts local server).

---

## D) First-run setup in app

Inside JobSearchCoach UI:
1. Paste Anthropic API key
2. Connect Google Drive OAuth
3. Save settings

---

## E) Update process (every release)

1. Build new artifacts from latest code (Section A)
2. Send new `.dmg` to Corinne
3. Corinne runs installer again (same steps as Section C)
4. Installer overwrites app at `/Applications/JobSearchCoach.app`
5. Existing `config.json` inside app payload may be replaced by update
   - If preserving config is required, move config to user home in a future enhancement

---

## F) Quick health checks after install

On Corinne Mac Terminal:
```bash
ls -la /Applications/JobSearchCoach.app
xattr -l /Applications/JobSearchCoach.app || true
python3 -m py_compile /Applications/JobSearchCoach.app/Contents/Resources/app/server.py
```

Launch check:
- Double-click `JobSearchCoach.app`
- Browser should open `http://localhost:8765`

---

## G) "Virtual" testing option before sending to Corinne

Use the included GitHub Actions workflow:
- `.github/workflows/macos-installer-smoke.yml`

What it does on macOS runner:
1. builds `.app/.pkg/.dmg`
2. installs `.pkg`
3. verifies installed files and executable bits
4. runs `python3 -m py_compile` on installed `server.py`
5. uploads built artifacts

This is the closest automated preflight without owning a local macOS VM in Hermes.

---

## H) Known limitations (honest)

- Unsigned installer/app can still trigger Gatekeeper before install.
- `xattr -dr` postinstall reduces friction after installation, not before package trust check.
- For truly smooth consumer install, use Apple Developer signing + notarization later.
