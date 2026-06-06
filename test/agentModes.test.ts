import test from "node:test";
import assert from "node:assert/strict";
import { AgentModeRegistry } from "../src/main/AgentModes.ts";

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
