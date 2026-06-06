import { contextBridge, ipcRenderer } from "electron";

const browsoAPI = { ipcRenderer };

function subscribeToIpcChannel<T>(
  channel: string,
  callback: (payload: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) =>
    callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

interface ChatRequest {
  message: string;
  context: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface ComputerUseRequest {
  goal: string;
}

interface SandboxFileInput {
  name: string;
  content?: string;
}

interface AISettings {
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

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) =>
    browsoAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: () => browsoAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  getMessages: () => browsoAPI.ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    return subscribeToIpcChannel(
      "chat-response",
      callback,
    );
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    return subscribeToIpcChannel(
      "chat-messages-updated",
      callback,
    );
  },

  // Page content access
  getPageContent: () => browsoAPI.ipcRenderer.invoke("get-page-content"),
  getPageText: () => browsoAPI.ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: () => browsoAPI.ipcRenderer.invoke("get-current-url"),
  getCurrentPageContext: () =>
    browsoAPI.ipcRenderer.invoke("browser-context-current"),
  getOpenTabContexts: () =>
    browsoAPI.ipcRenderer.invoke("browser-context-tabs"),
  listAgentModes: () => browsoAPI.ipcRenderer.invoke("agent-modes-list"),
  listKnowledge: () => browsoAPI.ipcRenderer.invoke("knowledge-list"),
  saveCurrentPage: (note?: string) =>
    browsoAPI.ipcRenderer.invoke("knowledge-save-current", { note }),
  searchKnowledge: (query: string, limit?: number) =>
    browsoAPI.ipcRenderer.invoke("knowledge-search", { query, limit }),
  deleteKnowledge: (id: string) =>
    browsoAPI.ipcRenderer.invoke("knowledge-delete", id),

  // Tab information
  getActiveTabInfo: () => browsoAPI.ipcRenderer.invoke("get-active-tab-info"),
  getSidebarLayout: () => browsoAPI.ipcRenderer.invoke("sidebar-get-layout"),
  setSidebarWidth: (width: number) =>
    browsoAPI.ipcRenderer.invoke("sidebar-set-width", width),
  getAISettings: () => browsoAPI.ipcRenderer.invoke("ai-settings-get"),
  updateAISettings: (settings: Partial<AISettings>) =>
    browsoAPI.ipcRenderer.invoke("ai-settings-update", settings),
  listOllamaModels: () => browsoAPI.ipcRenderer.invoke("ollama-models-list"),
  getAppSettings: () => browsoAPI.ipcRenderer.invoke("app-settings-get"),
  updateAppSettings: (settings: Partial<AISettings>) =>
    browsoAPI.ipcRenderer.invoke("app-settings-update", settings),
  onAISettingsUpdated: (callback: (settings: AISettings) => void) => {
    return subscribeToIpcChannel(
      "ai-settings-updated",
      callback,
    );
  },
  onOpenSettings: (callback: () => void) => {
    const listener = () => callback();
    browsoAPI.ipcRenderer.on("sidebar-open-settings", listener);
    return () => {
      browsoAPI.ipcRenderer.removeListener("sidebar-open-settings", listener);
    };
  },

  // Computer use
  getComputerUseState: () =>
    browsoAPI.ipcRenderer.invoke("computer-use-get-state"),
  startComputerUse: (request: ComputerUseRequest) =>
    browsoAPI.ipcRenderer.invoke("computer-use-start", request),
  generateComputerUseScript: (request: ComputerUseRequest) =>
    browsoAPI.ipcRenderer.invoke("computer-use-generate-script", request),
  onComputerUseState: (callback: (state: unknown) => void) => {
    return subscribeToIpcChannel(
      "computer-use-state",
      callback,
    );
  },

  // Sandbox
  getSandboxState: () => browsoAPI.ipcRenderer.invoke("sandbox-get-state"),
  createSandboxFile: (input: SandboxFileInput) =>
    browsoAPI.ipcRenderer.invoke("sandbox-create-file", input),
  updateSandboxFile: (
    fileId: string,
    patch: { name?: string; content?: string; isScoped?: boolean },
  ) => browsoAPI.ipcRenderer.invoke("sandbox-update-file", fileId, patch),
  deleteSandboxFile: (fileId: string) =>
    browsoAPI.ipcRenderer.invoke("sandbox-delete-file", fileId),
  setActiveSandboxFile: (fileId: string) =>
    browsoAPI.ipcRenderer.invoke("sandbox-set-active-file", fileId),
  setSandboxEntryFile: (fileId: string) =>
    browsoAPI.ipcRenderer.invoke("sandbox-set-entry-file", fileId),
  runSandbox: (request?: { entryFileId?: string | null }) =>
    browsoAPI.ipcRenderer.invoke("sandbox-run", request),
  onSandboxState: (callback: (state: unknown) => void) => {
    return subscribeToIpcChannel(
      "sandbox-state",
      callback,
    );
  },
};

const darkModeAPI = {
  setDarkMode: (isDarkMode: boolean) =>
    browsoAPI.ipcRenderer.send("dark-mode-changed", isDarkMode),
  onDarkModeChanged: (callback: (isDarkMode: boolean) => void) =>
    subscribeToIpcChannel(
      "dark-mode-updated",
      callback,
    ),
};

// Expose only the narrow sidebar bridge to the renderer.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
    contextBridge.exposeInMainWorld("darkModeAPI", darkModeAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
  // @ts-ignore (define in dts)
  window.darkModeAPI = darkModeAPI;
}
