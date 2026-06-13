#!/usr/bin/env bash
set -euo pipefail

# Build unsigned macOS installer artifacts for JobSearchCoach.
# Outputs:
#   dist/macos/JobSearchCoach.app
#   dist/macos/JobSearchCoach-unsigned.pkg
#   dist/macos/JobSearchCoach-unsigned.dmg

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/macos"
BUILD_DIR="$ROOT_DIR/.build/macos"
APP_NAME="JobSearchCoach"
APP_DIR="$DIST_DIR/${APP_NAME}.app"
PKG_PATH="$DIST_DIR/${APP_NAME}-unsigned.pkg"
DMG_PATH="$DIST_DIR/${APP_NAME}-unsigned.dmg"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: This script must run on macOS (Darwin)."
  exit 1
fi

rm -rf "$DIST_DIR" "$BUILD_DIR"
mkdir -p "$DIST_DIR" "$BUILD_DIR"

# 1) Build app bundle
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources/app"

cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>JobSearchCoach</string>
    <key>CFBundleIdentifier</key>
    <string>com.jobsearchcoach.app</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>JobSearchCoach</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
  </dict>
</plist>
PLIST

cat > "$APP_DIR/Contents/MacOS/JobSearchCoach" <<'LAUNCHER'
#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_PAYLOAD="$APP_ROOT/Resources/app"

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display dialog "Python 3 is required. Install from python.org, then relaunch JobSearchCoach." buttons {"OK"} default button "OK" with title "JobSearchCoach"'
  exit 1
fi

# Open in Terminal so user sees logs and can stop with Ctrl+C.
CMD="cd \"$APP_PAYLOAD\" && /usr/bin/env python3 server.py"
osascript <<EOF
 tell application "Terminal"
   activate
   do script "$CMD"
 end tell
EOF
LAUNCHER
chmod +x "$APP_DIR/Contents/MacOS/JobSearchCoach"

# Copy app payload files (exclude git/build artifacts)
rsync -a --delete \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '.build' \
  --exclude 'dist' \
  --exclude '.github' \
  --exclude '*.pyc' \
  "$ROOT_DIR/" "$APP_DIR/Contents/Resources/app/"

# Add Mac helper launcher inside payload
cat > "$APP_DIR/Contents/Resources/app/Start JobSearchCoach.command" <<'CMD'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/env python3 server.py
CMD
chmod +x "$APP_DIR/Contents/Resources/app/Start JobSearchCoach.command"

# 2) Build package payload installed directly into /Applications
PKG_ROOT="$BUILD_DIR/pkgroot"
mkdir -p "$PKG_ROOT"
ditto "$APP_DIR" "$PKG_ROOT/$APP_NAME.app"

SCRIPTS_DIR="$BUILD_DIR/scripts"
mkdir -p "$SCRIPTS_DIR"
cp "$ROOT_DIR/scripts/macos/postinstall" "$SCRIPTS_DIR/postinstall"
chmod +x "$SCRIPTS_DIR/postinstall"

pkgbuild \
  --root "$PKG_ROOT" \
  --identifier "com.jobsearchcoach.installer" \
  --version "1.0" \
  --install-location "/Applications" \
  --scripts "$SCRIPTS_DIR" \
  "$PKG_PATH"

# 3) Build DMG wrapper for easier sharing
hdiutil create -volname "JobSearchCoach Installer" -srcfolder "$DIST_DIR" -ov -format UDZO "$DMG_PATH"

echo "Build complete:"
echo "  $APP_DIR"
echo "  $PKG_PATH"
echo "  $DMG_PATH"
