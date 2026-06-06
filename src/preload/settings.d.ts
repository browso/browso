interface AppSettings {
  provider: "ollama" | "openai" | "anthropic";
  model: string;
  ollamaBaseUrl: string;
  homepage: string;
  searchEngine: "google" | "duckduckgo" | "bing";
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
  memoryEnabled: boolean;
  activeAgentMode:
    | "copilot"
    | "research"
    | "shopping"
    | "scraper"
    | "developer"
    | "security";
}

interface MemoryEntry {
  id: string;
  content: string;
  category: "preference" | "profile" | "workflow" | "instruction";
  createdAt: number;
  updatedAt: number;
}

interface UpdateState {
  status:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "unsupported"
    | "error";
  checking: boolean;
  hasUpdate: boolean;
  dismissed: boolean;
  canAutoUpdate: boolean;
  downloadPercent: number | null;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  releaseName: string | null;
  publishedAt: string | null;
  checkedAt: number | null;
  error: string | null;
}

interface KnowledgePage {
  id: string;
  url: string;
  title: string;
  text: string;
  selection: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

interface SettingsAPI {
  getAppSettings: () => Promise<AppSettings>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  setSidebarWidth: (width: number) => Promise<number>;
  closeBrowserSettings: () => Promise<void>;
  listOllamaModels: () => Promise<{
    ok: boolean;
    models: string[];
    error: string | null;
  }>;
  getMemories: () => Promise<MemoryEntry[]>;
  deleteMemory: (id: string) => Promise<MemoryEntry[]>;
  clearMemories: () => Promise<MemoryEntry[]>;
  getKnowledgePages: () => Promise<KnowledgePage[]>;
  deleteKnowledgePage: (id: string) => Promise<KnowledgePage[]>;
  clearKnowledgePages: () => Promise<KnowledgePage[]>;
  clearChatHistory: () => Promise<{ cleared: boolean }>;
  clearSiteData: () => Promise<{ cleared: boolean }>;
  clearCache: () => Promise<{ cleared: boolean }>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  downloadUpdate: () => Promise<UpdateState>;
  installUpdate: () => Promise<UpdateState>;
  dismissUpdate: () => Promise<UpdateState>;
  openReleasePage: () => Promise<void>;
  onAppSettingsUpdated: (
    callback: (settings: AppSettings) => void,
  ) => () => void;
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => () => void;
}

interface DarkModeAPI {
  setDarkMode: (isDarkMode: boolean) => void;
  onDarkModeChanged: (callback: (isDarkMode: boolean) => void) => () => void;
}

declare global {
  interface Window {
    settingsAPI: SettingsAPI;
    darkModeAPI: DarkModeAPI;
  }
}

export {};
