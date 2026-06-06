import { ElectronAPI as BrowsoAPI } from "@electron-toolkit/preload";

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
  checking: boolean;
  hasUpdate: boolean;
  dismissed: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  releaseName: string | null;
  publishedAt: string | null;
  checkedAt: number | null;
  error: string | null;
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
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  dismissUpdate: () => Promise<UpdateState>;
  openReleasePage: () => Promise<void>;
  onAppSettingsUpdated: (
    callback: (settings: AppSettings) => void,
  ) => () => void;
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => () => void;
}

declare global {
  interface Window {
    browso: BrowsoAPI;
    settingsAPI: SettingsAPI;
  }
}
