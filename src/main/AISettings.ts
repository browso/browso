import electron from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  LEGACY_BLUEBERRY_WELCOME_URL,
  BROWSO_WELCOME_URL,
} from "./WelcomePage.ts";
import { normalizeHomepage } from "./navigationPolicy.ts";

export type LLMProvider = "ollama" | "openai" | "anthropic";
export type SearchEngine = "google" | "duckduckgo" | "bing";

export interface AISettings {
  provider: LLMProvider;
  model: string;
  ollamaBaseUrl: string;
  homepage: string;
  searchEngine: SearchEngine;
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
  memoryEnabled: boolean;
  historyAccessEnabled: boolean;
}

const DEFAULTS: Record<LLMProvider, { model: string }> = {
  ollama: { model: "gemma4:e2b" },
  openai: { model: "gpt-4o-mini" },
  anthropic: { model: "claude-3-5-sonnet-20241022" },
};

const LEGACY_GOOGLE_HOMEPAGE = "https://www.google.com";
const LEGACY_DEFAULT_SEARCH_ENGINE: SearchEngine = "google";
const LEGACY_OLLAMA_DEFAULT_MODEL = "llama3.1:8b";
const DEFAULT_HOMEPAGE = BROWSO_WELCOME_URL;
const DEFAULT_SEARCH_ENGINE: SearchEngine = "duckduckgo";
const DEFAULT_SIDEBAR_WIDTH = 400;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MEMORY_ENABLED = true;
const DEFAULT_HISTORY_ACCESS_ENABLED = true;
const { app } = electron;

export class AISettingsStore {
  private static instance: AISettingsStore | null = null;
  private readonly filePath: string;
  private settings: AISettings;

  private constructor() {
    this.filePath = join(app.getPath("userData"), "ai-settings.json");
    this.settings = this.load();
  }

  static getInstance(): AISettingsStore {
    if (!AISettingsStore.instance) {
      AISettingsStore.instance = new AISettingsStore();
    }
    return AISettingsStore.instance;
  }

  getSettings(): AISettings {
    return { ...this.settings };
  }

  updateSettings(input: Partial<AISettings>): AISettings {
    const nextProvider = input.provider ?? this.settings.provider;
    const nextModelInput = typeof input.model === "string" ? input.model : null;
    const nextModel =
      nextModelInput !== null
        ? nextModelInput.trim()
        : this.settings.model || DEFAULTS[nextProvider].model;

    this.settings = {
      provider: nextProvider,
      model: nextModel,
      ollamaBaseUrl: this.normalizeOllamaBaseUrl(
        input.ollamaBaseUrl ??
          this.settings.ollamaBaseUrl ??
          DEFAULT_OLLAMA_BASE_URL,
      ),
      homepage: normalizeHomepage(
        input.homepage,
        normalizeHomepage(this.settings.homepage, DEFAULT_HOMEPAGE),
      ),
      searchEngine:
        input.searchEngine ??
        this.settings.searchEngine ??
        DEFAULT_SEARCH_ENGINE,
      autoRouteToSandbox:
        input.autoRouteToSandbox ?? this.settings.autoRouteToSandbox ?? true,
      sidebarWidth: this.parseSidebarWidth(
        input.sidebarWidth ??
          this.settings.sidebarWidth ??
          DEFAULT_SIDEBAR_WIDTH,
      ),
      memoryEnabled:
        input.memoryEnabled ??
        this.settings.memoryEnabled ??
        DEFAULT_MEMORY_ENABLED,
      historyAccessEnabled:
        input.historyAccessEnabled ??
        this.settings.historyAccessEnabled ??
        DEFAULT_HISTORY_ACCESS_ENABLED,
    };

    if (input.provider && !input.model) {
      this.settings.model = DEFAULTS[input.provider].model;
    }

    this.persist();
    return this.getSettings();
  }

