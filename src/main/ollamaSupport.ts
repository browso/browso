import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { logger } from "./Logger.ts";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_WAKE_DELAY_MS = 2_000;

let pendingWakePromise: Promise<boolean> | null = null;

export interface OllamaAvailabilityResult {
  baseUrl: string;
  available: boolean;
  wakeAttempted: boolean;
  wakeStarted: boolean;
  message: string;
}

export function normalizeOllamaBaseUrl(value: string | undefined): string {
  const trimmed = (value || DEFAULT_OLLAMA_BASE_URL).trim();
  const normalized = trimmed
    .replace(/\/(?:v1|api)\/?$/, "")
    .replace(/\/+$/, "");
  return normalized || DEFAULT_OLLAMA_BASE_URL;
}

export function buildOllamaUnavailableMessage(
  baseUrl: string,
  wakeAttempted: boolean,
  wakeStarted: boolean,
): string {
  const installHint =
    "Install Ollama on your machine and pull a model such as `ollama pull gemma4:e2b`.";

  if (wakeAttempted) {
    return `Ollama appears to be unavailable at ${baseUrl}. I tried to wake it up, but it is still not responding. ${installHint}`;
  }

  if (wakeStarted) {
    return `I tried to wake Ollama at ${baseUrl}, but it is still not responding. ${installHint}`;
  }

  return `Ollama appears to be unavailable at ${baseUrl}. ${installHint}`;
}

export function buildOllamaMissingModelMessage(model: string): string {
  const trimmed = model.trim();
  const modelLabel = trimmed || "the selected model";
  const installHint = trimmed
    ? `Run \`ollama pull ${trimmed}\` or choose an installed model in Settings.`
    : "Pull a model in Settings or choose an installed model.";

  return `Ollama is running, but ${modelLabel === "the selected model" ? "the selected model is" : `the model "${trimmed}" is`} not installed. ${installHint}`;
}

export async function ensureOllamaAvailable(
  baseUrl: string,
  options: { attemptWake?: boolean } = {},
): Promise<OllamaAvailabilityResult> {
  const normalizedBaseUrl = normalizeOllamaBaseUrl(baseUrl);
  const reachable = await probeOllama(normalizedBaseUrl);
  if (reachable) {
    return {
      baseUrl: normalizedBaseUrl,
      available: true,
      wakeAttempted: false,
      wakeStarted: false,
      message: "",
    };
  }

  let wakeAttempted = false;
  let wakeStarted = false;

  if (options.attemptWake !== false) {
    wakeAttempted = true;
    wakeStarted = await wakeOllama();
    if (wakeStarted) {
      await delay(OLLAMA_WAKE_DELAY_MS);
      if (await probeOllama(normalizedBaseUrl)) {
        return {
          baseUrl: normalizedBaseUrl,
          available: true,
          wakeAttempted,
          wakeStarted,
          message: "",
        };
      }
    }
  }

  return {
    baseUrl: normalizedBaseUrl,
    available: false,
    wakeAttempted,
    wakeStarted,
    message: buildOllamaUnavailableMessage(
      normalizedBaseUrl,
      wakeAttempted,
      wakeStarted,
    ),
  };
}

export async function wakeOllama(): Promise<boolean> {
  if (pendingWakePromise) {
    return pendingWakePromise;
  }

  pendingWakePromise = (async () => {
    const launchAttempts = buildLaunchAttempts();

    for (const attempt of launchAttempts) {
      if (await launchOllamaCommand(attempt.command, attempt.args)) {
        return true;
      }
    }

    logger.warn("Unable to launch Ollama automatically", {
      platform: process.platform,
      attempts: launchAttempts.map((attempt) => attempt.command),
    });
    return false;
  })();

  try {
    return await pendingWakePromise;
  } finally {
    pendingWakePromise = null;
  }
}

async function probeOllama(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_200);

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildLaunchAttempts(): Array<{ command: string; args: string[] }> {
  const attempts: Array<{ command: string; args: string[] }> = [
    {
      command: "ollama",
      args: ["serve"],
    },
  ];

  if (process.platform === "darwin") {
    attempts.unshift({
      command: "open",
      args: ["-a", "Ollama"],
    });
  }

  if (process.platform === "win32") {
    attempts.push({
      command: "powershell",
      args: ["-NoProfile", "-Command", "Start-Process", "Ollama"],
    });
  }

  return attempts;
}

async function launchOllamaCommand(
  command: string,
  args: string[],
): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

      child.once("spawn", () => {
        child.unref();
        resolve(true);
      });

      child.once("error", () => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}
