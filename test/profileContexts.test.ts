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
    "profile-update",
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

test("browser profiles use separate persistent sessions and tab sets", () => {
  const tab = read("src/main/Tab.ts");
  const window = read("src/main/Window.ts");

  assert.match(tab, /persist:browso-profile-\$\{profileId\}/);
  assert.match(tab, /get profileId/);
  assert.match(window, /switchProfile\(profileId: string\)/);
  assert.match(window, /tab\.profileId === this\.activeProfileId/);
});

test("welcome page can hand a search draft to the AI sidebar", () => {
  const tab = read("src/main/Tab.ts");
  const window = read("src/main/Window.ts");
  const sidebar = read("src/main/SideBar.ts");
  const chat = read("src/renderer/sidebar/src/components/Chat.tsx");

  assert.match(tab, /BROWSO_AI_HASH_PREFIX/);
  assert.match(tab, /BROWSO_AI_REQUEST_URL/);
  assert.match(tab, /"will-navigate"/);
  assert.match(tab, /event\.preventDefault\(\)/);
  assert.match(window, /openAndRun\(message\)/);
  assert.match(sidebar, /openAndRun\(message: string\)/);
  assert.match(sidebar, /this\.llmClient\.sendChatMessage/);
  assert.match(sidebar, /openWithDraft\(message: string\)/);
  assert.match(sidebar, /"ai-draft-requested"/);
  assert.match(chat, /onAIDraftRequested/);
  assert.match(chat, /composerRef\.current\?\.focus/);
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
  assert.match(settings, /Configure active profile/);
  assert.match(settings, /profileColors/);
  assert.match(settings, /Every context has separate AI conversation/);
  assert.match(chat, /Manage profiles in Settings/);
  assert.doesNotMatch(chat, /aria-label="Active context"/);
});

test("first-run setup is wired through the browser startup flow", () => {
  const settings = read("src/main/AISettings.ts");
  const tab = read("src/main/Tab.ts");
  const welcomePage = read("src/main/WelcomePage.ts");

  assert.match(settings, /setupCompleted/);
  assert.match(settings, /markSetupCompleted/);
  assert.match(tab, /BROWSO_SETUP_COMPLETE_URL/);
  assert.match(tab, /completeFirstRunSetup/);
  assert.match(tab, /isSetupRequired\(\)/);
  assert.match(welcomePage, /First-time setup/);
  assert.match(welcomePage, /Agreement and setup terms/);
});

test("fresh AI settings default to Ollama", () => {
  const settings = read("src/main/AISettings.ts");

  assert.match(
    settings,
    /parseProvider\(process\.env\.LLM_PROVIDER\)\s*\?\?\s*"ollama"/,
  );
  assert.match(
    settings,
    /model: process\.env\.LLM_MODEL \|\| DEFAULTS\[provider\]\.model/,
  );
});
