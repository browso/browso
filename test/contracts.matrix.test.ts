import test from "node:test";
import assert from "node:assert/strict";
import { AgentModeRegistry } from "../src/main/AgentModes.ts";
import { ipcSchemas } from "../src/main/ipcSchemas.ts";
import {
  LEGACY_BLUEBERRY_WELCOME_URL,
  BROWSO_WELCOME_URL,
  buildWelcomePageHtml,
  isWelcomeUrl,
} from "../src/main/WelcomePage.ts";

const modeIds = [
  "copilot",
  "research",
  "shopping",
  "scraper",
  "developer",
  "security",
] as const;

for (const modeId of modeIds) {
  test(`mode ${modeId} returns a detached tools array`, () => {
    const first = AgentModeRegistry.get(modeId);
    const listed = AgentModeRegistry.list().find((mode) => mode.id === modeId);
    assert.ok(listed);
    listed.tools.push("mutation");
    assert.doesNotMatch(
      AgentModeRegistry.get(modeId).tools.join(","),
      /mutation/,
    );
    assert.equal(first.id, modeId);
  });

  test(`mode ${modeId} returns detached instruction array`, () => {
    const listed = AgentModeRegistry.list().find((mode) => mode.id === modeId);
    assert.ok(listed);
    listed.systemInstructions.push("mutation");
    assert.doesNotMatch(
      AgentModeRegistry.get(modeId).systemInstructions.join(","),
      /mutation/,
    );
  });

  test(`settings schema accepts mode ${modeId}`, () => {
    assert.equal(
      ipcSchemas.settingsPatch.parse({ activeAgentMode: modeId })
        .activeAgentMode,
      modeId,
    );
  });
}

const invalidModes = [
  "",
  "Copilot",
  "RESEARCH",
  "admin",
  "offensive",
  "shopping ",
  1,
  null,
  undefined,
  {},
] as const;
for (const mode of invalidModes) {
  test(`mode validation rejects ${JSON.stringify(mode)}`, () => {
    assert.equal(AgentModeRegistry.isModeId(mode), false);
  });
}

const navigationUrls = [
  BROWSO_WELCOME_URL,
  LEGACY_BLUEBERRY_WELCOME_URL,
  "https://example.com",
  "http://localhost:3000",
] as const;
for (const url of navigationUrls) {
  test(`navigation schema accepts ${url}`, () => {
    assert.equal(ipcSchemas.optionalNavigationTarget.parse(url), url);
  });
}

const invalidNavigation = [
  "",
  " ",
  "example.com",
  "not a url",
  "javascript:alert(1)",
  "file:///tmp/example.txt",
  "data:text/html,<script>alert(1)</script>",
  "about:blank",
  "mailto:test@example.com",
  "devtools://devtools/bundled/inspector.html",
  42,
  null,
  {},
  [],
] as const;
for (const value of invalidNavigation) {
  test(`navigation schema rejects ${JSON.stringify(value)}`, () => {
    assert.throws(() => ipcSchemas.optionalNavigationTarget.parse(value));
  });
}

for (const width of [320, 321, 400, 500, 600, 719, 720]) {
  test(`sidebar width accepts ${width}`, () => {
    assert.equal(ipcSchemas.sidebarWidth.parse(width), width);
  });
}

for (const width of [-1, 0, 319, 320.5, 721, 1000, "400", null]) {
  test(`sidebar width rejects ${JSON.stringify(width)}`, () => {
    assert.throws(() => ipcSchemas.sidebarWidth.parse(width));
  });
}

for (const name of ["Work", "Personal", "A".repeat(80)]) {
  test(`profile schema accepts ${name.length}-character name`, () => {
    assert.equal(ipcSchemas.profileCreate.parse({ name }).name, name);
  });
}

for (const name of ["", " ", "A".repeat(81), null, 42]) {
  test(`profile schema rejects name ${JSON.stringify(name)}`, () => {
    assert.throws(() => ipcSchemas.profileCreate.parse({ name }));
  });
}

test("context schema accepts a bounded description", () => {
  const parsed = ipcSchemas.contextCreate.parse({
    profileId: "profile-work",
    name: "Research",
    description: "Competitive research for the current project.",
  });
  assert.equal(parsed.name, "Research");
});

for (const description of ["A".repeat(501), null, 42]) {
  test(`context schema rejects description ${JSON.stringify(description)}`, () => {
    assert.throws(() =>
      ipcSchemas.contextCreate.parse({
        profileId: "profile-work",
        name: "Research",
        description,
      }),
    );
  });
}

for (const provider of ["ollama", "openai", "anthropic"] as const) {
  test(`settings schema accepts provider ${provider}`, () => {
    assert.equal(
      ipcSchemas.settingsPatch.parse({ provider }).provider,
      provider,
    );
  });
}

for (const engine of ["google", "duckduckgo", "bing"] as const) {
  test(`settings schema accepts search engine ${engine}`, () => {
    assert.equal(
      ipcSchemas.settingsPatch.parse({ searchEngine: engine }).searchEngine,
      engine,
    );
  });
}

for (const engine of ["yahoo", "Google", "", 1, null]) {
  test(`settings schema rejects search engine ${JSON.stringify(engine)}`, () => {
    assert.throws(() =>
      ipcSchemas.settingsPatch.parse({ searchEngine: engine }),
    );
  });
}

for (const length of [1, 2, 10, 100, 1_000, 9_999, 10_000]) {
  test(`chat schema accepts message length ${length}`, () => {
    const parsed = ipcSchemas.chatRequest.parse({
      message: "x".repeat(length),
      messageId: `id-${length}`,
    });
    assert.equal(parsed.message.length, length);
  });
}

for (const length of [0, 10_001, 20_000]) {
  test(`chat schema rejects message length ${length}`, () => {
    assert.throws(() =>
      ipcSchemas.chatRequest.parse({
        message: "x".repeat(length),
        messageId: "id",
      }),
    );
  });
}

for (const engine of ["google", "duckduckgo", "bing"] as const) {
  test(`welcome HTML renders Browso and ${engine}`, () => {
    const html = buildWelcomePageHtml(engine);
    assert.match(html, /<title>Browso<\/title>/);
    assert.match(html, /Browso/);
    assert.match(
      html,
      new RegExp(
        engine === "duckduckgo"
          ? "DuckDuckGo"
          : engine[0].toUpperCase() + engine.slice(1),
      ),
    );
    assert.doesNotMatch(html, /Blueberry Browser/i);
  });
}

for (const url of [BROWSO_WELCOME_URL, LEGACY_BLUEBERRY_WELCOME_URL]) {
  test(`isWelcomeUrl accepts compatible URL ${url}`, () => {
    assert.equal(isWelcomeUrl(url), true);
  });
}

for (const url of [
  "",
  "https://example.com",
  "browso://settings",
  "blueberry://settings",
  "Browso://welcome",
]) {
  test(`isWelcomeUrl rejects ${JSON.stringify(url)}`, () => {
    assert.equal(isWelcomeUrl(url), false);
  });
}
