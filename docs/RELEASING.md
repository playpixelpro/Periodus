# Setting Up Android Release Signing for Periodus

This guide walks you through creating a signing keystore and storing it in
GitHub Secrets so the `release.yml` workflow can produce signed release APKs.

## Step 1 — Generate a keystore (do this once)

Run this command on your local machine. Choose strong passwords and store them
somewhere safe (e.g. a password manager):

```bash
keytool -genkey -v \
  -keystore periodus-release.jks \
  -alias periodus \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Answer the prompts (name, organisation, city, country, passwords).

> ⚠️ **Keep this file safe.** If you lose it or the password, you can never
> release a signed update that Android will accept as an upgrade of an
> existing install.

## Step 2 — Base64-encode the keystore

```bash
# macOS / Linux
base64 -i periodus-release.jks | tr -d '\n'

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('periodus-release.jks'))
```

Copy the output string.

## Step 3 — Add GitHub Secrets

Go to your repository →  **Settings → Secrets and variables → Actions → New
repository secret** and add:

| Secret name                  | Value                                           |
|------------------------------|-------------------------------------------------|
| `ANDROID_KEYSTORE_BASE64`    | The base64 string from Step 2                   |
| `ANDROID_KEYSTORE_PASSWORD`  | The keystore password you chose in Step 1       |
| `ANDROID_KEY_ALIAS`          | `periodus` (or whatever alias you used)         |
| `ANDROID_KEY_PASSWORD`       | The key password (often same as keystore)       |

## Step 4 — Tag a release

```bash
# Bump the version in:
#   app/package.json           → "version": "1.0.1"
#   app/android/app/build.gradle → versionCode 2 / versionName "1.0.1"
#   app/src/lib/version.ts      → APP_VERSION = '1.0.1'

git add -A
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

The `release.yml` workflow fires automatically, builds a signed APK, and
publishes a GitHub Release with the APK attached.

## Step 5 — On-device update flow

1. Open Periodus → **Settings** → **App updates** → **Check for updates**
2. If an update is available, tap **Download & Install**
3. The APK opens in your browser; download it
4. Tap the downloaded file — Android prompts you to install
5. If you see "Install unknown apps" blocked, follow the system prompt to
   enable it for your browser, then retry

The app stays on your phone — no data is lost during the update.
