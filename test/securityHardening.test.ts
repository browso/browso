import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("page extraction scripts are expressions, not top-level returns", () => {
  const source = read("src/main/Tab.ts");

  assert.doesNotMatch(
    source,
    /runJs\(["'`]return document\.documentElement/,
  );
  assert.match(source, /document\.documentElement\?\.outerHTML/);
});

test("preloads expose only narrow renderer bridges", () => {
  for (const path of [
    "src/preload/topbar.ts",
    "src/preload/sidebar.ts",
    "src/preload/settings.ts",
  ]) {
    const source = read(path);
    assert.doesNotMatch(
      source,
      /exposeInMainWorld\(["']browso["']/,
      path,
    );
    assert.doesNotMatch(source, /window\.browso\s*=/, path);
  }
});

test("all local renderer documents define a restrictive CSP", () => {
  for (const path of [
    "src/renderer/topbar/index.html",
    "src/renderer/sidebar/index.html",
    "src/renderer/settings/index.html",
  ]) {
    const html = read(path);
    assert.match(html, /Content-Security-Policy/, path);
    assert.match(html, /object-src 'none'/, path);
    assert.match(html, /base-uri 'none'/, path);
  }
});

test("local runner does not inherit the parent environment", () => {
  const source = read("src/main/SandboxManager.ts");

  assert.doesNotMatch(source, /\.\.\.process\.env/);
  assert.match(source, /ELECTRON_RUN_AS_NODE:\s*"1"/);
  assert.match(source, /assertUniqueFileName/);
});
