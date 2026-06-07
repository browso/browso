import React, { useEffect, useState } from "react";
import { Button } from "@common/components/Button";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { cn } from "@common/lib/utils";
import {
  BookOpen,
  Bot,
  Briefcase,
  Check,
  ChevronRight,
  Database,
  Download,
  Globe,
  GraduationCap,
  HardDrive,
  History,
  LayoutPanelLeft,
  MemoryStick,
  Moon,
  Search,
  Sun,
  UserRound,
  Users,
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
type KnowledgePage = Awaited<
  ReturnType<typeof window.settingsAPI.getKnowledgePages>
>[number];
type UpdateState = Awaited<
  ReturnType<typeof window.settingsAPI.getUpdateState>
>;
type ProfileContextState = Awaited<
  ReturnType<typeof window.settingsAPI.getProfilesAndContexts>
>;
type ProfileIcon = ProfileContextState["profiles"][number]["icon"];
type ProfileColor = ProfileContextState["profiles"][number]["color"];
type SettingsTab =
  | "general"
  | "profiles"
  | "ai"
  | "workspace"
  | "memory"
  | "data";

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
    id: "profiles",
    label: "Profiles",
    icon: Users,
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
  {
    id: "data",
    label: "Data",
    icon: Database,
  },
];

const cardClassName =
  "rounded-[24px] border border-border/70 bg-card/80 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:shadow-[0_18px_48px_rgba(0,0,0,0.22)]";

const MODEL_INPUT_COMMIT_DELAY_MS = 250;
const profileIcons: Array<{
  id: ProfileIcon;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "person", label: "Personal", icon: UserRound },
  { id: "briefcase", label: "Work", icon: Briefcase },
  { id: "graduation", label: "Study", icon: GraduationCap },
  { id: "globe", label: "Other", icon: Globe },
];
const profileColors: ProfileColor[] = [
  "blue",
  "purple",
  "green",
  "orange",
  "red",
  "gray",
];
const profileColorClasses: Record<ProfileColor, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  red: "bg-rose-500",
  gray: "bg-slate-500",
};

