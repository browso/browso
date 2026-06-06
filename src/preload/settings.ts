import { contextBridge, ipcRenderer } from "electron";

const browsoAPI = { ipcRenderer };

function subscribeToIpcChannel<T>(
  channel: string,
  callback: (payload: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void =>
    callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

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

const settingsAPI = {
  getAppSettings: () => browsoAPI.ipcRenderer.invoke("app-settings-get"),
  updateAppSettings: (settings: Partial<AppSettings>) =>
    browsoAPI.ipcRenderer.invoke("app-settings-update", settings),
  setSidebarWidth: (width: number) =>
    browsoAPI.ipcRenderer.invoke("sidebar-set-width", width),
  closeBrowserSettings: () =>
    browsoAPI.ipcRenderer.invoke("close-browser-settings"),
  listOllamaModels: () => browsoAPI.ipcRenderer.invoke("ollama-models-list"),
  getMemories: () => browsoAPI.ipcRenderer.invoke("memory-get"),
  deleteMemory: (id: string) =>
    browsoAPI.ipcRenderer.invoke("memory-delete", id),
  clearMemories: () => browsoAPI.ipcRenderer.invoke("memory-clear"),
  getUpdateState: () => browsoAPI.ipcRenderer.invoke("update-state-get"),
  checkForUpdates: () => browsoAPI.ipcRenderer.invoke("update-check"),
  dismissUpdate: () => browsoAPI.ipcRenderer.invoke("update-dismiss"),
  openReleasePage: () =>
    browsoAPI.ipcRenderer.invoke("update-open-release-page"),
  onAppSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    return subscribeToIpcChannel("app-settings-updated", callback);
  },
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    return subscribeToIpcChannel("update-state-changed", callback);
  },
};

const darkModeAPI = {
  setDarkMode: (isDarkMode: boolean) =>
    browsoAPI.ipcRenderer.send("dark-mode-changed", isDarkMode),
  onDarkModeChanged: (callback: (isDarkMode: boolean) => void) =>
    subscribeToIpcChannel("dark-mode-updated", callback),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("settingsAPI", settingsAPI);
    contextBridge.exposeInMainWorld("darkModeAPI", darkModeAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error -- fallback assignment when context isolation is disabled.
  window.settingsAPI = settingsAPI;
  // @ts-expect-error -- fallback assignment when context isolation is disabled.
  window.darkModeAPI = darkModeAPI;
}
