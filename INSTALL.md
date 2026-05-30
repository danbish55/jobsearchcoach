# JobSearchCoach Install Guide

This guide is written for someone who does not normally install developer tools.

JobSearchCoach is not a normal app-store app. It is a folder that runs a small
private web server on your own computer, then opens the app in your browser.

## What You Need

- A Windows or Mac computer.
- Python 3 installed on the computer.
- The JobSearchCoach zip file.
- The coach access key provided separately by the app owner.
- A Google account if you want Google Drive backup/sync.

## Step 1: Unzip The Package

1. Find the JobSearchCoach zip file. Its name will look like
   `install-v2-20260530.zip`.
2. Right-click it and choose **Extract All** on Windows, or double-click it on Mac.
3. Move the extracted JobSearchCoach folder somewhere easy to find, such as
   Desktop or Documents.

Do not run JobSearchCoach directly from inside the zip file. Always unzip it first.
The folder name includes a version and build date so it will not overwrite an
older JobSearchCoach install.

## Step 2: Install Python If Needed

JobSearchCoach needs Python 3 to start.

### Windows

1. Go to https://www.python.org/downloads/windows/
2. Download the latest Python 3 installer.
3. Open the installer.
4. Important: check the box that says **Add python.exe to PATH**.
5. Click **Install Now**.

### Mac

1. Go to https://www.python.org/downloads/macos/
2. Download the latest Python 3 installer.
3. Open the downloaded `.pkg` file and follow the steps.

## Step 3: Start JobSearchCoach

### Windows

1. Open the extracted JobSearchCoach folder.
2. Double-click `Start JobSearchCoach.bat`.
3. A black command window will open.
4. A `JobSearchCoach` shortcut will be created on the Desktop if one does not
   already exist.
5. Your browser should open to JobSearchCoach automatically.

If Windows asks about network access, allow access on private networks. The app
runs on your own computer at `http://localhost:8765`.

### Mac

1. Open the extracted JobSearchCoach folder.
2. Double-click `Start JobSearchCoach.command`.
3. If Mac says it cannot open the file, right-click the file, choose **Open**, then
   choose **Open** again.
4. A Terminal window will open.
5. A `JobSearchCoach.command` launcher will be created on the Desktop if one does
   not already exist.
6. Your browser should open to JobSearchCoach automatically.

The `.command` file is a plain text startup script, not an installer.
If Python opens in IDLE but Terminal cannot find it, this launcher also checks the
standard python.org Mac install locations.

## Step 4: First-Time Setup In The Browser

The app will walk you through setup.

1. Confirm your name and email addresses.
2. Paste the coach access key when asked.
3. Connect Google Drive when asked.
4. Sign into the Google account where you want your JobSearchCoach data stored.
5. Approve the Google Drive permission.

## What Google Drive Access Means

JobSearchCoach asks for access to Google Drive app data. This lets it store small
JobSearchCoach data files in your Google account.

It does not need access to read all of your Drive files. The app data folder is a
private area for this app's own files.

Your data is stored in:

- This browser's local storage on this computer.
- Your Google Drive app data after you connect Drive.
- A small setup file in your computer's user data folder, not inside the dated
  install folder. This protects your access key and Google Drive connection when
  you receive a new install package.

## How To Stop The App

Close the command window or Terminal window that opened when you started
JobSearchCoach.

## How To Start It Again Later

Open the folder and double-click the same launcher again:

- Windows: `Start JobSearchCoach.bat`
- Mac: `Start JobSearchCoach.command`

## Troubleshooting

### The Browser Did Not Open

Open your browser manually and go to:

`http://localhost:8765`

### Python Is Missing

Install Python 3 using the instructions above, then double-click the launcher
again.

### Google Sign-In Popup Is Blocked

Allow popups for `localhost` or `http://localhost:8765`, then click Connect Google
Drive again.

### Google Says The App Is Not Verified

Only continue if this package came from someone you trust. The app uses the Google
Drive app-data permission so your JobSearchCoach data can sync to your own Google
account.

### The App Asks For An Access Key

Ask the app owner for the JobSearchCoach coach access key. It is intentionally not
included in the install package.

### You Want To Reset Everything

In JobSearchCoach, open Settings and use **Export All Data** first if you want a
backup. Then use **Reset Everything**.
