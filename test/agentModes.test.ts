import test from "node:test";
import assert from "node:assert/strict";
import { AgentModeRegistry, routeAgentMode } from "../src/main/AgentModes.ts";

test("agent modes expose one stable definition per supported mode", () => {
  const modes = AgentModeRegistry.list();
  const ids = modes.map((mode) => mode.id);

  assert.deepEqual(ids, [
    "copilot",
    "research",
    "shopping",
    "scraper",
    "developer",
    "security",
  ]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(modes.every((mode) => mode.tools.length > 0));
  assert.ok(modes.every((mode) => mode.systemInstructions.length > 0));
});

test("agent mode validation rejects unknown mode ids", () => {
  assert.equal(AgentModeRegistry.isModeId("research"), true);
  assert.equal(AgentModeRegistry.isModeId("offensive-security"), false);
  assert.equal(AgentModeRegistry.isModeId(null), false);
});

test("backend routes requests to the appropriate mode", () => {
  assert.equal(routeAgentMode("Summarize this article"), "copilot");
  assert.equal(
    routeAgentMode("Research these claims and cite reliable sources"),
    "research",
  );
  assert.equal(
    routeAgentMode("Compare prices and return policies for this laptop"),
    "shopping",
  );
  assert.equal(
    routeAgentMode("Extract all rows from this table as JSON"),
    "scraper",
  );
  assert.equal(
    routeAgentMode("Read the TypeScript API documentation"),
    "developer",
  );
  assert.equal(
    routeAgentMode("Is this shopping site a phishing scam?"),
    "security",
  );
});
