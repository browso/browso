import { z } from "zod";
import { isAllowedNavigationTarget } from "./navigationPolicy.ts";

const providerSchema = z.enum(["huggingface", "ollama", "openai", "anthropic"]);
const searchEngineSchema = z.enum(["google", "duckduckgo", "bing"]);
const navigationTargetSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isAllowedNavigationTarget, "Unsupported navigation URL");
const profileContextIdSchema = z.string().trim().min(1).max(256);
const profileContextNameSchema = z.string().trim().min(1).max(80);
const profileIconSchema = z.enum([
  "person",
  "briefcase",
  "graduation",
  "globe",
]);
const profileColorSchema = z.enum([
  "blue",
  "purple",
  "green",
  "orange",
  "red",
  "gray",
]);

export const ipcSchemas = {
  settingsSection: z
    .enum(["general", "profiles", "ai", "workspace", "memory", "data"])
    .optional(),
  optionalNavigationTarget: navigationTargetSchema.optional(),
  tabId: z.string().trim().min(1),
  profileContextId: profileContextIdSchema,
  profileCreate: z.object({
    name: profileContextNameSchema,
    icon: profileIconSchema,
    color: profileColorSchema,
  }),
  profileRename: z.object({
    id: profileContextIdSchema,
    name: profileContextNameSchema,
  }),
  profileUpdate: z
    .object({
      id: profileContextIdSchema,
      name: profileContextNameSchema.optional(),
      icon: profileIconSchema.optional(),
      color: profileColorSchema.optional(),
    })
    .refine(
      (value) =>
        typeof value.name === "string" ||
        typeof value.icon === "string" ||
        typeof value.color === "string",
      "Profile update must not be empty",
    ),
  contextCreate: z.object({
    profileId: profileContextIdSchema,
    name: profileContextNameSchema,
    description: z.string().trim().max(500).optional(),
  }),
  contextUpdate: z
    .object({
      id: profileContextIdSchema,
      name: profileContextNameSchema.optional(),
      description: z.string().trim().max(500).optional(),
    })
    .refine(
      (value) =>
        typeof value.name === "string" || typeof value.description === "string",
      "Context update must not be empty",
    ),
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
      huggingFaceBaseUrl: z.string().url().max(500).optional(),
      homepage: navigationTargetSchema.optional(),
      searchEngine: searchEngineSchema.optional(),
      autoRouteToSandbox: z.boolean().optional(),
      sidebarWidth: z.number().int().min(320).max(720).optional(),
      memoryEnabled: z.boolean().optional(),
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
