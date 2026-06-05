#!/bin/bash
set -u

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$HOME/Desktop"
SHORTCUT="$DESKTOP_DIR/Start JobSearchCoach.command"

clear
echo "=============================================="
echo " JobSearchCoach Desktop Shortcut Setup"
echo "=============================================="
echo

if [ ! -f "$APP_DIR/server.py" ] || [ ! -f "$APP_DIR/index.html" ]; then
  echo "This file must be run from the JobSearchCoach folder."
  echo "Expected files were not found in:"
  echo "  $APP_DIR"
  echo
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

mkdir -p "$DESKTOP_DIR"

if command -v xattr >/dev/null 2>&1; then
  echo "Clearing macOS quarantine flags..."
  xattr -dr com.apple.quarantine "$APP_DIR" 2>/dev/null || true
fi

chmod +x "$APP_DIR"/*.command 2>/dev/null || true

cat > "$SHORTCUT" <<EOF
#!/bin/bash
set -u

APP_DIR="$APP_DIR"

clear
echo "=============================================="
echo " JobSearchCoach"
echo "=============================================="
echo
echo "Starting JobSearchCoach..."
echo

if [ ! -f "\$APP_DIR/server.py" ]; then
  echo "JobSearchCoach was not found at:"
  echo "  \$APP_DIR"
  echo
  echo "Move the repo back to that folder or run Install Mac Desktop Shortcut.command again from the new repo location."
  echo
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

cd "\$APP_DIR" || exit 1

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "\$APP_DIR" 2>/dev/null || true
fi

PYTHON_EXE=""
PYTHON_TEST='import sys; raise SystemExit(0 if sys.version_info >= (3,8) else 1)'

for cmd in python3 python; do
  if command -v "\$cmd" >/dev/null 2>&1; then
    candidate="\$(command -v "\$cmd")"
    if "\$candidate" -c "\$PYTHON_TEST" >/dev/null 2>&1; then
      PYTHON_EXE="\$candidate"
      break
    fi
  fi
done

for candidate in /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [ -z "\$PYTHON_EXE" ] && [ -x "\$candidate" ] && "\$candidate" -c "\$PYTHON_TEST" >/dev/null 2>&1; then
    PYTHON_EXE="\$candidate"
    break
  fi
done

if [ -z "\$PYTHON_EXE" ]; then
  echo "Python 3.8 or newer is required to run JobSearchCoach."
  echo "Opening the Python download page..."
  open "https://www.python.org/downloads/macos/"
  echo
  echo "After installing Python, double-click this shortcut again."
  echo
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

echo "Using Python: \$PYTHON_EXE"
echo
"\$PYTHON_EXE" -u server.py
EOF

chmod +x "$SHORTCUT"

if command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$SHORTCUT" 2>/dev/null || true
fi

echo "Desktop shortcut created:"
echo "  $SHORTCUT"
echo
echo "Double-click Start JobSearchCoach.command on the Desktop to launch the app."
echo
read -n 1 -s -r -p "Press any key to close."
