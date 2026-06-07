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

interface ProfileContextState {
  activeProfileId: string;
  activeContextId: string;
  profiles: Array<{
    id: string;
    name: string;
    icon: "person" | "briefcase" | "graduation" | "globe";
    color: "blue" | "purple" | "green" | "orange" | "red" | "gray";
    createdAt: number;
    updatedAt: number;
  }>;
  contexts: Array<{
    id: string;
    profileId: string;
    name: string;
    description: string;
    createdAt: number;
    updatedAt: number;
  }>;
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
  getKnowledgePages: () => browsoAPI.ipcRenderer.invoke("knowledge-list"),
  deleteKnowledgePage: (id: string) =>
    browsoAPI.ipcRenderer.invoke("knowledge-delete", id),
  clearKnowledgePages: () => browsoAPI.ipcRenderer.invoke("knowledge-clear"),
  clearChatHistory: () =>
    browsoAPI.ipcRenderer.invoke("settings-clear-chat-history"),
  clearSiteData: () => browsoAPI.ipcRenderer.invoke("settings-clear-site-data"),
  clearCache: () => browsoAPI.ipcRenderer.invoke("settings-clear-cache"),
  getProfilesAndContexts: () =>
    browsoAPI.ipcRenderer.invoke("profiles-contexts-get"),
  createProfile: (
    name: string,
    icon: "person" | "briefcase" | "graduation" | "globe",
    color: "blue" | "purple" | "green" | "orange" | "red" | "gray",
  ) => browsoAPI.ipcRenderer.invoke("profile-create", { name, icon, color }),
  renameProfile: (id: string, name: string) =>
    browsoAPI.ipcRenderer.invoke("profile-rename", { id, name }),
  updateProfile: (
    id: string,
    input: {
      name?: string;
      icon?: "person" | "briefcase" | "graduation" | "globe";
      color?: "blue" | "purple" | "green" | "orange" | "red" | "gray";
    },
  ) => browsoAPI.ipcRenderer.invoke("profile-update", { id, ...input }),
  deleteProfile: (id: string) =>
    browsoAPI.ipcRenderer.invoke("profile-delete", id),
  switchProfile: (id: string) =>
    browsoAPI.ipcRenderer.invoke("profile-switch", id),
  createContext: (profileId: string, name: string, description?: string) =>
    browsoAPI.ipcRenderer.invoke("context-create", {
      profileId,
      name,
      description,
    }),
  updateContext: (id: string, input: { name?: string; description?: string }) =>
    browsoAPI.ipcRenderer.invoke("context-update", { id, ...input }),
  deleteContext: (id: string) =>
    browsoAPI.ipcRenderer.invoke("context-delete", id),
  switchContext: (id: string) =>
    browsoAPI.ipcRenderer.invoke("context-switch", id),
  getUpdateState: () => browsoAPI.ipcRenderer.invoke("update-state-get"),
  checkForUpdates: () => browsoAPI.ipcRenderer.invoke("update-check"),
  downloadUpdate: () => browsoAPI.ipcRenderer.invoke("update-download"),
  installUpdate: () => browsoAPI.ipcRenderer.invoke("update-install"),
  dismissUpdate: () => browsoAPI.ipcRenderer.invoke("update-dismiss"),
  openReleasePage: () =>
    browsoAPI.ipcRenderer.invoke("update-open-release-page"),
  onAppSettingsUpdated: (callback: (settings: AppSettings) => void) => {
    return subscribeToIpcChannel("app-settings-updated", callback);
  },
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    return subscribeToIpcChannel("update-state-changed", callback);
  },
  onProfilesAndContextsUpdated: (
    callback: (state: ProfileContextState) => void,
  ) => subscribeToIpcChannel("profiles-contexts-updated", callback),
  onSettingsSectionRequested: (callback: (section: string) => void) =>
    subscribeToIpcChannel("settings-section-requested", callback),
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
