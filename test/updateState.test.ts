import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUpdateSnapshot,
  compareVersions,
} from "../src/main/updateState.ts";

test("compareVersions handles semantic version ordering", () => {
  assert.equal(compareVersions("1.2.0", "1.1.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
});

test("buildUpdateSnapshot preserves dismissal for the same release but resets for a newer one", () => {
  const previousState = {
    checking: false,
    hasUpdate: true,
    dismissed: true,
    currentVersion: "1.0.0",
    latestVersion: "1.1.0",
    releaseUrl: "https://example.com/releases/1.1.0",
    releaseName: "v1.1.0",
    publishedAt: null,
    checkedAt: null,
    error: null,
  };

  const sameRelease = buildUpdateSnapshot(
    previousState,
    {
      tagName: "v1.1.0",
      name: "v1.1.0",
      htmlUrl: "https://example.com/releases/1.1.0",
    },
    "https://example.com/releases/latest",
    100,
  );
  const newerRelease = buildUpdateSnapshot(
    previousState,
    {
      tagName: "v1.2.0",
      name: "v1.2.0",
      htmlUrl: "https://example.com/releases/1.2.0",
    },
    "https://example.com/releases/latest",
    200,
  );

  assert.equal(sameRelease.dismissed, true);
  assert.equal(newerRelease.dismissed, false);
  assert.equal(newerRelease.latestVersion, "1.2.0");
});

test("buildUpdateSnapshot reads a version from a rolling latest release name", () => {
  const snapshot = buildUpdateSnapshot(
    {
      checking: true,
      hasUpdate: false,
      dismissed: false,
      currentVersion: "1.0.0",
      latestVersion: null,
      releaseUrl: null,
      releaseName: null,
      publishedAt: null,
      checkedAt: null,
      error: null,
    },
    {
      tagName: "latest",
      name: "Browso 1.1.0 Latest",
      htmlUrl: "https://example.com/releases/tag/latest",
    },
    "https://example.com/releases/tag/latest",
    300,
  );

  assert.equal(snapshot.latestVersion, "1.1.0");
  assert.equal(snapshot.hasUpdate, true);
});
