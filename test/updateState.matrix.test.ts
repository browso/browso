import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUpdateSnapshot,
  compareVersions,
  normalizeVersion,
  type UpdateSnapshot,
} from "../src/main/updateState.ts";

const versionTuples = [
  [0, 0, 0],
  [0, 1, 0],
  [0, 9, 9],
  [1, 0, 0],
  [1, 0, 1],
  [1, 1, 0],
  [1, 2, 3],
  [1, 9, 9],
  [2, 0, 0],
  [2, 4, 1],
  [3, 0, 0],
  [3, 10, 5],
  [10, 0, 0],
  [10, 20, 30],
] as const;

const tupleVersion = (tuple: readonly number[]): string => tuple.join(".");
const tupleCompare = (
  left: readonly number[],
  right: readonly number[],
): number => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
};

for (const left of versionTuples) {
  for (const right of versionTuples) {
    test(`compareVersions orders ${tupleVersion(left)} against ${tupleVersion(right)}`, () => {
      assert.equal(
        compareVersions(tupleVersion(left), tupleVersion(right)),
        tupleCompare(left, right),
      );
    });
  }
}

const validVersions = [
  "0.0",
  "0.0.0",
  "1.0",
  "1.0.0",
  "v1.0.0",
  "V2.3.4",
  " 3.4.5 ",
  "10.20.30",
  "1.2.3-beta",
  "v1.2.3-rc.1",
  "9.9.9-alpha.12",
] as const;

for (const value of validVersions) {
  test(`normalizeVersion accepts ${JSON.stringify(value)}`, () => {
    const normalized = normalizeVersion(value);
    assert.ok(normalized);
    assert.doesNotMatch(normalized, /^v/i);
    assert.match(normalized, /^\d+\.\d+(?:\.\d+)?/);
  });
}

const invalidVersions: Array<string | undefined> = [
  undefined,
  "",
  " ",
  "latest",
  "Browso Latest",
  "version 1.2.3",
  "1",
  "1.2.3.4",
  "v",
  "alpha",
  "1.x.0",
  "1.2.",
  ".1.2",
  "release-1.2.3",
];

for (const value of invalidVersions) {
  test(`normalizeVersion rejects ${JSON.stringify(value)}`, () => {
    assert.equal(normalizeVersion(value), null);
  });
}

const baseState = (): UpdateSnapshot => ({
  checking: true,
  hasUpdate: false,
  dismissed: false,
  currentVersion: "1.5.0",
  latestVersion: null,
  releaseUrl: null,
  releaseName: null,
  publishedAt: null,
  checkedAt: null,
  error: "old error",
});

const releaseCases = [
  { tagName: "v1.5.0", name: "Current", expected: false },
  { tagName: "v1.5.1", name: "Patch", expected: true },
  { tagName: "v1.6.0", name: "Minor", expected: true },
  { tagName: "v2.0.0", name: "Major", expected: true },
  { tagName: "v1.4.9", name: "Older", expected: false },
  { tagName: "latest", name: "Browso 1.5.1 Latest", expected: true },
  { tagName: "latest", name: "Browso 1.5.0 Latest", expected: false },
  { tagName: "latest", name: "Browso 1.4.9 Latest", expected: false },
  { tagName: "latest", name: "No semantic version", expected: false },
] as const;

for (const releaseCase of releaseCases) {
  test(`buildUpdateSnapshot update=${releaseCase.expected} for ${releaseCase.tagName}/${releaseCase.name}`, () => {
    const snapshot = buildUpdateSnapshot(
      baseState(),
      {
        tagName: releaseCase.tagName,
        name: releaseCase.name,
        htmlUrl: "https://example.com/release",
        publishedAt: "2026-06-06T12:00:00Z",
      },
      "https://example.com/latest",
      1234,
    );

    assert.equal(snapshot.hasUpdate, releaseCase.expected);
    assert.equal(snapshot.checking, false);
    assert.equal(snapshot.error, null);
    assert.equal(snapshot.checkedAt, 1234);
    assert.equal(snapshot.releaseUrl, "https://example.com/release");
    assert.equal(snapshot.publishedAt, "2026-06-06T12:00:00Z");
  });
}
