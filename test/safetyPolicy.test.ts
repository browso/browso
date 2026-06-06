import test from "node:test";
import assert from "node:assert/strict";
import { assessAutomationGoal } from "../src/main/SafetyPolicy.ts";

test("safety policy allows read-only browsing work", () => {
  assert.deepEqual(
    assessAutomationGoal("Compare the specifications across these open tabs"),
    { outcome: "allow", reason: null },
  );
});

test("safety policy requires handoff for consequential actions", () => {
  assert.equal(
    assessAutomationGoal("Buy this product and place the order").outcome,
    "confirm",
  );
  assert.equal(
    assessAutomationGoal("Log in and submit my application").outcome,
    "confirm",
  );
  assert.equal(
    assessAutomationGoal("Find and buy this product").outcome,
    "confirm",
  );
  assert.equal(
    assessAutomationGoal("Compare these flights and book one").outcome,
    "confirm",
  );
  assert.equal(
    assessAutomationGoal("Read this form and submit it").outcome,
    "confirm",
  );
});

test("safety policy blocks abusive automation", () => {
  assert.equal(
    assessAutomationGoal("Bypass the captcha and continue").outcome,
    "block",
  );
  assert.equal(
    assessAutomationGoal("Build a page to harvest credentials").outcome,
    "block",
  );
});
