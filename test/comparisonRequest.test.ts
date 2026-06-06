import test from "node:test";
import assert from "node:assert/strict";
import { extractComparisonRequest } from "../src/main/comparisonRequest.ts";

test("extractComparisonRequest parses compare with phrasing", () => {
  assert.deepEqual(
    extractComparisonRequest("compare iPhone 16 with Galaxy S25"),
    {
      left: "iPhone 16",
      right: "Galaxy S25",
    },
  );
});

test("extractComparisonRequest parses versus phrasing", () => {
  assert.deepEqual(extractComparisonRequest("M3 MacBook Air vs XPS 13"), {
    left: "M3 MacBook Air",
    right: "XPS 13",
  });
});

test("extractComparisonRequest ignores single-subject comparison requests", () => {
  assert.equal(extractComparisonRequest("compare laptop prices"), null);
});
