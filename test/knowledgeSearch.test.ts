import test from "node:test";
import assert from "node:assert/strict";
import {
  rankKnowledgePages,
  type RankableKnowledgePage,
} from "../src/main/knowledgeRanking.ts";

const page = (
  id: string,
  title: string,
  text: string,
  note = "",
): RankableKnowledgePage => ({
  id,
  title,
  text,
  note,
  url: `https://example.com/${id}`,
  selection: "",
  createdAt: 1,
  updatedAt: 1,
});

test("knowledge search weights title and note matches above body matches", () => {
  const results = rankKnowledgePages(
    [
      page("body", "General database article", "Vector search with Qdrant"),
      page("title", "Qdrant vector database", "A short overview"),
      page("note", "Saved article", "A short overview", "Evaluate Qdrant"),
    ],
    "Qdrant",
  );

  assert.deepEqual(
    results.map((result) => result.id),
    ["title", "note", "body"],
  );
  assert.ok(results.every((result) => result.excerpt.length > 0));
});

test("knowledge search returns no results for unrelated terms", () => {
  const results = rankKnowledgePages(
    [page("one", "Browser agents", "Automation and memory")],
    "quantum chemistry",
  );

  assert.deepEqual(results, []);
});
