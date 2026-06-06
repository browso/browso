import { contextBridge } from "electron";
import { electronAPI as browsoAPI } from "@electron-toolkit/preload";
import { subscribeToIpcChannel } from "./ipcSubscription";

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
    return subscribeToIpcChannel(
      browsoAPI.ipcRenderer,
      "app-settings-updated",
      callback,
    );
  },
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    return subscribeToIpcChannel(
      browsoAPI.ipcRenderer,
      "update-state-changed",
      callback,
    );
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("browso", browsoAPI);
    contextBridge.exposeInMainWorld("settingsAPI", settingsAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore
  window.browso = browsoAPI;
  // @ts-ignore
  window.settingsAPI = settingsAPI;
}
