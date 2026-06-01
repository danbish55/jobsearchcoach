# Google Drive Setup For The Install Package

This file is for the person building the JobSearchCoach install package.
End users do not need to create a Google Cloud project. They only sign into their
own Google account during onboarding.

## What You Are Creating

You will create one Google OAuth Desktop client for JobSearchCoach. The package
builder puts that client ID and client secret into the generated `config.json`.

Each installed copy still stores data in the user's own Google Drive after that
user signs in.

## Step 1: Open Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Sign in with the Google account that should own the app's OAuth setup.
3. Create a new project, or choose an existing project.
4. A good project name is `JobSearchCoach`.

## Step 2: Enable Google Drive API

1. In Google Cloud Console, open **APIs & Services**.
2. Click **Library**.
3. Search for `Google Drive API`.
4. Open it and click **Enable**.

## Step 3: Configure The OAuth Consent Screen

1. Open **APIs & Services**.
2. Open **OAuth consent screen**.
3. Choose the audience that fits your use:
   - **Internal** if everyone using it is inside your Google Workspace.
   - **External** for normal Gmail accounts.
4. Fill in the app name: `JobSearchCoach`.
5. Fill in user support email and developer contact email.
6. Add the Drive app-data scope if Google asks for scopes:
   - `https://www.googleapis.com/auth/drive.appdata`
7. Save the consent screen.

If the app is in testing mode, add each installer's Gmail address as a test user.

## Step 4: Create OAuth Credentials

1. Open **APIs & Services**.
2. Open **Credentials**.
3. Click **Create Credentials**.
4. Choose **OAuth client ID**.
5. Choose application type **Desktop app**.
6. Name it `JobSearchCoach Desktop`.
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret**.

Keep these values private. They are not as sensitive as the coach API key, but they
identify your Google OAuth app.

## Step 5: Build The Package

On the development computer, open PowerShell in the JobSearchCoach project folder
and run:

```powershell
powershell -ExecutionPolicy Bypass -File tools\build_corinne_package.ps1
```

Paste the Google OAuth Desktop Client ID and Client Secret when prompted.

The package will be created here:

```text
dist\JobSearchCoach-Install.zip
```

## What To Give The End User

Give the user:

1. `dist\JobSearchCoach-Install.zip`
2. The coach access key, sent separately

Do not put the coach access key in the zip file.

## Google Permission The User Will See

During onboarding, the user clicks **Connect Google Drive** and signs into Google.
Google will ask for permission related to app data in Drive.

That permission allows JobSearchCoach to store its own app files in the user's
Google Drive app-data area. It is used for job applications, coaching sessions,
mission progress, resume notes, and gauges.

## If Google Shows An Unverified App Warning

If the OAuth consent screen is still in testing mode or has not been verified,
Google may show an unverified app warning. For private family or small-group use,
the user can continue if they trust the package source and their Gmail address is
listed as a test user.

For broader distribution, publish and verify the OAuth app in Google Cloud.
