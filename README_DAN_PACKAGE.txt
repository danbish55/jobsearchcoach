Build Corinne's Mac Package

Before building the final package, create a Google OAuth credential:
- Application type: Desktop app
- Enable Google Drive API
- The app uses Drive app data scope

Build from PowerShell:

1. Run:
   powershell -ExecutionPolicy Bypass -File tools\build_corinne_package.ps1

2. Paste the Google OAuth Desktop Client ID and Client Secret when asked.
   For a work-computer test package, you can press Enter for both and connect Drive later from Settings.

3. Send Corinne:
   dist\JobSearchCoach-Corinne.zip

Do not put the Claude/Anthropic access key in the package. Give that to Corinne separately so she can paste it during setup.

Corinne's setup:
- Unzip the file
- Double-click Start JobSearchCoach.command
- Enter contact info and the access key
- Connect Google Drive with her Gmail account

The app opens Gmail compose for progress reports. It does not send email silently.

Updates:
- Make fixes in GitHub/Codex and push them.
- Corinne can double-click "Update JobSearchCoach.command" inside her app folder.
- The updater pulls the latest app files from the codex/dashboard-mission-refresh branch and preserves config.json.
