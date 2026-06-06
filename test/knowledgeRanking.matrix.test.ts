import test from "node:test";
import assert from "node:assert/strict";
import {
  rankKnowledgePages,
  type RankableKnowledgePage,
} from "../src/main/knowledgeRanking.ts";

const makePage = (
  id: string,
  overrides: Partial<RankableKnowledgePage> = {},
): RankableKnowledgePage => ({
  id,
  url: `https://example.com/${id}`,
  title: "Untitled page",
  text: "",
  selection: "",
  note: "",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const terms = [
  "browso",
  "browser",
  "agent",
  "memory",
  "research",
  "shopping",
  "security",
  "scraper",
  "typescript",
  "ollama",
] as const;

for (const term of terms) {
  test(`ranking weights title above all other fields for ${term}`, () => {
    const results = rankKnowledgePages(
      [
        makePage("body", { text: term }),
        makePage("url", { url: `https://${term}.example.com` }),
        makePage("note", { note: term }),
        makePage("title", { title: term }),
      ],
      term,
    );
    assert.deepEqual(
      results.map((result) => result.id),
      ["title", "note", "url", "body"],
    );
  });

  test(`ranking is case-insensitive for ${term}`, () => {
    const results = rankKnowledgePages(
      [makePage("match", { title: term.toUpperCase() })],
      term.toLowerCase(),
    );
    assert.equal(results[0]?.id, "match");
  });

  test(`ranking includes a useful excerpt for ${term}`, () => {
    const prefix = "x".repeat(180);
    const results = rankKnowledgePages(
      [makePage("excerpt", { text: `${prefix} ${term} useful context` })],
      term,
    );
    assert.match(results[0]?.excerpt ?? "", new RegExp(term, "i"));
    assert.ok((results[0]?.excerpt.length ?? 0) <= 500);
  });
}

for (let count = 1; count <= 20; count += 1) {
  test(`ranking caps body occurrence contribution at five for count=${count}`, () => {
    const repeated = Array.from({ length: count }, () => "agent").join(" ");
    const [result] = rankKnowledgePages(
      [makePage("body", { text: repeated })],
      "agent",
    );
    assert.equal(result.score, Math.min(count, 5));
  });
}

for (let updatedAt = 1; updatedAt <= 20; updatedAt += 1) {
  test(`ranking uses updatedAt tie-breaker for timestamp=${updatedAt}`, () => {
    const results = rankKnowledgePages(
      [
        makePage("older", { title: "agent", updatedAt: updatedAt - 1 }),
        makePage("newer", { title: "agent", updatedAt }),
      ],
      "agent",
    );
    assert.equal(results[0]?.id, "newer");
  });
}

const emptyQueries = ["", " ", "a", "an", "to", "--", "...", "1"] as const;
for (const query of emptyQueries) {
  test(`ranking returns no results for tokenless query ${JSON.stringify(query)}`, () => {
    assert.deepEqual(
      rankKnowledgePages([makePage("page", { title: "anything" })], query),
      [],
    );
  });
}
