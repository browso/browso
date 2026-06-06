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

// TopBar specific APIs
const topBarAPI = {
  // Tab management
  createTab: (url?: string) => browsoAPI.ipcRenderer.invoke("create-tab", url),
  closeTab: (tabId: string) => browsoAPI.ipcRenderer.invoke("close-tab", tabId),
  switchTab: (tabId: string) =>
    browsoAPI.ipcRenderer.invoke("switch-tab", tabId),
  getTabs: () => browsoAPI.ipcRenderer.invoke("get-tabs"),
  toggleSplitView: (url?: string) =>
    browsoAPI.ipcRenderer.invoke("toggle-split-view", url),
  getSplitState: () => browsoAPI.ipcRenderer.invoke("get-split-state"),

  // Tab navigation
  navigateTab: (tabId: string, url: string) =>
    browsoAPI.ipcRenderer.invoke("navigate-tab", tabId, url),
  goBack: (tabId: string) => browsoAPI.ipcRenderer.invoke("tab-go-back", tabId),
  goForward: (tabId: string) =>
    browsoAPI.ipcRenderer.invoke("tab-go-forward", tabId),
  reload: (tabId: string) => browsoAPI.ipcRenderer.invoke("tab-reload", tabId),

  // Tab actions
  tabScreenshot: (tabId: string) =>
    browsoAPI.ipcRenderer.invoke("tab-screenshot", tabId),

  // Sidebar
  toggleSidebar: () => browsoAPI.ipcRenderer.invoke("toggle-sidebar"),
  openBrowserSettings: () =>
    browsoAPI.ipcRenderer.invoke("open-browser-settings"),
  getAppSettings: () => browsoAPI.ipcRenderer.invoke("app-settings-get"),
  getUpdateState: () => browsoAPI.ipcRenderer.invoke("update-state-get"),
  onAppSettingsUpdated: (callback: (settings: unknown) => void) => {
    return subscribeToIpcChannel("app-settings-updated", callback);
  },
  onUpdateStateChanged: (callback: (state: unknown) => void) => {
    return subscribeToIpcChannel("update-state-changed", callback);
  },
};

const darkModeAPI = {
  setDarkMode: (isDarkMode: boolean) =>
    browsoAPI.ipcRenderer.send("dark-mode-changed", isDarkMode),
  onDarkModeChanged: (callback: (isDarkMode: boolean) => void) =>
    subscribeToIpcChannel("dark-mode-updated", callback),
};

// Expose only the narrow top bar bridge to the renderer.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
    contextBridge.exposeInMainWorld("darkModeAPI", darkModeAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.topBarAPI = topBarAPI;
  // @ts-ignore (define in dts)
  window.darkModeAPI = darkModeAPI;
}
