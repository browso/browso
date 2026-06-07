import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("packaged application uses electron-updater install flow", () => {
  const source = read("src/main/UpdateManager.ts");

  assert.match(source, /from "electron-updater"/);
  assert.match(source, /downloadUpdate\(\)/);
  assert.match(source, /quitAndInstall\(false, true\)/);
  assert.match(source, /autoDownload = false/);
});

test("builder emits architecture-specific update metadata", () => {
  const config = read("browso-builder.yml");

  assert.match(config, /provider: github/);
  assert.match(config, /owner: Browso/);
  assert.match(config, /repo: browso/);
  assert.match(config, /- zip/);
  assert.match(config, /browso-\$\{version\}-mac-\$\{arch\}/);
  assert.match(config, /browso-\$\{version\}-win-\$\{arch\}/);
});

test("release workflow publishes versioned updater artifacts", () => {
  const workflow = read(".github/workflows/ci-release.yml");

  assert.match(workflow, /RELEASE_TAG=v\$version/);
  assert.match(workflow, /mac-arm64-mac\.yml/);
  assert.match(workflow, /win-x64\.yml/);
  assert.match(workflow, /linux-x64-linux\.yml/);
  assert.match(workflow, /Release \$RELEASE_TAG already exists/);
  assert.doesNotMatch(workflow, /gh release upload/);
  assert.doesNotMatch(workflow, /--clobber/);
  assert.doesNotMatch(workflow, /gh release edit/);
  assert.doesNotMatch(workflow, /gh release delete/);
});
