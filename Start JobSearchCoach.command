#!/bin/bash
cd "$(dirname "$0")"
clear
echo "=============================================="
echo " JobSearchCoach"
echo "=============================================="
echo
echo "Starting your coaching app..."
echo

if command -v python3 >/dev/null 2>&1; then
  python3 server.py
elif command -v python >/dev/null 2>&1; then
  python server.py
else
  echo "Python 3 is required to run JobSearchCoach."
  echo "Opening the Python download page..."
  open "https://www.python.org/downloads/macos/"
  echo
  echo "After installing Python, double-click this file again."
  read -n 1 -s -r -p "Press any key to close this window."
fi
