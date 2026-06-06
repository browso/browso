import test from "node:test";
import assert from "node:assert/strict";
import { ipcSchemas } from "../src/main/ipcSchemas.ts";
import { assessAutomationGoal } from "../src/main/SafetyPolicy.ts";
import {
  rankKnowledgePages,
  type RankableKnowledgePage,
} from "../src/main/knowledgeRanking.ts";

const questionTopics = [
  "the main point of this article",
  "the pricing differences on this page",
  "the privacy policy",
  "the visible product specifications",
  "the installation instructions",
  "the release notes",
  "the API documentation",
  "the security recommendations",
  "the current page headings",
  "the selected paragraph",
  "the open source license",
  "the system requirements",
  "the refund policy",
  "the shipping information",
  "the benchmark results",
  "the code example",
  "the troubleshooting steps",
  "the accessibility statement",
  "the supported platforms",
  "the account permissions",
  "the data retention rules",
  "the feature comparison",
  "the download options",
  "the update procedure",
] as const;

const questionTemplates = [
  (topic: string) => `What is ${topic}?`,
  (topic: string) => `Explain ${topic}.`,
  (topic: string) => `Summarize ${topic}.`,
  (topic: string) => `Can you describe ${topic}?`,
  (topic: string) => `Tell me what matters about ${topic}.`,
  (topic: string) => `Help me understand ${topic}.`,
] as const;

for (const topic of questionTopics) {
  for (const [templateIndex, template] of questionTemplates.entries()) {
    const question = template(topic);
    test(`first-run chat accepts question ${JSON.stringify(question)}`, () => {
      const parsed = ipcSchemas.chatRequest.parse({
        message: question,
        messageId: `question-${questionTopics.indexOf(topic)}-${templateIndex}`,
      });
      assert.equal(parsed.message, question);
      assert.ok(parsed.messageId.startsWith("question-"));
    });
  }
}

const navigationHosts = [
  "example.com",
  "developer.mozilla.org",
  "github.com",
  "npmjs.com",
  "typescriptlang.org",
  "electronjs.org",
  "nodejs.org",
  "openai.com",
  "anthropic.com",
  "ollama.com",
  "wikipedia.org",
  "archive.org",
  "ietf.org",
  "w3.org",
  "kernel.org",
  "python.org",
  "rust-lang.org",
  "react.dev",
  "vite.dev",
  "ubuntu.com",
] as const;

const navigationPaths = [
  "/",
  "/docs",
  "/search?q=browso",
  "/releases/latest",
  "/guide/getting-started#install",
] as const;

for (const host of navigationHosts) {
  for (const path of navigationPaths) {
    const url = `https://${host}${path}`;
    test(`navigation accepts release-readiness URL ${url}`, () => {
      assert.equal(ipcSchemas.optionalNavigationTarget.parse(url), url);
    });
  }
}

const safeVerbs = [
  "summarize",
  "explain",
  "review",
  "inspect",
  "read",
  "list",
  "analyze",
  "describe",
  "compare",
  "find",
] as const;

const safeTargets = [
  "the visible release notes",
  "the installer requirements",
  "the download checksums",
  "the supported operating systems",
  "the application permissions",
  "the privacy documentation",
  "the current page content",
  "the troubleshooting guide",
  "the package formats",
  "the update instructions",
] as const;

for (const verb of safeVerbs) {
  for (const target of safeTargets) {
    const request = `${verb} ${target}`;
    test(`read-only first-run request stays allowed: ${request}`, () => {
      assert.deepEqual(assessAutomationGoal(request), {
        outcome: "allow",
        reason: null,
      });
    });
  }
}

const rankingTerms = [
  "installer",
  "download",
  "macos",
  "windows",
  "linux",
  "signature",
  "notarization",
  "checksum",
  "release",
  "version",
  "privacy",
  "security",
  "settings",
  "question",
  "browser",
  "copilot",
  "documentation",
  "update",
  "package",
  "application",
] as const;

const makePage = (
  id: string,
  overrides: Partial<RankableKnowledgePage>,
): RankableKnowledgePage => ({
  id,
  url: `https://example.com/${id}`,
  title: "Reference page",
  text: "",
  selection: "",
  note: "",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

for (const term of rankingTerms) {
  test(`knowledge search ranks an exact ${term} title first`, () => {
    const results = rankKnowledgePages(
      [
        makePage("body", { text: `Information about ${term}.` }),
        makePage("note", { note: `Important ${term} details.` }),
        makePage("title", { title: `Browso ${term}` }),
      ],
      term,
    );
    assert.equal(results[0]?.id, "title");
  });

  test(`knowledge search finds uppercase ${term} content`, () => {
    const results = rankKnowledgePages(
      [makePage("uppercase", { text: term.toUpperCase() })],
      term,
    );
    assert.equal(results[0]?.id, "uppercase");
  });

  test(`knowledge search returns a bounded ${term} excerpt`, () => {
    const results = rankKnowledgePages(
      [
        makePage("excerpt", {
          text: `${"context ".repeat(80)}${term} actionable details`,
        }),
      ],
      term,
    );
    assert.match(results[0]?.excerpt ?? "", new RegExp(term, "i"));
    assert.ok((results[0]?.excerpt.length ?? 0) <= 500);
  });
}
