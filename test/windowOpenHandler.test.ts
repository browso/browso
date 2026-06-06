import test from "node:test";
import assert from "node:assert/strict";
import { attachExternalWindowOpenHandler } from "../src/main/windowOpenHandler.ts";

test("attachExternalWindowOpenHandler denies new windows and opens externally", async () => {
  let registeredHandler:
    | ((details: { url: string }) => { action: "deny" })
    | null = null;
  const openedUrls: string[] = [];

  attachExternalWindowOpenHandler(
    {
      setWindowOpenHandler: (handler) => {
        registeredHandler = handler;
      },
    },
    async (url) => {
      openedUrls.push(url);
    },
  );

  assert.ok(registeredHandler);
  assert.deepEqual(registeredHandler({ url: "https://example.com" }), {
    action: "deny",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(openedUrls, ["https://example.com"]);
});

test("attachExternalWindowOpenHandler denies unsafe external protocols", async () => {
  let registeredHandler:
    | ((details: { url: string }) => { action: "deny" })
    | null = null;
  const openedUrls: string[] = [];

  attachExternalWindowOpenHandler(
    {
      setWindowOpenHandler: (handler) => {
        registeredHandler = handler;
      },
    },
    async (url) => {
      openedUrls.push(url);
    },
  );

  assert.ok(registeredHandler);
  for (const url of [
    "file:///tmp/secret.txt",
    "javascript:alert(1)",
    "data:text/html,unsafe",
  ]) {
    assert.deepEqual(registeredHandler({ url }), { action: "deny" });
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(openedUrls, []);
});
