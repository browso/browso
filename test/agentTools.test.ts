import test from "node:test";
import assert from "node:assert/strict";
import { buildProductMatchPattern } from "../src/main/AgentTools.ts";

test("product matcher does not match arbitrary text for an empty query", () => {
  const pattern = buildProductMatchPattern();

  assert.equal(pattern.test("Privacy"), false);
  assert.equal(pattern.test("Sign in"), false);
  assert.equal(pattern.test("Help"), false);
  assert.equal(pattern.test("View product"), true);
});

test("product matcher escapes user query text", () => {
  const pattern = buildProductMatchPattern("Nike Pegasus (Men's)");

  assert.equal(pattern.test("Nike Pegasus (Men's) - Blue"), true);
  assert.equal(pattern.test("Nike Pegasus Men's - Blue"), false);
});
