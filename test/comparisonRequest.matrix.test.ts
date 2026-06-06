import test from "node:test";
import assert from "node:assert/strict";
import { extractComparisonRequest } from "../src/main/comparisonRequest.ts";

const leftSubjects = [
  "MacBook Air",
  "iPhone 16",
  "PostgreSQL",
  "React",
  "Ollama",
  "Plan A",
  "Source One",
  "Product Alpha",
] as const;
const rightSubjects = [
  "Dell XPS",
  "Galaxy S25",
  "SQLite",
  "Vue",
  "OpenAI",
  "Plan B",
  "Source Two",
  "Product Beta",
] as const;
const separators = ["with", "and", "to", "vs", "vs.", "versus"] as const;

for (let index = 0; index < leftSubjects.length; index += 1) {
  for (const separator of separators) {
    const left = leftSubjects[index];
    const right = rightSubjects[index];
    const phrase = `compare ${left} ${separator} ${right}`;
    test(`comparison parser handles: ${phrase}`, () => {
      assert.deepEqual(extractComparisonRequest(phrase), { left, right });
    });
  }
}

const politePrefixes = ["please ", "can you ", "could you "] as const;
const suffixes = ["", " for me", " side by side", "?", " please?"] as const;
for (const prefix of politePrefixes) {
  for (const suffix of suffixes) {
    const phrase = `${prefix}compare "Browso" with "Arc"${suffix}`;
    test(`comparison parser normalizes polite wrapper: ${phrase}`, () => {
      assert.deepEqual(extractComparisonRequest(phrase), {
        left: "Browso",
        right: "Arc",
      });
    });
  }
}

const directSeparators = ["vs", "vs.", "versus"] as const;
for (const separator of directSeparators) {
  for (let index = 0; index < leftSubjects.length; index += 1) {
    const left = leftSubjects[index];
    const right = rightSubjects[index];
    test(`comparison parser handles direct ${separator}: ${left}/${right}`, () => {
      assert.deepEqual(
        extractComparisonRequest(`${left} ${separator} ${right}`),
        { left, right },
      );
    });
  }
}

const invalidComparisons = [
  "",
  " ",
  "compare",
  "compare prices",
  "compare A",
  "A",
  "A vs A",
  "same versus same",
  "compare x with y",
  "compare a and b",
  "versus",
  "please compare",
  "compare with product",
  "compare product with",
  "?",
] as const;

for (const phrase of invalidComparisons) {
  test(`comparison parser rejects incomplete request: ${JSON.stringify(phrase)}`, () => {
    assert.equal(extractComparisonRequest(phrase), null);
  });
}
