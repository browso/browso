interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
  isSplit: boolean;
  splitIndex: number | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface SplitState {
  isSplit: boolean;
  tabIds: string[];
}

interface AppSettings {
  provider: "huggingface" | "ollama" | "openai" | "anthropic";
  model: string;
  ollamaBaseUrl: string;
  huggingFaceBaseUrl: string;
  homepage: string;
  searchEngine: "google" | "duckduckgo" | "bing";
  autoRouteToSandbox: boolean;
  sidebarWidth: number;
  memoryEnabled: boolean;
  setupCompleted: boolean;
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
  releaseNotes:
    | string
    | Array<{
        version: string;
        note: string | null;
      }>
    | null;
  publishedAt: string | null;
  checkedAt: number | null;
  error: string | null;
}

interface TopBarAPI {
  // Tab management
  createTab: (
    url?: string,
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;
  toggleSplitView: (url?: string) => Promise<boolean>;
  getSplitState: () => Promise<SplitState>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;

  // Sidebar
  toggleSidebar: () => Promise<void>;
  openBrowserSettings: () => Promise<void>;
  getAppSettings: () => Promise<AppSettings>;
  getUpdateState: () => Promise<UpdateState>;
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
    topBarAPI: TopBarAPI;
    darkModeAPI: DarkModeAPI;
  }
}

export {};