  private load(): AISettings {
    const fallback = this.buildDefaults();

    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      const parsedProvider =
        this.parseProvider(parsed.provider) ?? fallback.provider;
      const parsedSearchEngine =
        this.parseSearchEngine(parsed.searchEngine) ?? fallback.searchEngine;
      const parsedHomepage = normalizeHomepage(
        parsed.homepage,
        fallback.homepage,
      );
      const parsedModel = parsed.model?.trim() || "";
      const shouldMigrateLegacyDefaults =
        parsedHomepage === LEGACY_GOOGLE_HOMEPAGE &&
        parsedSearchEngine === LEGACY_DEFAULT_SEARCH_ENGINE;
      const shouldMigrateLegacyBrand =
        parsedHomepage === LEGACY_BLUEBERRY_WELCOME_URL;
      const shouldMigrateLegacyOllamaModel =
        parsedProvider === "ollama" &&
        (parsedModel.length === 0 ||
          parsedModel === LEGACY_OLLAMA_DEFAULT_MODEL);

      return {
        provider: parsedProvider,
        model: shouldMigrateLegacyOllamaModel
          ? DEFAULTS.ollama.model
          : parsedModel || fallback.model,
        ollamaBaseUrl: this.normalizeOllamaBaseUrl(
          parsed.ollamaBaseUrl ?? fallback.ollamaBaseUrl,
        ),
        homepage:
          shouldMigrateLegacyDefaults || shouldMigrateLegacyBrand
            ? DEFAULT_HOMEPAGE
            : parsedHomepage,
        searchEngine: shouldMigrateLegacyDefaults
          ? DEFAULT_SEARCH_ENGINE
          : parsedSearchEngine,
        autoRouteToSandbox:
          typeof parsed.autoRouteToSandbox === "boolean"
            ? parsed.autoRouteToSandbox
            : fallback.autoRouteToSandbox,
        sidebarWidth: this.parseSidebarWidth(
          parsed.sidebarWidth ?? fallback.sidebarWidth,
        ),
        memoryEnabled:
          typeof parsed.memoryEnabled === "boolean"
            ? parsed.memoryEnabled
            : fallback.memoryEnabled,
        historyAccessEnabled:
          typeof parsed.historyAccessEnabled === "boolean"
            ? parsed.historyAccessEnabled
            : fallback.historyAccessEnabled,
      };
    } catch {
      return fallback;
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify(this.settings, null, 2),
      "utf8",
    );
  }

  private buildDefaults(): AISettings {
    const provider = this.parseProvider(process.env.LLM_PROVIDER) ?? "ollama";

    return {
      provider,
      model: process.env.LLM_MODEL || DEFAULTS[provider].model,
      ollamaBaseUrl: this.normalizeOllamaBaseUrl(
        process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
      ),
      homepage: normalizeHomepage(
        process.env.BROWSER_HOMEPAGE,
        DEFAULT_HOMEPAGE,
      ),
      searchEngine:
        this.parseSearchEngine(process.env.BROWSER_SEARCH_ENGINE) ??
        DEFAULT_SEARCH_ENGINE,
      autoRouteToSandbox: true,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      memoryEnabled: DEFAULT_MEMORY_ENABLED,
      historyAccessEnabled: DEFAULT_HISTORY_ACCESS_ENABLED,
    };
  }

  private parseProvider(value: string | undefined): LLMProvider | null {
    if (value === "openai" || value === "anthropic" || value === "ollama") {
      return value;
    }
    return null;
  }

  private parseSearchEngine(value: string | undefined): SearchEngine | null {
    if (value === "google" || value === "duckduckgo" || value === "bing") {
      return value;
    }
    return null;
  }

  private parseSidebarWidth(value: number): number {
    return Math.max(320, Math.min(720, Math.round(value)));
  }

  private normalizeOllamaBaseUrl(value: string): string {
    const trimmed = value.trim();
    const normalized = trimmed.replace(/\/(?:v1|api)\/?$/, "");
    return normalized || DEFAULT_OLLAMA_BASE_URL;
  }
}
