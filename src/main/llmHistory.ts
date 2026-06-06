import type { CoreMessage } from "ai";

const MAX_LIVE_MESSAGES = 12;
const MAX_RECENT_IMAGE_MESSAGES = 2;
const MAX_SUMMARY_LINES = 10;
const MAX_LINE_LENGTH = 180;

export interface ConversationWindowState {
  messages: CoreMessage[];
  archivedSummary: string | null;
}

export function compactConversationWindow(
  messages: CoreMessage[],
  archivedSummary: string | null,
): ConversationWindowState {
  const archivedMessages =
    messages.length > MAX_LIVE_MESSAGES
      ? messages.slice(0, messages.length - MAX_LIVE_MESSAGES)
      : [];
  const liveMessages =
    archivedMessages.length > 0
      ? messages.slice(messages.length - MAX_LIVE_MESSAGES)
      : messages.slice();

  const nextSummary =
    archivedMessages.length > 0
      ? summarizeArchivedMessages(archivedMessages, archivedSummary)
      : archivedSummary;

  return {
    messages: stripOlderImages(liveMessages),
    archivedSummary: nextSummary,
  };
}

export function summarizeArchivedMessages(
  messages: CoreMessage[],
  previousSummary: string | null,
): string {
  const lines = messages
    .map((message) => summarizeMessage(message))
    .filter((line) => line.length > 0);

  const combined = [
    previousSummary ? `Previous summary: ${previousSummary}` : null,
    ...lines,
  ].filter((line): line is string => Boolean(line));

  return combined
    .slice(-MAX_SUMMARY_LINES)
    .map((line) =>
      line.length > MAX_LINE_LENGTH
        ? `${line.slice(0, MAX_LINE_LENGTH)}...`
        : line,
    )
    .join("\n");
}

function summarizeMessage(message: CoreMessage): string {
  const prefix = message.role === "assistant" ? "Assistant" : "User";
  const text = extractMessageText(message);
  const hasImage = hasImagePart(message);

  if (!text && !hasImage) {
    return "";
  }

  if (hasImage && text) {
    return `${prefix}: [shared screenshot] ${text}`;
  }

  if (hasImage) {
    return `${prefix}: [shared screenshot]`;
  }

  return `${prefix}: ${text}`;
}

function stripOlderImages(messages: CoreMessage[]): CoreMessage[] {
  let imageMessagesLeft = MAX_RECENT_IMAGE_MESSAGES;

  return [...messages]
    .reverse()
    .map((message) => {
      if (!hasImagePart(message)) {
        return message;
      }

      if (imageMessagesLeft > 0) {
        imageMessagesLeft -= 1;
        return message;
      }

      return removeImageParts(message);
    })
    .reverse();
}

function removeImageParts(message: CoreMessage): CoreMessage {
  if (!Array.isArray(message.content)) {
    return message;
  }

  const content = message.content.filter((part) => {
    return !(
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "image"
    );
  });

  if (content.length === 1 && typeof content[0] === "string") {
    return { ...message, content: content[0] };
  }

  return { ...message, content } as CoreMessage;
}

function hasImagePart(message: CoreMessage): boolean {
  return (
    Array.isArray(message.content) &&
    message.content.some(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "image",
    )
  );
}

function extractMessageText(message: CoreMessage): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return [];
    })
    .join("\n")
    .trim();
}
