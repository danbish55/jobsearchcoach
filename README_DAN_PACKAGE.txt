Build JobSearchCoach Install Package
(JobSearchCoach and JobLeadsTool are one program in one repo now.)

One-time Google OAuth setup (already done — see GOOGLE_DRIVE_SETUP.md):
- Application type: Desktop app
- Enable Google Drive API
- The app uses Drive app data scope
- The client id/secret live in the local config.json on Dan's machine.

Build a package:

1. Commit your changes (the package is built from a git commit, not the
   working tree).

2. Run:
   python tools/build_install_package.py --include-google-creds

3. Send the installer:
   dist\JobSearchCoach-Install.zip

Do not put the Claude/Anthropic access key in the package. Give that to
Corinne separately so she can paste it during setup.

Corinne's first install:
- Unzip the file to Desktop
- Mac: run "First Time Setup.command" once, then "Start JobSearchCoach.command"
- Windows: double-click Start JobSearchCoach.bat
- Enter contact info and the access key
- Connect Google Drive with her Gmail account

The app opens Gmail compose for progress reports. It does not send email
silently.

Updates (same zip works as an updater):
- Commit fixes, build a fresh zip, send it to Corinne.
- She unzips it to Desktop and double-clicks "Apply Update.command" in the
  NEW folder.
- The updater finds her existing install, backs it up, updates the code,
  and preserves her settings and Job Leads data.
- Her API key and Google connection live in Library/Application Support/
  JobSearchCoach (outside the app folder), so updates never touch them.
