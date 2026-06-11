import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildHuggingFaceInferenceErrorMessage,
  buildHuggingFaceUnavailableMessage,
  normalizeHuggingFaceBaseUrl,
} from "../src/main/huggingFaceSupport.ts";

const read = (path: string): string => readFileSync(path, "utf8");

test("Hugging Face URLs normalize and failures include actionable guidance", () => {
  assert.equal(
    normalizeHuggingFaceBaseUrl("https://browso-browso-agent.hf.space/v1/"),
    "https://browso-browso-agent.hf.space",
  );
  assert.match(
    buildHuggingFaceUnavailableMessage(
      "https://browso-browso-agent.hf.space",
      "starting",
    ),
    /starting or rebuilding/,
  );
  assert.match(
    buildHuggingFaceUnavailableMessage(
      "https://browso-browso-agent.hf.space",
      "unauthorized",
    ),
    /HF_TOKEN/,
  );
  assert.match(
    buildHuggingFaceInferenceErrorMessage(
      "https://browso-browso-agent.hf.space",
    ),
    /Runtime logs/,
  );
});

test("chat and computer use preflight the Hugging Face Space", () => {
  const llmClient = read("src/main/LLMClient.ts");
  const computerUse = read("src/main/ComputerUseManager.ts");

  assert.match(llmClient, /ensureHuggingFaceAvailable/);
  assert.match(llmClient, /Hugging Face Space is unavailable for chat/);
  assert.match(llmClient, /provider\.chat\(settings\.model\)/);
  assert.match(computerUse, /getModelProviderAvailability/);
  assert.match(computerUse, /buildHuggingFaceInferenceErrorMessage/);
  assert.match(computerUse, /provider\.chat\(settings\.model\)/);
});
