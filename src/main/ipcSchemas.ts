import { z } from "zod";

const providerSchema = z.enum(["ollama", "openai", "anthropic"]);
const searchEngineSchema = z.enum(["google", "duckduckgo", "bing"]);
const agentModeSchema = z.enum([
  "copilot",
  "research",
  "shopping",
  "scraper",
  "developer",
  "security",
]);

const navigationTargetSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    if (value === "browso://welcome" || value === "blueberry://welcome") {
      return true;
    }

    try {
      // Allow standard browser-accepted URLs only.
      const url = new URL(value);
      return url.protocol.length > 0;
    } catch {
      return false;
    }
  }, "Invalid URL");

export const ipcSchemas = {
  optionalNavigationTarget: navigationTargetSchema.optional(),
  tabId: z.string().trim().min(1),
  navigation: z.object({
    tabId: z.string().trim().min(1),
    url: navigationTargetSchema,
  }),
  sidebarWidth: z.number().int().min(320).max(720),
  chatRequest: z.object({
    message: z.string().trim().min(1).max(10_000),
    messageId: z.string().trim().min(1).max(256),
  }),
  knowledgeSaveRequest: z
    .object({
      note: z.string().trim().max(10_000).optional(),
    })
    .optional(),
  knowledgeSearchRequest: z.object({
    query: z.string().trim().min(1).max(2_000),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  computerUseRequest: z.object({
    goal: z.string().trim().min(1).max(4_000),
  }),
  sandboxFileInput: z.object({
    name: z.string().trim().min(1).max(255),
    content: z.string().max(200_000).optional(),
  }),
  sandboxFilePatch: z
    .object({
      name: z.string().trim().min(1).max(255).optional(),
      content: z.string().max(200_000).optional(),
      isScoped: z.boolean().optional(),
    })
    .refine(
      (value) => Object.keys(value).length > 0,
      "Patch must not be empty",
    ),
  sandboxRunRequest: z
    .object({
      entryFileId: z.string().trim().min(1).nullable().optional(),
    })
    .optional(),
  settingsPatch: z
    .object({
      provider: providerSchema.optional(),
      model: z.string().trim().min(1).max(200).optional(),
      ollamaBaseUrl: z.string().trim().min(1).max(500).optional(),
      homepage: navigationTargetSchema.optional(),
      searchEngine: searchEngineSchema.optional(),
      autoRouteToSandbox: z.boolean().optional(),
      sidebarWidth: z.number().int().min(320).max(720).optional(),
      memoryEnabled: z.boolean().optional(),
      activeAgentMode: agentModeSchema.optional(),
    })
    .strict(),
};

export function parseIpcInput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  return schema.parse(value, {
    errorMap: (issue, context) => ({
      message: `${label}: ${issue.message || context.defaultError}`,
    }),
  });
}
