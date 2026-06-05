# Release Rules & Pipeline

This document outlines the standard release process for Aynite.

## Release Versioning
We follow [Semantic Versioning (SemVer)](https://semver.org/):
- **Major**: Breaking changes.
- **Minor**: New features, non-breaking.
- **Patch**: Bug fixes, internal improvements.

## Release Channels
1. **Stable**: Production-ready releases.
2. **Beta**: Pre-release builds for testing and early feedback.

## Tagging Convention
Tags must be prefixed with `v`.
- **Stable**: `v1.0.0`, `v1.2.3`
- **Beta**: `v1.0.0-beta.0`, `v1.0.0-beta.1`

### How to Create a Release
1. Ensure you are on the `main` branch and it's up to date.
2. Update the version and create a tag:
   ```bash
   # For a patch release (e.g., 1.0.0 -> 1.0.1)
   npm version patch
   
   # For a specific beta version
   npm version 1.0.0-beta.0
   ```
3. Push the tag to GitHub:
   ```bash
   git push --tags
   ```

## Automated Pipeline
Once a tag is pushed, a GitHub Action is triggered:
- **Platforms**: Builds for macOS (Universal), Windows (x64), and Linux (x64).
- **Linux Formats**: `.deb`, `.rpm`, and `.AppImage`.
- **Distribution**: Artifacts are automatically uploaded to a new GitHub Release.
- **Pre-releases**: Tags containing `-beta` are automatically marked as "Pre-release" on GitHub.

## Auto-Update Mechanism
The app uses `electron-updater` to check for updates against GitHub Releases.
- It checks the `latest.yml` (stable) or `beta.yml` (beta) metadata files.
- Updates are downloaded in the background.
- Users are prompted to restart to apply the update once the download is complete.

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
