const DEFAULT_HUGGING_FACE_BASE_URL = "https://browso-browso-agent.hf.space";
const HUGGING_FACE_PROBE_TIMEOUT_MS = 8_000;

export type HuggingFaceAvailabilityStatus =
  | "available"
  | "starting"
  | "unauthorized"
  | "unavailable";

export interface HuggingFaceAvailabilityResult {
  baseUrl: string;
  available: boolean;
  status: HuggingFaceAvailabilityStatus;
  message: string;
}

export function normalizeHuggingFaceBaseUrl(value: string | undefined): string {
  const trimmed = (value || DEFAULT_HUGGING_FACE_BASE_URL).trim();
  const normalized = trimmed.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  return normalized || DEFAULT_HUGGING_FACE_BASE_URL;
}

export function buildHuggingFaceUnavailableMessage(
  baseUrl: string,
  status: Exclude<HuggingFaceAvailabilityStatus, "available">,
): string {
  if (status === "unauthorized") {
    return `The Hugging Face Space at ${baseUrl} requires authentication. Add a Hugging Face read token as HF_TOKEN in the Browso environment, then restart Browso.`;
  }

  if (status === "starting") {
    return `The Hugging Face Space at ${baseUrl} is starting or rebuilding. Wait a few minutes and try again. The Space owner can check Runtime logs in Hugging Face if it does not become ready.`;
  }

  return `The Hugging Face Space at ${baseUrl} is unavailable. Check your internet connection and the Space status, or switch to Ollama in Settings.`;
}

export function buildHuggingFaceInferenceErrorMessage(baseUrl: string): string {
  return `The Hugging Face Space at ${baseUrl} returned an inference error. Try again shortly or switch to Ollama in Settings. The Space owner should check the Hugging Face Runtime logs.`;
}

export async function ensureHuggingFaceAvailable(
  baseUrl: string,
): Promise<HuggingFaceAvailabilityResult> {
  const normalizedBaseUrl = normalizeHuggingFaceBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    HUGGING_FACE_PROBE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${normalizedBaseUrl}/health`, {
      headers: process.env.HF_TOKEN
        ? { Authorization: `Bearer ${process.env.HF_TOKEN}` }
        : undefined,
      signal: controller.signal,
    });

    if (response.ok) {
      const health = (await response.json().catch(() => null)) as {
        status?: unknown;
        modelReady?: unknown;
      } | null;
      if (health?.status === "ok" && health.modelReady !== false) {
        return {
          baseUrl: normalizedBaseUrl,
          available: true,
          status: "available",
          message: "",
        };
      }
    }

    const status =
      response.status === 401 || response.status === 403
        ? "unauthorized"
        : response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ? "starting"
          : "unavailable";

    return {
      baseUrl: normalizedBaseUrl,
      available: false,
      status,
      message: buildHuggingFaceUnavailableMessage(normalizedBaseUrl, status),
    };
  } catch {
    return {
      baseUrl: normalizedBaseUrl,
      available: false,
      status: "unavailable",
      message: buildHuggingFaceUnavailableMessage(
        normalizedBaseUrl,
        "unavailable",
      ),
    };
  } finally {
    clearTimeout(timeout);
  }
}
