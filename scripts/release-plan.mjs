#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const RELEASE_MARKERS = {
  major: /(?:\[release:\s*major\]|\bmajor (?:version|update)\b)/i,
  minor: /(?:\[release:\s*minor\]|\bminor (?:version|update)\b)/i,
};

export function parseReleaseType(message, defaultType = null) {
  const matches = Object.entries(RELEASE_MARKERS)
    .filter(([, pattern]) => pattern.test(message))
    .map(([type]) => type);

  if (matches.length > 1) {
    throw new Error("A commit cannot request both a major and minor release.");
  }

  if (defaultType !== null && !Object.hasOwn(RELEASE_MARKERS, defaultType)) {
    throw new Error(`Unsupported default release type: ${defaultType}`);
  }

  return matches[0] ?? defaultType;
}

export function normalizeStableVersion(version) {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version.trim());
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
  };
}

export function nextReleaseVersion(currentVersion, releaseType) {
  const current = normalizeStableVersion(currentVersion);
  if (!current) {
    throw new Error(`Invalid stable version: ${currentVersion}`);
  }

  if (releaseType === "major") {
    return `${current.major + 1}.0.0`;
  }

  if (releaseType === "minor") {
    return `${current.major}.${current.minor + 1}.0`;
  }

  throw new Error(`Unsupported release type: ${releaseType}`);
}

export function releaseNotesFromSubjects(subjects) {
  const notes = subjects
    .map((subject) => subject.trim())
    .filter(Boolean)
    .filter((subject) => !/^merge\b/i.test(subject))
    .filter(
      (subject) =>
        !/(?:\[release:\s*(?:major|minor)\]|\b(?:major|minor) (?:version|update)\b)/i.test(
          subject,
        ),
    );

  return notes.length > 0
    ? notes
    : ["Maintenance and reliability improvements."];
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getLatestStableTag() {
  const tags = git("tag", "--list", "v[0-9]*", "--sort=-v:refname")
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.find((tag) => normalizeStableVersion(tag)) ?? null;
}

function getLatestVersionTag() {
  return (
    git("tag", "--list", "v[0-9]*", "--sort=-version:refname")
      .split("\n")
      .map((tag) => tag.trim())
      .find(Boolean) ?? null
  );
}

function main() {
  const message =
    process.env.RELEASE_COMMIT_MESSAGE ?? git("log", "-1", "--pretty=%B");
  const defaultReleaseType =
    process.env.DEFAULT_RELEASE_TYPE &&
    process.env.DEFAULT_RELEASE_TYPE !== "none"
      ? process.env.DEFAULT_RELEASE_TYPE
      : null;
  const releaseType = parseReleaseType(message, defaultReleaseType);
  const packageVersion = JSON.parse(
    readFileSync("package.json", "utf8"),
  ).version;
  const latestTag = getLatestStableTag();
  const notesTag = latestTag ?? getLatestVersionTag();
  const currentVersion = latestTag ?? packageVersion;

  if (!releaseType) {
    process.stdout.write(
      `${JSON.stringify({
        shouldRelease: false,
        releaseType: null,
        currentVersion,
        previousTag: latestTag,
        version: null,
        tag: null,
        notes: [],
      })}\n`,
    );
    return;
  }

  const version = nextReleaseVersion(currentVersion, releaseType);
  const range = notesTag ? `${notesTag}..HEAD` : "HEAD";
  const subjects = git("log", range, "--pretty=%s").split("\n");

  process.stdout.write(
    `${JSON.stringify({
      shouldRelease: true,
      releaseType,
      currentVersion,
      previousTag: latestTag,
      version,
      tag: `v${version}`,
      notes: releaseNotesFromSubjects(subjects),
    })}\n`,
  );
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
