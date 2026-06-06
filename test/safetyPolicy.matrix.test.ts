import test from "node:test";
import assert from "node:assert/strict";
import { assessAutomationGoal } from "../src/main/SafetyPolicy.ts";

const blockedVerbs = ["bypass", "solve"] as const;
const captchaArticles = ["", "a ", "the "] as const;
const captchaForms = ["captcha", "CAPTCHA", "Captcha"] as const;

for (const verb of blockedVerbs) {
  for (const article of captchaArticles) {
    for (const captcha of captchaForms) {
      const phrase = `${verb} ${article}${captcha} and continue`;
      test(`safety blocks CAPTCHA request: ${phrase}`, () => {
        const decision = assessAutomationGoal(phrase);
        assert.equal(decision.outcome, "block");
        assert.match(decision.reason, /CAPTCHA/i);
      });
    }
  }
}

const theftVerbs = ["phish", "steal", "harvest"] as const;
const secrets = [
  "password",
  "passwords",
  "credential",
  "credentials",
  "token",
  "tokens",
] as const;

for (const verb of theftVerbs) {
  for (const secret of secrets) {
    const phrase = `${verb} customer ${secret} from this website`;
    test(`safety blocks credential abuse: ${phrase}`, () => {
      assert.equal(assessAutomationGoal(phrase).outcome, "block");
    });
  }
}

const blockedActions = [
  "send spam to every contact",
  "create a mass message campaign",
  "send a mass email",
  "exploit the server",
  "compromise this account",
  "hack into the admin panel",
] as const;

for (const phrase of blockedActions) {
  test(`safety blocks prohibited action: ${phrase}`, () => {
    assert.equal(assessAutomationGoal(phrase).outcome, "block");
  });
}

const submitVerbs = ["submit", "send"] as const;
const submitObjects = ["form", "email", "message", "application"] as const;
for (const verb of submitVerbs) {
  for (const object of submitObjects) {
    const phrase = `${verb} this ${object} now`;
    test(`safety requires confirmation: ${phrase}`, () => {
      assert.equal(assessAutomationGoal(phrase).outcome, "confirm");
    });
  }
}

const purchaseActions = [
  "buy this laptop",
  "purchase the subscription",
  "place order",
  "place the order",
  "pay the invoice",
  "continue to checkout",
] as const;
for (const phrase of purchaseActions) {
  test(`safety requires purchase handoff: ${phrase}`, () => {
    assert.equal(assessAutomationGoal(phrase).outcome, "confirm");
  });
}

const authenticationActions = [
  "log in to the portal",
  "login to the portal",
  "sign in to the portal",
  "signin to the portal",
  "enter my password",
  "complete two-factor authentication",
  "enter the 2fa code",
] as const;
for (const phrase of authenticationActions) {
  test(`safety requires authentication handoff: ${phrase}`, () => {
    assert.equal(assessAutomationGoal(phrase).outcome, "confirm");
  });
}

const destructiveVerbs = ["delete", "remove"] as const;
const destructiveObjects = ["account", "file", "data", "message"] as const;
for (const verb of destructiveVerbs) {
  for (const object of destructiveObjects) {
    const phrase = `${verb} the old ${object}`;
    test(`safety requires destructive confirmation: ${phrase}`, () => {
      assert.equal(assessAutomationGoal(phrase).outcome, "confirm");
    });
  }
}

const sideEffects = [
  "download the archive",
  "book a hotel",
  "reserve a table",
  "apply for this role",
] as const;
for (const phrase of sideEffects) {
  test(`safety requires side-effect confirmation: ${phrase}`, () => {
    assert.equal(assessAutomationGoal(phrase).outcome, "confirm");
  });
}

const safeVerbs = [
  "summarize",
  "compare",
  "explain",
  "review",
  "inspect",
  "read",
  "find",
  "list",
  "analyze",
  "describe",
] as const;
const safeObjects = [
  "the visible specifications",
  "these open tabs",
  "the privacy policy",
  "the article",
  "the product prices",
  "the documentation",
  "the page headings",
  "the saved notes",
] as const;

for (const verb of safeVerbs) {
  for (const object of safeObjects) {
    const phrase = `${verb} ${object}`;
    test(`safety allows read-only request: ${phrase}`, () => {
      assert.deepEqual(assessAutomationGoal(phrase), {
        outcome: "allow",
        reason: null,
      });
    });
  }
}
