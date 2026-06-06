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
| Apple Silicon | `macos-15`       | `arm64`    | DMG        |
| Intel Mac     | `macos-15-intel` | `x64`      | DMG        |
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

The resulting workflow artifacts are:

```text
Browso-macOS-Apple-Silicon.dmg
Browso-macOS-Intel.dmg
Browso-Windows-x64-Setup.exe
Browso-Linux-x86_64.AppImage
```

## 4. Rolling Latest Release

The publish job downloads all platform artifacts, creates
`SHA256SUMS.txt`, removes the previous `latest` release and tag, and creates a
new release targeting the successful commit.

Release URL:

```text
https://github.com/Xaroq/browso/releases/tag/latest
```

The asset names remain fixed. A successful release replaces the previous
platform packages instead of accumulating versioned assets.

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

Apple Silicon DMG:

```bash
npm run build:mac:arm64
```

Intel DMG:

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
packages an unsigned, unnotarized DMG instead.

## Failure Behavior

- A bootstrap failure prevents all later jobs.
- A test failure prevents all release builds.
- A packaging failure does not cancel the other matrix builds.
- Missing Apple credentials produce unsigned macOS packages without cancelling
  the other matrix builds.
- Invalid configured Apple credentials can still fail the affected macOS build.
- Signature, notarization, stapling, or Gatekeeper failures prevent upload.
- Failure of any platform prevents publication.
- The previous `latest` release is deleted only after all packages have been
  downloaded and verified by the publish job.

This preserves the previous downloadable release when build or test work fails.
