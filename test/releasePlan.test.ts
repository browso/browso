import test from "node:test";
import assert from "node:assert/strict";
import {
  nextReleaseVersion,
  normalizeStableVersion,
  parseReleaseType,
  releaseNotesFromSubjects,
} from "../scripts/release-plan.mjs";

test("release markers are explicit and case insensitive", () => {
  assert.equal(parseReleaseType("add search [release: minor]"), "minor");
  assert.equal(parseReleaseType("new architecture [RELEASE: MAJOR]"), "major");
  assert.equal(parseReleaseType("ship the minor version"), "minor");
  assert.equal(parseReleaseType("prepare major version"), "major");
  assert.equal(parseReleaseType("minor update: improve tabs"), "minor");
  assert.equal(parseReleaseType("major update: replace storage"), "major");
  assert.equal(parseReleaseType("ordinary fix"), null);
  assert.throws(
    () => parseReleaseType("[release: minor] [release: major]"),
    /cannot request both/,
  );
});

test("main branch commits default to minor while major markers override", () => {
  assert.equal(parseReleaseType("ordinary fix", "minor"), "minor");
  assert.equal(
    parseReleaseType("new architecture [release: major]", "minor"),
    "major",
  );
  assert.equal(parseReleaseType("manual validation"), null);
  assert.throws(
    () => parseReleaseType("ordinary fix", "patch"),
    /Unsupported default release type/,
  );
});

test("stable versions normalize to three numeric components", () => {
  assert.deepEqual(normalizeStableVersion("v1.2"), {
    major: 1,
    minor: 2,
    patch: 0,
  });
  assert.deepEqual(normalizeStableVersion("2.4.0"), {
    major: 2,
    minor: 4,
    patch: 0,
  });
  assert.equal(normalizeStableVersion("1.0.0-beta.1"), null);
});

test("minor and major releases reset the patch component", () => {
  assert.equal(nextReleaseVersion("1.0.0", "minor"), "1.1.0");
  assert.equal(nextReleaseVersion("1.9.4", "minor"), "1.10.0");
  assert.equal(nextReleaseVersion("1.9.4", "major"), "2.0.0");
});

test("website release notes omit release and merge bookkeeping", () => {
  assert.deepEqual(
    releaseNotesFromSubjects([
      "Improve tab recovery",
      "Merge pull request #12",
      "Ship it [release: minor]",
      "minor update: release bookkeeping",
      "Fix updater metadata",
    ]),
    ["Improve tab recovery", "Fix updater metadata"],
  );
});
