import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("ollama recovery flow wakes, retries, and explains how to install", () => {
  const helper = read("src/main/ollamaSupport.ts");
  const eventManager = read("src/main/EventManager.ts");
  const llmClient = read("src/main/LLMClient.ts");
  const computerUse = read("src/main/ComputerUseManager.ts");
  const settings = read("src/renderer/settings/src/SettingsApp.tsx");

  assert.match(helper, /wakeOllama/);
  assert.match(helper, /Install Ollama on your machine and pull a model/);
  assert.match(helper, /ollama pull gemma4:e2b/);
  assert.match(eventManager, /ollama-models-list/);
  assert.match(eventManager, /ensureOllamaAvailable/);
  assert.match(llmClient, /ensureModelProviderReady/);
  assert.match(llmClient, /buildOllamaMissingModelMessage/);
  assert.match(computerUse, /getOllamaAvailability/);
  assert.match(computerUse, /buildOllamaUnavailableMessage/);
  assert.match(settings, /Try to wake Ollama/);
  assert.match(settings, /The selected model/);
});
