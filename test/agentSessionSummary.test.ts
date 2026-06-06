import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFallbackAgentReport,
  buildProgressSummary,
} from "../src/main/agentSessionSummary.ts";
import { SHOPPING_AGENT_PROMPT } from "../src/main/AgentTools.ts";

test("buildProgressSummary highlights latest completed result and current url", () => {
  const summary = buildProgressSummary(
    "find the pricing page",
    [
      {
        label: "inspectPage",
        status: "completed",
        result: "Found Pricing, Docs, and Contact links in the header.",
      },
      {
        label: "openMatchingLink: pricing",
        status: "completed",
        result: "Opened https://example.com/pricing",
      },
    ],
    "https://example.com/pricing",
  );

  assert.match(summary, /Completed 2 steps/);
  assert.match(summary, /example\.com\/pricing/);
  assert.match(summary, /Opened https:\/\/example\.com\/pricing/);
});

test("buildFallbackAgentReport includes recent concrete progress", () => {
  const report = buildFallbackAgentReport(
    "compare plans",
    "https://example.com/pricing",
    [
      {
        label: "inspectPage",
        status: "completed",
        result: "Pricing page shows Free, Pro, and Team plans.",
      },
      {
        label: "findOnPage: team",
        status: "completed",
        result: "Matched Team plan with priority support and admin controls.",
      },
    ],
  );

  assert.match(report, /Goal: compare plans/);
  assert.match(report, /Current page: https:\/\/example\.com\/pricing/);
  assert.match(report, /What I accomplished:/);
  assert.match(report, /priority support/);
});

test("agent prompt emphasizes recovery tools for general tasks", () => {
  assert.match(SHOPPING_AGENT_PROMPT, /not limited to shopping/i);
  assert.match(SHOPPING_AGENT_PROMPT, /findOnPage/);
  assert.match(SHOPPING_AGENT_PROMPT, /typeIntoBestField/);
  assert.match(SHOPPING_AGENT_PROMPT, /goBack, reloadPage/);
});
