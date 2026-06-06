# Build And Release

## Workflow

The desktop release pipeline is defined in:

```text
.github/workflows/ci-release.yml
```

GitHub Actions displays four ordered jobs.

## 1. Bootstrap And Build

Runner: `ubuntu-latest`

Steps:

1. check out the repository
2. configure Node.js 22 with npm caching
3. install exactly from `package-lock.json` using `npm ci`
4. run the production application build

This stage catches dependency, type-checking, and bundling failures before test
or release runners are allocated.

## 2. Testing

Runner: `ubuntu-latest`

This job starts only after bootstrap succeeds. It runs:

```bash
npm run typecheck
npm run test:smoke
```

## 3. Release Builds

The release matrix starts only after testing succeeds.

| Package       | GitHub runner    | Target CPU | Format     |
| ------------- | ---------------- | ---------- | ---------- |
| Apple Silicon | `macos-15`       | `arm64`    | DMG + ZIP  |
| Intel Mac     | `macos-15-intel` | `x64`      | DMG + ZIP  |
| Windows       | `windows-latest` | `x64`      | NSIS setup |
| Linux         | `ubuntu-latest`  | `x64`      | AppImage   |

Each runner performs a native dependency installation, application build, and
platform packaging. The macOS runners additionally perform Developer ID
signing, Apple notarization, stapling, and DMG verification:

```bash
codesign --verify --deep --strict
spctl --assess --type execute
xcrun stapler validate
```

The package is uploaded only if all three checks pass. Native runners are used
instead of cross-compiling.

Before upload, every runner launches the packaged application with its
`--smoke-test` acceptance mode. That mode loads the production sidebar HTML,
uses the real textarea and send button to submit `/help`, crosses the preload
and IPC boundary, and verifies that both the user question and assistant
response render. A missing renderer asset, broken preload, failed IPC handler,
or startup crash therefore prevents publication.

The resulting workflow artifacts are:

```text
benchmarks-<commit>/browso.json
browso-linux-x86-64.AppImage
browso-mac-apple-silicon.dmg
browso-mac-mac-intel.dmg
browso-win-x64.exe
SHA256SUMS.txt
```

The final benchmark job starts only after code quality, application build, and
automated tests pass. On release runs it also waits for every platform package
and the GitHub release to complete. Its JSON artifact records uncached linting,
format verification, separate Node and renderer typechecks, tests, production
bundling, bundle and source breakdowns, largest generated files, and dependency
counts.

Each package artifact also contains the updater payload and metadata consumed by
`electron-updater`:

```text
mac-arm64-mac.yml
mac-x64-mac.yml
win-x64.yml
linux-x64-linux.yml
*.zip
*.blockmap
```

## 4. Versioned Release

The publish job downloads all platform artifacts, creates `SHA256SUMS.txt`, and
publishes a GitHub release whose tag matches the version in `package.json`.
Existing releases are never deleted. Rerunning the workflow for the same
version replaces that release's artifacts.

Before shipping an update, increment the version:

```bash
npm version 1.0.0-beta.2 --no-git-tag-version
```

An installed application compares that semantic version with its current
version. It downloads the matching architecture channel, prompts the user, and
restarts to install in place. User settings and application data remain in the
Electron user-data directory.

## Triggers

| Event                               | Build | Test | Package | Publish |
| ----------------------------------- | ----- | ---- | ------- | ------- |
| Pull request                        | yes   | yes  | no      | no      |
| Push to `main`                      | yes   | yes  | yes     | yes     |
| Manual dispatch from `main`         | yes   | yes  | yes     | yes     |
| Manual dispatch from another branch | yes   | yes  | no      | no      |

Concurrency cancellation prevents an older run on the same branch from
publishing after a newer commit.

## GitHub Permissions

The workflow defaults to read-only repository contents. Only the final publish
job receives:

```yaml
permissions:
  contents: write
```

It uses the repository-provided `GITHUB_TOKEN`; no personal access token is
required.

Repository Actions settings must allow workflows to create releases with
`GITHUB_TOKEN`.

## Local Commands

Application build:

```bash
npm run build
```

Apple Silicon DMG, update ZIP, and metadata:

```bash
npm run build:mac:arm64
```

Intel DMG, update ZIP, and metadata:

```bash
npm run build:mac:x64
```

Windows installer:

```bash
npm run build:win
```

Linux packages:

```bash
npm run build:linux
```

## Signing And Notarization

Production packages use hardened runtime, a Developer ID Application
certificate, Apple's notary service, and a stapled notarization ticket.

Configure these encrypted GitHub Actions secrets:

| Secret                       | Value                                          |
| ---------------------------- | ---------------------------------------------- |
| `MACOS_CERTIFICATE_P12`      | Base64-encoded Developer ID Application `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12`        |
| `APPLE_API_KEY_P8`           | Base64-encoded App Store Connect API key `.p8` |
| `APPLE_API_KEY_ID`           | App Store Connect API key ID                   |
| `APPLE_API_ISSUER`           | App Store Connect API issuer ID                |
| `APPLE_TEAM_ID`              | Ten-character Apple Developer team ID          |

Example encoding commands:

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
base64 -i AuthKey_KEYID.p8 | pbcopy
```

The certificate must be a **Developer ID Application** certificate for direct
distribution, not an Apple Development, Apple Distribution, or Mac App Store
certificate. Keep all certificate and API-key material out of the repository.

When all secrets are configured, the release job forces code signing and
refuses to upload a DMG that fails signature, notarization, or Gatekeeper
verification. When one or more secrets are absent, it emits a warning and
packages an ad-hoc signed, unnotarized DMG instead. Ad-hoc signing keeps the
Electron application and its nested frameworks internally valid, but users
must still approve the app through Finder or macOS Privacy & Security.

Production macOS auto-updates require the application to be signed with a
consistent Developer ID identity. Ad-hoc builds remain manual-update fallbacks
and must not be treated as production auto-update packages.

## Failure Behavior

- A bootstrap failure prevents all later jobs.
- A test failure prevents all release builds.
- The automated suite contains at least 1,000 behavioral cases covering chat
  input, navigation, safety decisions, knowledge retrieval, update behavior,
  and browser contracts.
- A packaging failure does not cancel the other matrix builds.
- A packaged application that cannot launch and complete the first-run chat
  acceptance flow is not uploaded.
- Missing Apple credentials produce ad-hoc signed macOS packages without
  cancelling the other matrix builds.
- Invalid configured Apple credentials can still fail the affected macOS build.
- Signature, notarization, stapling, or Gatekeeper failures prevent upload.
- Failure of any platform prevents publication.
- Existing versioned releases remain available if a newer build or publication
  fails.

This preserves the previous downloadable release when build or test work fails.
