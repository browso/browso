import test from "node:test";
import assert from "node:assert/strict";
import type { CoreMessage } from "ai";
import { compactConversationWindow } from "../src/main/llmHistory.ts";

test("compactConversationWindow archives older messages and strips older screenshots", () => {
  const messages: CoreMessage[] = Array.from({ length: 14 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content:
      index % 2 === 0
        ? [
            { type: "image", image: `data:image/png;base64,${index}` },
            { type: "text", text: `message ${index}` },
          ]
        : `reply ${index}`,
  }));

  const result = compactConversationWindow(messages, null);

  assert.equal(result.messages.length, 12);
  assert.ok(result.archivedSummary?.includes("message 0"));
  const imageMessages = result.messages.filter(
    (message) =>
      Array.isArray(message.content) &&
      message.content.some(
        (part) =>
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          part.type === "image",
      ),
  );
  assert.equal(imageMessages.length, 2);
});
