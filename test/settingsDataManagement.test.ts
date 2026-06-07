import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

test("settings data actions have matching preload and main-process channels", () => {
  const preload = read("src/preload/settings.ts");
  const eventManager = read("src/main/EventManager.ts");

  for (const channel of [
    "settings-clear-chat-history",
    "settings-clear-site-data",
    "settings-clear-cache",
    "knowledge-clear",
  ]) {
    assert.match(preload, new RegExp(`invoke\\("${channel}"`), channel);
    assert.match(eventManager, new RegExp(`handle\\("${channel}"`), channel);
  }
});

test("site data and cache are cleared through Electron session APIs", () => {
  const source = read("src/main/EventManager.ts");

  assert.match(source, /activeTab\?\.webContents\.session/);
  assert.match(source, /activeSession\.clearStorageData/);
  assert.match(source, /activeSession\.clearCache/);
  assert.match(source, /"cookies"/);
  assert.match(source, /"localstorage"/);
});

test("settings exposes memory and local data management controls", () => {
  const source = read("src/renderer/settings/src/SettingsApp.tsx");

  for (const label of [
    'label: "Memory"',
    'label: "Data"',
    "Clear Conversation",
    "Saved pages",
    "Clear Cache",
    "Clear Site Data",
    "Saved of 100 maximum",
  ]) {
    assert.match(source, new RegExp(label), label);
  }
});
