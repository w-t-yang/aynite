# Release Rules & Pipeline

This document outlines the standard release process for Aynite.

## Versioning
We follow [Semantic Versioning (SemVer)](https://semver.org/):
- **Major** (`x.0.0`): Breaking changes.
- **Minor** (`0.x.0`): New features, non-breaking.
- **Patch** (`0.0.x`): Bug fixes, internal improvements.
- **Beta** (`0.1.0-beta.0`): Pre-release builds for testing.

Current version: **0.1.0** (fresh start after cleaning up all `v1.0.0-beta.*` tags).

## Release Scripts

All release scripts bump the version in `package.json`, create a git tag, and push both the commit and tag to GitHub, which triggers the CI pipeline.

```bash
# Major release (breaking changes) — e.g., 0.1.0 → 1.0.0
npm run release:major

# Minor release (new features) — e.g., 0.1.0 → 0.2.0
npm run release:minor

# Patch release (bug fixes) — e.g., 0.1.0 → 0.1.1
npm run release:patch

# Beta pre-release — e.g., 0.1.0 → 0.1.0-beta.0 → 0.1.0-beta.1
npm run release:beta
```

> **Note**: Beta tags are automatically marked as "Pre-release" on GitHub Releases.

## Tagging Convention
Tags must be prefixed with `v` and match the SemVer version in `package.json`.
- **Stable**: `v0.1.0`, `v0.2.0`, `v1.0.0`
- **Beta**: `v0.1.0-beta.0`, `v0.1.0-beta.1`

## Automated Pipeline
Once a tag is pushed, a GitHub Action is triggered:
- **Platforms**: Builds for macOS (Universal), Windows (x64), and Linux (x64).
- **Linux Formats**: `.deb`, `.rpm`, and `.AppImage`.
- **Distribution**: Artifacts are automatically uploaded to a new GitHub Release.
- **Pre-releases**: Tags containing `-beta` are automatically marked as "Pre-release" on GitHub.

## Auto-Update Mechanism
The app uses `electron-updater` to check for updates against GitHub Releases.
- It checks the `latest-mac.yml` (macOS), `latest.yml` (Windows), or `latest-linux.yml` (Linux) metadata files.
- Updates are downloaded to the app's dedicated updates cache directory.
- Users are prompted to restart to apply the update once the download is complete.

## macOS Build Target
The macOS build produces **two** artifacts:
1. **DMG** — For distribution and initial install (`Aynite-{version}-arm64.dmg` / `Aynite-{version}.dmg`)
2. **ZIP** — For electron-updater's auto-update mechanism (`Aynite-{version}-arm64-mac.zip` / `Aynite-{version}-mac.zip`)

The DMG is the user-facing installer. The ZIP is the Squirrel.Mac update package used internally by `autoUpdater.downloadUpdate()` and `autoUpdater.quitAndInstall()`.

Both artifacts are **signed and notarized** to avoid Gatekeeper warnings.

### Update Asset Location
Downloaded update installers are cached in the app's user data directory under `__updates__/`:
- **macOS**: `~/Library/Application Support/aynite-app/__updates__/`
- **Windows**: `%APPDATA%/aynite-app/__updates__/`
- **Linux**: `~/.config/aynite-app/__updates__/`

This follows the same convention used by Chrome, VS Code, and other major Electron apps.

## Security & Signing
- **GitHub Token**: A `GH_TOKEN` must be configured in repository secrets for publishing.
- **App Signing**: macOS builds are **signed and notarized** to avoid Gatekeeper warnings and enable auto-updates.

### macOS Code Signing Setup

To enable signing, add the following **GitHub Actions secrets** to your repository (`Settings → Secrets and variables → Actions`):

| Secret | Description | How to Get It |
|--------|-------------|---------------|
| `CSC_LINK` | Base64-encoded Developer ID Application certificate (.p12) | See below |
| `CSC_KEY_PASSWORD` | Password for the .p12 file | Set when exporting the certificate |
| `APPLE_ID` | Your Apple Developer account email | Your Apple ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization | `appleid.apple.com` → Security → App-Specific Passwords |
| `APPLE_TEAM_ID` | 10-character Team ID | `developer.apple.com` → Account → Membership |

#### How to Export & Encode the Signing Certificate

1. Open **Keychain Access** on your Mac
2. Find your **Developer ID Application** certificate under "My Certificates"
3. Right-click → **Export** → choose `.p12` format → set a strong password
4. Encode the `.p12` file to base64:
   ```bash
   base64 -i DeveloperID.p12 | pbcopy
   ```
5. Paste the result as the `CSC_LINK` secret in GitHub

#### How to Create an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com) → Sign In
2. Navigate to **App-Specific Passwords** (under Security)
3. Generate a new password (name it something like "Aynite CI")
4. Copy and save it as the `APPLE_APP_SPECIFIC_PASSWORD` secret

#### How it works in CI

The pipeline:
1. **Imports** the signing certificate into the CI keychain (using `apple-actions/import-codesign-certs@v3`)
2. **electron-builder** reads `CSC_LINK` and `CSC_KEY_PASSWORD` to sign the `.app` bundle with hardened runtime
3. **electron-builder** uses `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` to notarize the signed `.zip` via Apple's notary service

> **Note**: The signing certificate must be a **Developer ID Application** certificate (not a Development or Distribution certificate). If you already have one, you're good. If not, create it at `developer.apple.com → Certificates → + → Developer ID Application`.