export const SettingsApp: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [knowledgePages, setKnowledgePages] = useState<KnowledgePage[]>([]);
  const [profileContextState, setProfileContextState] =
    useState<ProfileContextState | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileIcon, setNewProfileIcon] =
    useState<ProfileIcon>("briefcase");
  const [newProfileColor, setNewProfileColor] =
    useState<ProfileColor>("purple");
  const [newContextName, setNewContextName] = useState("");
  const [newContextDescription, setNewContextDescription] = useState("");
  const [profileActionStatus, setProfileActionStatus] = useState<string | null>(
    null,
  );
  const [dataActionStatus, setDataActionStatus] = useState<string | null>(null);
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
    const removeProfileContextListener =
      window.settingsAPI.onProfilesAndContextsUpdated((next) => {
        setProfileContextState(next);
        void Promise.all([
          window.settingsAPI.getMemories().then(setMemories),
          window.settingsAPI.getKnowledgePages().then(setKnowledgePages),
        ]);
      });
    const removeSectionRequestListener =
      window.settingsAPI.onSettingsSectionRequested(setActiveTab);

    const load = async (): Promise<void> => {
      const [
        next,
        savedMemories,
        savedPages,
        nextProfileContextState,
        nextUpdateState,
      ] = await Promise.all([
        window.settingsAPI.getAppSettings(),
        window.settingsAPI.getMemories(),
        window.settingsAPI.getKnowledgePages(),
        window.settingsAPI.getProfilesAndContexts(),
        window.settingsAPI.getUpdateState(),
      ]);
      setSettings(next);
      setMemories(savedMemories);
      setKnowledgePages(savedPages);
      setProfileContextState(nextProfileContextState);
      setUpdateState(nextUpdateState);
    };

    void load();

    return () => {
      removeAppSettingsListener();
      removeUpdateStateListener();
      removeProfileContextListener();
      removeSectionRequestListener();
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

  const runDataAction = async (
    successMessage: string,
    action: () => Promise<unknown>,
  ): Promise<void> => {
    setDataActionStatus(null);
    try {
      await action();
      setDataActionStatus(successMessage);
    } catch (error) {
      setDataActionStatus(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
    }
  };

  const applyProfileContextState = async (
    next: ProfileContextState,
    successMessage: string,
  ): Promise<void> => {
    setProfileContextState(next);
    const [nextMemories, nextPages] = await Promise.all([
      window.settingsAPI.getMemories(),
      window.settingsAPI.getKnowledgePages(),
    ]);
    setMemories(nextMemories);
    setKnowledgePages(nextPages);
    setProfileActionStatus(successMessage);
  };

  const runProfileAction = async (
    successMessage: string,
    action: () => Promise<ProfileContextState>,
  ): Promise<void> => {
    setProfileActionStatus(null);
    try {
      await applyProfileContextState(await action(), successMessage);
    } catch (error) {
      setProfileActionStatus(
        error instanceof Error
          ? error.message
          : "The profile action could not be completed.",
      );
    }
  };

  const getPageSource = (page: KnowledgePage): string => {
    try {
      return new URL(page.url).hostname;
    } catch {
      return page.url;
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
  const updateStatusLabel = (() => {
    switch (updateState?.status) {
      case "checking":
        return "Checking for updates...";
      case "available":
        return `Version ${updateState.latestVersion} is available`;
      case "downloading":
        return `Downloading update${
          updateState.downloadPercent === null
            ? "..."
            : `: ${Math.round(updateState.downloadPercent)}%`
        }`;
      case "downloaded":
        return `Version ${updateState.latestVersion} is ready to install`;
      case "installing":
        return "Restarting to install the update...";
      case "unsupported":
        return "Manual update required for this installation";
      case "error":
        return "Automatic update failed";
      default:
        return "You are on the latest known version";
    }
  })();

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
                          Download and install new versions without removing
                          your current application.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        updateState?.checking ||
                        updateState?.status === "downloading" ||
                        updateState?.status === "installing"
                      }
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
                          {updateStatusLabel}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Current version:{" "}
                          {updateState?.currentVersion ?? "Unknown"}
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Last checked: {updateCheckedLabel}
                        </p>
                      </div>
                      {updateState?.status === "available" && (
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
                              void window.settingsAPI
                                .downloadUpdate()
                                .then(setUpdateState)
                            }
                          >
                            Update Now
                          </Button>
                        </div>
                      )}
                      {updateState?.status === "downloaded" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            void window.settingsAPI
                              .installUpdate()
                              .then(setUpdateState)
                          }
                        >
                          Restart and Install
                        </Button>
                      )}
                      {(updateState?.status === "unsupported" ||
                        updateState?.status === "error") && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            void window.settingsAPI.openReleasePage()
                          }
                        >
                          Open Release Page
                        </Button>
                      )}
                    </div>
                    {updateState?.status === "downloading" && (
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-foreground transition-[width]"
                          style={{
                            width: `${updateState.downloadPercent ?? 0}%`,
                          }}
                        />
                      </div>
                    )}
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

            {activeTab === "profiles" && profileContextState && (
              <>
                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      <Users className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Profiles
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Keep Personal, Work, and other browsing separate. Each
                        profile has its own AI conversations, memory, and saved
                        knowledge.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {profileContextState.profiles.map((profile) => {
                      const isActive =
                        profile.id === profileContextState.activeProfileId;
                      const Icon =
                        profileIcons.find((entry) => entry.id === profile.icon)
                          ?.icon ?? UserRound;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() =>
                            void runProfileAction("Profile switched.", () =>
                              window.settingsAPI.switchProfile(profile.id),
                            )
                          }
                          className={cn(
                            "relative rounded-[22px] border p-4 text-left transition-all",
                            isActive
                              ? "border-foreground/30 bg-secondary shadow-sm"
                              : "border-border bg-background/80 hover:border-foreground/20",
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-11 items-center justify-center rounded-full text-white shadow-sm",
                              profileColorClasses[profile.color],
                            )}
                          >
                            <Icon className="size-5" />
                          </div>
                          <p className="mt-3 text-sm font-semibold text-foreground">
                            {profile.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {
                              profileContextState.contexts.filter(
                                (context) => context.profileId === profile.id,
                              ).length
                            }{" "}
                            workspace
                            {profileContextState.contexts.filter(
                              (context) => context.profileId === profile.id,
                            ).length === 1
                              ? ""
                              : "s"}
                          </p>
                          {isActive && (
                            <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-foreground text-background">
                              <Check className="size-3.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className={cardClassName}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Configure active profile
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Change how this profile appears in Browso.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={profileContextState.profiles.length === 1}
                      onClick={() =>
                        void runProfileAction("Profile deleted.", () =>
                          window.settingsAPI.deleteProfile(
                            profileContextState.activeProfileId,
                          ),
                        )
                      }
                    >
                      Delete
                    </Button>
                  </div>

                  {(() => {
                    const activeProfile = profileContextState.profiles.find(
                      (profile) =>
                        profile.id === profileContextState.activeProfileId,
                    );
                    if (!activeProfile) return null;

                    return (
                      <div className="mt-5 space-y-5">
                        <div>
                          <label className="mb-2 block text-xs font-medium text-muted-foreground">
                            Name
                          </label>
                          <input
                            value={activeProfile.name}
                            maxLength={80}
                            onChange={(event) =>
                              setProfileContextState((previous) =>
                                previous
                                  ? {
                                      ...previous,
                                      profiles: previous.profiles.map(
                                        (profile) =>
                                          profile.id === activeProfile.id
                                            ? {
                                                ...profile,
                                                name: event.target.value,
                                              }
                                            : profile,
                                      ),
                                    }
                                  : previous,
                              )
                            }
                            onBlur={(event) => {
                              const name = event.target.value.trim();
                              if (!name) {
                                void window.settingsAPI
                                  .getProfilesAndContexts()
                                  .then(setProfileContextState);
                                return;
                              }
                              void runProfileAction("Profile updated.", () =>
                                window.settingsAPI.updateProfile(
                                  activeProfile.id,
                                  { name },
                                ),
                              );
                            }}
                            className="w-full rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none"
                          />
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Symbol
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {profileIcons.map((option) => {
                              const Icon = option.icon;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  title={option.label}
                                  onClick={() =>
                                    void runProfileAction(
                                      "Profile updated.",
                                      () =>
                                        window.settingsAPI.updateProfile(
                                          activeProfile.id,
                                          { icon: option.id },
                                        ),
                                    )
                                  }
                                  className={cn(
                                    "flex size-11 items-center justify-center rounded-full border transition",
                                    activeProfile.icon === option.id
                                      ? "border-foreground bg-secondary"
                                      : "border-border bg-background hover:bg-secondary/60",
                                  )}
                                >
                                  <Icon className="size-4" />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Color
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {profileColors.map((color) => (
                              <button
                                key={color}
                                type="button"
                                title={color}
                                onClick={() =>
                                  void runProfileAction(
                                    "Profile updated.",
                                    () =>
                                      window.settingsAPI.updateProfile(
                                        activeProfile.id,
                                        { color },
                                      ),
                                  )
                                }
                                className={cn(
                                  "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition",
                                  profileColorClasses[color],
                                  activeProfile.color === color &&
                                    "ring-2 ring-foreground",
                                )}
                              >
                                {activeProfile.color === color && (
                                  <Check className="size-3.5 text-white" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </section>

                <section className={cardClassName}>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Add profile
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Create a separate space for work, school, or another part
                      of your browsing.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <input
                      value={newProfileName}
                      onChange={(event) =>
                        setNewProfileName(event.target.value)
                      }
                      placeholder="New profile name"
                      maxLength={80}
                      className="rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none"
                    />
                    <div className="grid gap-2 sm:grid-cols-4">
                      {profileIcons.map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setNewProfileIcon(option.id);
                              if (!newProfileName.trim()) {
                                setNewProfileName(option.label);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-medium",
                              newProfileIcon === option.id
                                ? "border-foreground/30 bg-secondary"
                                : "border-border bg-background",
                            )}
                          >
                            <Icon className="size-4" />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profileColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          title={color}
                          onClick={() => setNewProfileColor(color)}
                          className={cn(
                            "size-7 rounded-full ring-offset-2 ring-offset-background",
                            profileColorClasses[color],
                            newProfileColor === color &&
                              "ring-2 ring-foreground",
                          )}
                        />
                      ))}
                    </div>
                    <Button
                      className="justify-self-start"
                      disabled={!newProfileName.trim()}
                      onClick={() =>
                        void runProfileAction("Profile created.", () =>
                          window.settingsAPI
                            .createProfile(
                              newProfileName,
                              newProfileIcon,
                              newProfileColor,
                            )
                            .then((next) => {
                              setNewProfileName("");
                              setNewProfileIcon("briefcase");
                              setNewProfileColor("purple");
                              return next;
                            }),
                        )
                      }
                    >
                      Add Profile
                    </Button>
                  </div>
                </section>

                <section className={cardClassName}>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Contexts
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Every context has separate AI conversation, memory, and
                      saved knowledge.
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {profileContextState.contexts
                      .filter(
                        (context) =>
                          context.profileId ===
                          profileContextState.activeProfileId,
                      )
                      .map((context) => {
                        const isActive =
                          context.id === profileContextState.activeContextId;
                        const contextCount =
                          profileContextState.contexts.filter(
                            (entry) => entry.profileId === context.profileId,
                          ).length;

                        return (
                          <div
                            key={context.id}
                            className={cn(
                              "flex items-start justify-between gap-3 rounded-[20px] border p-4",
                              isActive
                                ? "border-foreground/30 bg-secondary"
                                : "border-border bg-background/80",
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {context.name}
                                </p>
                                {isActive && (
                                  <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                    Active
                                  </span>
                                )}
                              </div>
                              {context.description && (
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {context.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    void runProfileAction(
                                      "Context switched.",
                                      () =>
                                        window.settingsAPI.switchContext(
                                          context.id,
                                        ),
                                    )
                                  }
                                >
                                  Switch
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={contextCount === 1}
                                onClick={() =>
                                  void runProfileAction(
                                    "Context deleted.",
                                    () =>
                                      window.settingsAPI.deleteContext(
                                        context.id,
                                      ),
                                  )
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>

                <section className={cardClassName}>
                  <h3 className="text-sm font-semibold text-foreground">
                    New context
                  </h3>
                  <div className="mt-4 grid gap-3">
                    <input
                      value={newContextName}
                      onChange={(event) =>
                        setNewContextName(event.target.value)
                      }
                      placeholder="Context name"
                      maxLength={80}
                      className="rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none"
                    />
                    <textarea
                      value={newContextDescription}
                      onChange={(event) =>
                        setNewContextDescription(event.target.value)
                      }
                      placeholder="Optional purpose or instructions"
                      maxLength={500}
                      rows={3}
                      className="resize-none rounded-2xl border border-border bg-background/90 px-3 py-2.5 text-sm text-foreground outline-none"
                    />
                    <Button
                      className="justify-self-start"
                      disabled={!newContextName.trim()}
                      onClick={() =>
                        void runProfileAction("Context created.", () =>
                          window.settingsAPI
                            .createContext(
                              profileContextState.activeProfileId,
                              newContextName,
                              newContextDescription,
                            )
                            .then((next) => {
                              setNewContextName("");
                              setNewContextDescription("");
                              return next;
                            }),
                        )
                      }
                    >
                      Add Context
                    </Button>
                  </div>
                </section>

                {profileActionStatus && (
                  <div
                    role="status"
                    className="rounded-[20px] border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground"
                  >
                    {profileActionStatus}
                  </div>
                )}
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-border bg-background/80 p-4">
                      <p className="text-2xl font-semibold text-foreground">
                        {memories.length}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Saved of 100 maximum
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-border bg-background/80 p-4">
                      <p className="text-2xl font-semibold text-foreground">
                        {
                          new Set(memories.map((memory) => memory.category))
                            .size
                        }
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Memory categories in use
                      </p>
                    </div>
                  </div>
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

            {activeTab === "data" && (
              <>
                <section className={cardClassName}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                        <History className="size-4 text-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          AI conversation
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Clear messages from the current AI conversation. Full
                          chat logs are not stored as browser history.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void runDataAction(
                          "AI conversation cleared.",
                          window.settingsAPI.clearChatHistory,
                        )
                      }
                    >
                      Clear Conversation
                    </Button>
                  </div>
                </section>

                <section className={cardClassName}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                        <BookOpen className="size-4 text-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          Saved pages
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Manage pages saved for local AI knowledge and
                          retrieval.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={knowledgePages.length === 0}
                      onClick={() =>
                        void runDataAction(
                          "All saved pages cleared.",
                          async () => {
                            const pages =
                              await window.settingsAPI.clearKnowledgePages();
                            setKnowledgePages(pages);
                          },
                        )
                      }
                    >
                      Clear All
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {knowledgePages.length > 0 ? (
                      knowledgePages.map((page) => (
                        <div
                          key={page.id}
                          className="flex items-start justify-between gap-3 rounded-[20px] border border-border bg-background/80 p-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {page.title || "Untitled page"}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {getPageSource(page)}
                            </p>
                            {page.note && (
                              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {page.note}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void runDataAction(
                                "Saved page deleted.",
                                async () => {
                                  const pages =
                                    await window.settingsAPI.deleteKnowledgePage(
                                      page.id,
                                    );
                                  setKnowledgePages(pages);
                                },
                              )
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                        No pages saved for AI knowledge.
                      </div>
                    )}
                  </div>
                </section>

                <section className={cardClassName}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-secondary">
                      <HardDrive className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Website data
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Remove cached files or sign out of websites by clearing
                        cookies and local site storage.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-border bg-background/80 p-4">
                      <p className="text-sm font-medium text-foreground">
                        Cached files
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Frees cached network data without removing sign-ins.
                      </p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void runDataAction(
                            "Browser cache cleared.",
                            window.settingsAPI.clearCache,
                          )
                        }
                      >
                        Clear Cache
                      </Button>
                    </div>

                    <div className="rounded-[20px] border border-border bg-background/80 p-4">
                      <p className="text-sm font-medium text-foreground">
                        Cookies and site storage
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Signs you out and removes website-local data.
                      </p>
                      <Button
                        className="mt-4"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void runDataAction(
                            "Cookies and site storage cleared.",
                            window.settingsAPI.clearSiteData,
                          )
                        }
                      >
                        Clear Site Data
                      </Button>
                    </div>
                  </div>
                </section>

                {dataActionStatus && (
                  <div
                    role="status"
                    className="rounded-[20px] border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground"
                  >
                    {dataActionStatus}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
