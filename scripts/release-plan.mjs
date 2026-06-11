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

const RELEASE_NOTE_SECTION_ORDER = [
  "important",
  "fixes",
  "improvements",
  "maintenance",
];

const RELEASE_NOTE_SECTION_TITLES = {
  important: "Important changes",
  fixes: "Fixes",
  improvements: "Improvements",
  maintenance: "Maintenance",
};

const RELEASE_NOTE_IMPORTANT_PATTERNS = [
  /\bfirst[- ]run\b/i,
  /\bsetup\b/i,
  /\bonboarding\b/i,
  /\bagreement\b/i,
  /\bdefault\b/i,
  /\bollama\b/i,
  /\brelease notes?\b/i,
  /\bupdate presenter\b/i,
  /\bupdate prompt\b/i,
  /\bdownloaded update\b/i,
  /\brelease catalog\b/i,
  /\bwebsite\b/i,
  /\bpublish\b/i,
  /\bsync\b/i,
  /\binstaller?\b/i,
  /\bdownload\b/i,
  /\binstall\b/i,
  /\bsecurity\b/i,
  /\bmodel\b/i,
  /\bprovider\b/i,
];

const RELEASE_NOTE_FIX_PATTERNS = [
  /^(?:fix|bug|repair|restore|resolve|prevent|stabilize|stabilise|patch)\b/i,
  /\bfixed\b/i,
  /\bfix\b/i,
  /\bbug\b/i,
  /\berror\b/i,
  /\bfail(?:ed|ure|ing)?\b/i,
  /\bbroken\b/i,
  /\bwrong\b/i,
  /\bmissing\b/i,
  /\bstale\b/i,
  /\bcancel(?:led|ed)?\b/i,
];

const RELEASE_NOTE_IMPROVEMENT_PATTERNS = [
  /^(?:add|implement|improve|enhance|support|introduce|refine|streamline|simplify|expand|upgrade|polish|update)\b/i,
];

const RELEASE_NOTE_MAINTENANCE_PATTERNS = [
  /\bdeps?\b/i,
  /\bdependenc(?:y|ies)\b/i,
  /\bdependency\b/i,
  /\bci\b/i,
  /\btest\b/i,
  /\bbuild\b/i,
  /\bdoc(?:s|umentation)?\b/i,
  /\bchore\b/i,
  /\bcleanup\b/i,
  /\blint\b/i,
  /\bformat(?:ting)?\b/i,
  /\bworkflow\b/i,
];

const RELEASE_NOTE_HEADLINE_REPLACEMENTS = new Map([
  ["ai", "AI"],
  ["api", "API"],
  ["ci", "CI"],
  ["css", "CSS"],
  ["dmg", "DMG"],
  ["deps", "Dependencies"],
  ["github", "GitHub"],
  ["html", "HTML"],
  ["huggingface", "Hugging Face"],
  ["js", "JS"],
  ["json", "JSON"],
  ["llm", "LLM"],
  ["macos", "macOS"],
  ["nsis", "NSIS"],
  ["ollama", "Ollama"],
  ["openai", "OpenAI"],
  ["ts", "TS"],
  ["typescript", "TypeScript"],
  ["ui", "UI"],
  ["wf", "WF"],
]);

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
  return buildReleaseNotes(subjects).notes;
}

export function buildReleaseNotes(subjects) {
  const sections = Object.fromEntries(
    RELEASE_NOTE_SECTION_ORDER.map((key) => [key, []]),
  );
  const seen = new Set();

  for (const subject of subjects) {
    const note = normalizeReleaseNoteSubject(subject);
    if (!note) continue;

    const dedupeKey = note.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const section = classifyReleaseNote(note);
    sections[section].push(note);
  }

  if (
    RELEASE_NOTE_SECTION_ORDER.every(
      (section) => sections[section].length === 0,
    )
  ) {
    sections.maintenance.push("Maintenance and reliability improvements.");
  }

  const sectionList = RELEASE_NOTE_SECTION_ORDER.map((section) => ({
    title: RELEASE_NOTE_SECTION_TITLES[section],
    items: sections[section],
  })).filter((section) => section.items.length > 0);

  const notes = sectionList.flatMap((section) => section.items);
  const notesSummary =
    "The most important user-facing changes are listed first.";

  return {
    notesSummary,
    notesSections: sectionList,
    notes,
    notesMarkdown: renderReleaseNotesMarkdown(notesSummary, sectionList),
  };
}

function normalizeReleaseNoteSubject(subject) {
  if (/^merge\b/i.test(subject)) return null;
  if (
    /(?:\[release:\s*(?:major|minor)\]|\b(?:major|minor) (?:version|update)\b)/i.test(
      subject,
    )
  ) {
    return null;
  }

  const cleaned = subject
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(?:-|\*|\d+\.)\s+/, "")
    .replace(/\[(?:release:\s*(?:major|minor))\]/gi, "")
    .replace(
      /\b(?:fixes?|closes?|refs?)?:?\s*#\d+(?:\s*(?:,|and)\s*#\d+)*/gi,
      "",
    )
    .replace(/\s*\(#\d+\)/g, "")
    .replace(/\s*[-:;,]+$/g, "")
    .trim();

  if (!cleaned) return null;

  return toHeadlineCase(cleaned);
}

function classifyReleaseNote(note) {
  if (RELEASE_NOTE_IMPORTANT_PATTERNS.some((pattern) => pattern.test(note))) {
    return "important";
  }

  if (RELEASE_NOTE_FIX_PATTERNS.some((pattern) => pattern.test(note))) {
    return "fixes";
  }

  if (RELEASE_NOTE_IMPROVEMENT_PATTERNS.some((pattern) => pattern.test(note))) {
    return "improvements";
  }

  if (RELEASE_NOTE_MAINTENANCE_PATTERNS.some((pattern) => pattern.test(note))) {
    return "maintenance";
  }

  return "improvements";
}

function renderReleaseNotesMarkdown(summary, sections) {
  const lines = [summary, ""];

  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function toHeadlineCase(value) {
  return value.replace(/\b[A-Za-z0-9][A-Za-z0-9'._-]*\b/g, (word) => {
    const replacement = RELEASE_NOTE_HEADLINE_REPLACEMENTS.get(
      word.toLowerCase(),
    );
    if (replacement) {
      return replacement;
    }

    if (/^[A-Z0-9._-]+$/.test(word)) {
      return word;
    }

    return word
      .split("-")
      .map(
        (segment) =>
          segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
      )
      .join("-");
  });
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
        notesSections: [],
        notesSummary: null,
        notesMarkdown: "",
      })}\n`,
    );
    return;
  }

  const version = nextReleaseVersion(currentVersion, releaseType);
  const range = notesTag ? `${notesTag}..HEAD` : "HEAD";
  const subjects = git("log", range, "--pretty=%s").split("\n");
  const releaseNotes = buildReleaseNotes(subjects);

  process.stdout.write(
    `${JSON.stringify({
      shouldRelease: true,
      releaseType,
      currentVersion,
      previousTag: latestTag,
      version,
      tag: `v${version}`,
      notes: releaseNotes.notes,
      notesSections: releaseNotes.notesSections,
      notesSummary: releaseNotes.notesSummary,
      notesMarkdown: releaseNotes.notesMarkdown,
    })}\n`,
  );
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
