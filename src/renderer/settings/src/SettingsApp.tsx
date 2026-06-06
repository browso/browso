import React, { useEffect, useState } from "react";
import { Button } from "@common/components/Button";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { cn } from "@common/lib/utils";
import {
  Bot,
  ChevronRight,
  Download,
  Globe,
  LayoutPanelLeft,
  MemoryStick,
  Moon,
  Search,
  Sun,
} from "lucide-react";

type AppSettings = Awaited<
  ReturnType<typeof window.settingsAPI.getAppSettings>
>;
type OllamaModelsResult = Awaited<
  ReturnType<typeof window.settingsAPI.listOllamaModels>
>;
type MemoryEntry = Awaited<
  ReturnType<typeof window.settingsAPI.getMemories>
>[number];
type UpdateState = Awaited<
  ReturnType<typeof window.settingsAPI.getUpdateState>
>;
type SettingsTab = "general" | "ai" | "workspace" | "memory";

type TabConfig = {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const tabs: TabConfig[] = [
  {
    id: "general",
    label: "General",
    icon: Globe,
  },
  {
    id: "ai",
    label: "AI",
    icon: Bot,
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: LayoutPanelLeft,
  },
  {
    id: "memory",
    label: "Memory",
    icon: MemoryStick,
  },
];

const cardClassName =
  "rounded-[24px] border border-border/70 bg-card/80 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:shadow-[0_18px_48px_rgba(0,0,0,0.22)]";

const MODEL_INPUT_COMMIT_DELAY_MS = 250;

export const SettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [ollamaState, setOllamaState] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: false, error: null });
  const { isDarkMode, setDarkMode } = useDarkMode();

  useEffect(() => {
    const removeAppSettingsListener = window.settingsAPI.onAppSettingsUpdated(
      (next) => setSettings(next),
    );
    const removeUpdateStateListener = window.settingsAPI.onUpdateStateChanged(
      (next) => setUpdateState(next),
    );

    const load = async (): Promise<void> => {
      const [next, savedMemories, nextUpdateState] = await Promise.all([
        window.settingsAPI.getAppSettings(),
        window.settingsAPI.getMemories(),
        window.settingsAPI.getUpdateState(),
      ]);
      setSettings(next);
      setMemories(savedMemories);
      setUpdateState(nextUpdateState);
    };

    void load();

    return () => {
      removeAppSettingsListener();
      removeUpdateStateListener();
    };
  }, []);

  const loadOllamaModels = async (): Promise<OllamaModelsResult> => {
    setOllamaState({ loading: true, error: null });
    const result = await window.settingsAPI.listOllamaModels();
    setOllamaModels(result.models);
    setOllamaState({
      loading: false,
      error: result.ok ? null : result.error,
    });
    return result;
  };

  const updateSettings = async (patch: Partial<AppSettings>): Promise<void> => {
    const next = await window.settingsAPI.updateAppSettings(patch);
    setSettings(next);

    if (typeof patch.sidebarWidth === "number") {
      await window.settingsAPI.setSidebarWidth(patch.sidebarWidth);
    }

    if ((patch.provider ?? next.provider) === "ollama") {
      void loadOllamaModels();
    }
  };

  useEffect(() => {
    if (settings?.provider === "ollama") {
      void loadOllamaModels();
    } else {
      setOllamaModels([]);
      setOllamaState({ loading: false, error: null });
    }
  }, [settings?.provider, settings?.ollamaBaseUrl]);

  useEffect(() => {
    if (!settings || !settings.model.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void window.settingsAPI.updateAppSettings({
        model: settings.model.trim(),
      });
    }, MODEL_INPUT_COMMIT_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [settings?.model]);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  const updateCheckedLabel = updateState?.checkedAt
    ? new Date(updateState.checkedAt).toLocaleString()
    : "Not checked yet";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header
        aria-hidden="true"
        className="app-region-drag h-10 shrink-0 border-b border-border/70"
      />

      <div className="app-region-no-drag flex min-h-0 flex-1 flex-col gap-5 p-5 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[320px]">
          <div className="rounded-[24px] border border-border bg-card p-3 shadow-sm">
            <div className="mb-3 px-3 pt-2">
              <p className="text-sm font-semibold text-foreground">
                Preferences
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Organize preferences by area instead of one long page.
              </p>
            </div>
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[16px] border px-3 py-3 text-left transition-colors",
                      isActive
                        ? "border-border bg-secondary text-foreground"
                        : "border-transparent bg-transparent text-foreground hover:border-border hover:bg-secondary/50",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-2xl border",
                        isActive
                          ? "border-border bg-background"
                          : "border-border/70 bg-background",
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 text-sm font-medium">
                      {tab.label}
                    </div>
                    <ChevronRight
                      className={cn(
                        "size-4 transition-transform",
                        isActive
                          ? "translate-x-0.5 text-foreground"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-4">
            {activeTab === "general" && (
              <>
                <section className={cardClassName}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                        <Download className="size-4 text-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          Updates
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Check GitHub releases and open the latest published
                          download page.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void window.settingsAPI
                          .checkForUpdates()
                          .then(setUpdateState)
                      }
                    >
                      Check Now
                    </Button>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-border bg-background/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {updateState?.hasUpdate
                            ? `Version ${updateState.latestVersion} is available`
                            : updateState?.error
                              ? "Update status unavailable"
                              : "You are on the latest known version"}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Current version:{" "}
                          {updateState?.currentVersion ?? "Unknown"}
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Last checked: {updateCheckedLabel}
                        </p>
                      </div>
                      {updateState?.hasUpdate && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              void window.settingsAPI
                                .dismissUpdate()
                                .then(setUpdateState)
                            }
                          >
                            Hide Prompt
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              void window.settingsAPI.openReleasePage()
                            }
                          >
                            Update Now
                          </Button>
                        </div>
                      )}
                    </div>
                    {updateState?.releaseName && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Latest release: {updateState.releaseName}
                      </p>
                    )}
                    {updateState?.publishedAt && (
                      <p className="text-xs text-muted-foreground">
                        Published:{" "}
                        {new Date(updateState.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                    {updateState?.error && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {updateState.error}
                      </p>
                    )}
                  </div>
                </section>

                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      {isDarkMode ? (
                        <Moon className="size-4 text-foreground" />
                      ) : (
                        <Sun className="size-4 text-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Appearance
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Pick the theme used by the browser chrome and settings
                        window.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDarkMode(false)}
                      className={cn(
                        "rounded-[22px] border p-4 text-left transition-all",
                        !isDarkMode
                          ? "border-foreground bg-foreground text-background shadow-[0_10px_28px_rgba(15,23,42,0.18)] dark:bg-white dark:text-zinc-950"
                          : "border-border bg-background/85 text-foreground hover:border-foreground/25",
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sun className="size-4" />
                        Light
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-xs leading-5",
                          !isDarkMode
                            ? "text-background/70 dark:text-zinc-700"
                            : "text-muted-foreground",
                        )}
                      >
                        Bright surfaces and classic macOS-style contrast.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDarkMode(true)}
                      className={cn(
                        "rounded-[22px] border p-4 text-left transition-all",
                        isDarkMode
                          ? "border-foreground bg-foreground text-background shadow-[0_10px_28px_rgba(15,23,42,0.18)] dark:bg-white dark:text-zinc-950"
                          : "border-border bg-background/85 text-foreground hover:border-foreground/25",
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Moon className="size-4" />
                        Dark
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-xs leading-5",
                          isDarkMode
                            ? "text-background/70 dark:text-zinc-700"
                            : "text-muted-foreground",
                        )}
                      >
                        Lower-glare interface for focused browsing and tool use.
                      </p>
                    </button>
                  </div>
                </section>

                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      <Globe className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Startup
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Choose where a new tab starts when the browser opens a
                        page.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Homepage / New Tab URL
                    </label>
                    <input
                      value={settings.homepage}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          homepage: event.target.value,
                        })
                      }
                      onBlur={(event) =>
                        void updateSettings({ homepage: event.target.value })
                      }
                      className="w-full rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-foreground/30"
                    />
                  </div>
                </section>

                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      <Search className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Search
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Set the search engine used when the address bar input is
                        not a URL.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Default Search Engine
                    </label>
                    <select
                      value={settings.searchEngine}
                      onChange={(event) =>
                        void updateSettings({
                          searchEngine: event.target
                            .value as AppSettings["searchEngine"],
                        })
                      }
                      className="w-full rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-foreground/30"
                    >
                      <option value="google">Google</option>
                      <option value="duckduckgo">DuckDuckGo</option>
                      <option value="bing">Bing</option>
                    </select>
                  </div>
                </section>
              </>
            )}

            {activeTab === "ai" && (
              <>
                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      <Bot className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Provider
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Choose which model backend powers the AI workspace.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Provider
                    </label>
                    <select
                      value={settings.provider}
                      onChange={(event) =>
                        void updateSettings({
                          provider: event.target
                            .value as AppSettings["provider"],
                        })
                      }
                      className="w-full rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-foreground/30"
                    >
                      <option value="ollama">Ollama (Local)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>
                </section>

                {settings.provider === "ollama" ? (
                  <>
                    <section className={cardClassName}>
                      <h3 className="text-sm font-semibold text-foreground">
                        Local server
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Connect the browser to your Ollama instance.
                      </p>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-medium text-muted-foreground">
                          Ollama Base URL
                        </label>
                        <input
                          value={settings.ollamaBaseUrl}
                          onChange={(event) =>
                            setSettings({
                              ...settings,
                              ollamaBaseUrl: event.target.value,
                            })
                          }
                          onBlur={(event) =>
                            void updateSettings({
                              ollamaBaseUrl: event.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-foreground/30"
                          placeholder="http://127.0.0.1:11434"
                        />
                      </div>
                    </section>

                    <section className={cardClassName}>
                      <h3 className="text-sm font-semibold text-foreground">
                        Model
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Pick from installed local models exposed by Ollama.
                      </p>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs font-medium text-muted-foreground">
                          Installed Models
                        </label>
                        <select
                          value={settings.model}
                          onChange={(event) =>
                            void updateSettings({ model: event.target.value })
                          }
                          className="w-full rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-foreground/30"
                        >
                          <option value="">
                            {ollamaState.loading
                              ? "Loading Ollama models..."
                              : ollamaState.error
                                ? "Ollama offline"
                                : ollamaModels.length > 0
                                  ? "Choose model"
                                  : "No models found"}
                          </option>
                          {ollamaModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                        {ollamaState.error && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {ollamaState.error}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Run{" "}
                          <code className="rounded bg-secondary px-1 py-0.5">
                            ollama list
                          </code>{" "}
                          to confirm the model is installed locally.
                        </p>
                      </div>
                    </section>
                  </>
                ) : (
                  <section className={cardClassName}>
                    <h3 className="text-sm font-semibold text-foreground">
                      Remote model
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Set the exact model name used for requests.
                    </p>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-medium text-muted-foreground">
                        Model
                      </label>
                      <input
                        value={settings.model}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            model: event.target.value,
                          })
                        }
                        className="w-full rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-foreground/30"
                        placeholder={
                          settings.provider === "openai"
                            ? "gpt-4o-mini"
                            : "claude-3-5-sonnet-20241022"
                        }
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {settings.provider === "openai"
                          ? "Requires OPENAI_API_KEY in the .env file."
                          : "Requires ANTHROPIC_API_KEY in the .env file."}
                      </p>
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === "workspace" && (
              <>
                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      <LayoutPanelLeft className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Sidebar
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Control how much space the AI and tools panel uses.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Sidebar Width
                    </label>
                    <input
                      type="range"
                      min={320}
                      max={720}
                      value={settings.sidebarWidth}
                      onChange={(event) => {
                        const width = Number(event.target.value);
                        setSettings({ ...settings, sidebarWidth: width });
                        void updateSettings({ sidebarWidth: width });
                      }}
                      className="w-full"
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Compact</span>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground">
                        {settings.sidebarWidth}px
                      </span>
                      <span>Wide</span>
                    </div>
                  </div>
                </section>

                <section className={cardClassName}>
                  <h3 className="text-sm font-semibold text-foreground">
                    Routing
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Decide whether code-heavy tasks should move into the local
                    runner automatically.
                  </p>

                  <label className="mt-4 flex items-start gap-3 rounded-[22px] border border-border bg-background/70 p-4 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={settings.autoRouteToSandbox}
                      onChange={(event) =>
                        void updateSettings({
                          autoRouteToSandbox: event.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      Automatically switch to the local runner for code, file,
                      and data tasks
                    </span>
                  </label>
                </section>
              </>
            )}

            {activeTab === "memory" && (
              <>
                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      <MemoryStick className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Memory
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Distilled preferences and instructions are stored here,
                        not full chat logs.
                      </p>
                    </div>
                  </div>

                  <label className="mt-4 flex items-start gap-3 rounded-[22px] border border-border bg-background/70 p-4 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={settings.memoryEnabled}
                      onChange={(event) =>
                        void updateSettings({
                          memoryEnabled: event.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <span>
                      Enable persistent memory for future conversations and
                      tasks
                    </span>
                  </label>
                </section>

                <section className={cardClassName}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Saved memories
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Review what the browser remembers. You can delete items
                        or clear everything.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void window.settingsAPI
                          .clearMemories()
                          .then(setMemories)
                      }
                      disabled={memories.length === 0}
                    >
                      Clear All
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {memories.length > 0 ? (
                      memories.map((memory) => (
                        <div
                          key={memory.id}
                          className="flex items-start justify-between gap-3 rounded-[20px] border border-border bg-background/80 p-4"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">
                              {memory.content}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              {memory.category}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void window.settingsAPI
                                .deleteMemory(memory.id)
                                .then(setMemories)
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                        No memories saved yet.
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
