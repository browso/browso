import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("profile and context IPC channels have settings preload handlers", () => {
  const eventManager = read("src/main/EventManager.ts");
  const preload = read("src/preload/settings.ts");

  for (const channel of [
    "profiles-contexts-get",
    "profile-create",
    "profile-delete",
    "profile-switch",
    "context-create",
    "context-delete",
    "context-switch",
  ]) {
    assert.match(eventManager, new RegExp(`handle\\("${channel}"`), channel);
    assert.match(preload, new RegExp(`invoke\\("${channel}"`), channel);
  }
});

test("memory and knowledge persist data by active context", () => {
  const memoryStore = read("src/main/MemoryStore.ts");
  const knowledgeStore = read("src/main/KnowledgeStore.ts");

  for (const source of [memoryStore, knowledgeStore]) {
    assert.match(source, /version: 2/);
    assert.match(source, /getActiveContextId/);
    assert.match(source, /contexts:/);
    assert.match(source, /deleteContext/);
  }
});

test("AI conversations switch by context and context purpose enters prompts", () => {
  const source = read("src/main/LLMClient.ts");

  assert.match(source, /conversations = new Map/);
  assert.match(source, /switchContext\(contextId: string\)/);
  assert.match(source, /Active profile:/);
  assert.match(source, /Active context:/);
  assert.match(source, /Context purpose:/);
  assert.match(source, /isBusy\(\): boolean/);
});

test("settings and AI panel expose profile context controls", () => {
  const settings = read("src/renderer/settings/src/SettingsApp.tsx");
  const chat = read("src/renderer/sidebar/src/components/Chat.tsx");

  assert.match(settings, /label: "Profiles"/);
  assert.match(settings, /Add Profile/);
  assert.match(settings, /Add Context/);
  assert.match(settings, /Every context has separate AI conversation/);
  assert.match(chat, /aria-label="Active context"/);
});
