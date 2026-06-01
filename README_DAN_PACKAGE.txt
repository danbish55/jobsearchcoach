Build JobSearchCoach Install Package

Before building the final package, create a Google OAuth credential:
- Application type: Desktop app
- Enable Google Drive API
- The app uses Drive app data scope

See GOOGLE_DRIVE_SETUP.md for step-by-step Google Cloud instructions.

Build from PowerShell:

1. Run:
   powershell -ExecutionPolicy Bypass -File tools\build_corinne_package.ps1

2. Paste the Google OAuth Desktop Client ID and Client Secret when asked.

3. Send the installer:
   dist\JobSearchCoach-Install.zip

Do not put the Claude/Anthropic access key in the package. Give that to Corinne separately so she can paste it during setup.

Corinne's setup:
- Unzip the file
- Windows: double-click Start JobSearchCoach.bat
- Mac: double-click Start JobSearchCoach.command
- Enter contact info and the access key
- Connect Google Drive with her Gmail account

The app opens Gmail compose for progress reports. It does not send email silently.

Updates:
- Make fixes in GitHub/Codex and push them.
- Corinne can double-click "Update JobSearchCoach.command" inside her app folder.
- The updater creates a fresh backup folder first, pulls the latest app files from the codex/dashboard-mission-refresh branch, and preserves config.json.
