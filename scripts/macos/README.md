# Mac installer packaging (JobSearchCoach)

This folder creates an unsigned macOS installer with reduced manual steps.

## What it builds
- `dist/macos/JobSearchCoach.app`
- `dist/macos/JobSearchCoach-unsigned.pkg`
- `dist/macos/JobSearchCoach-unsigned.dmg`

## What postinstall does
- Runs: `xattr -dr com.apple.quarantine /Applications/JobSearchCoach.app`
- Sets executable permissions on launchers
- Creates Desktop shortcut: `~/Desktop/JobSearchCoach.app`

## Build (must run on macOS)
```bash
cd /path/to/JobSearchCoach
chmod +x scripts/macos/build_macos_installer.sh scripts/macos/postinstall
./scripts/macos/build_macos_installer.sh
```

## Notes
- Unsigned packages may still trigger Gatekeeper at installer-open time.
- `xattr` in postinstall reduces friction after install, but does not replace signing/notarization.
- For smoothest experience, use Apple Developer ID signing + notarization later.
