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
   git push origin main --tags
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
- **App Signing**: (Optional but recommended) macOS builds should be signed and notarized to avoid security warnings and enable auto-updates on macOS.
