/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildWelcomePageHtml } from "../src/main/WelcomePage.ts";

const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const workdir = mkdtempSync(join(tmpdir(), "browso-welcome-smoke-"));
const pagePath = join(workdir, "welcome.html");
const port = 9236;
const html = buildWelcomePageHtml("duckduckgo").replace(
  "location.href = requestUrl;",
  "window.__requestUrl = requestUrl;",
);

writeFileSync(pagePath, html);

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(workdir, "chrome-profile")}`,
    pathToFileURL(pagePath).toString(),
  ],
  { stdio: "ignore" },
);

const waitForTarget = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then(
        (response) => response.json(),
      );
      const target = targets.find((entry) => entry.type === "page");
      if (target) return target;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome debugging target did not start.");
};

const target = await waitForTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
  return result.result.value;
};

try {
  await evaluate(`
    (() => {
      const input = document.getElementById("search-input");
      input.value = "quantum computing";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    })()
  `);
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowDown",
    code: "ArrowDown",
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowDown",
    code: "ArrowDown",
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
  });
  await new Promise((resolve) => setTimeout(resolve, 50));

  const state = await evaluate(`({
    disabled: document.getElementById("search-input").disabled,
    cardVisible: document.getElementById("sent-card").classList.contains("visible"),
    label: document.getElementById("sent-label").textContent,
    prompt: document.getElementById("sent-prompt").textContent,
    requestUrl: window.__requestUrl
  })`);

  if (
    !state.disabled ||
    !state.cardVisible ||
    state.label !== "Explain sent to Browso AI" ||
    !state.prompt.startsWith('Explain "quantum computing"') ||
    !state.requestUrl.includes("action=Explain")
  ) {
    throw new Error(
      `Unexpected welcome interaction state: ${JSON.stringify(state)}`,
    );
  }

  console.log(JSON.stringify(state, null, 2));
} finally {
  socket.close();
  chrome.kill("SIGTERM");
  rmSync(workdir, { recursive: true, force: true });
}
