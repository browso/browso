import { contextBridge } from "electron";
import { electronAPI as browsoAPI } from "@electron-toolkit/preload";
import { subscribeToIpcChannel } from "./ipcSubscription";

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
      browsoAPI.ipcRenderer,
      "chat-response",
      callback,
    );
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    return subscribeToIpcChannel(
      browsoAPI.ipcRenderer,
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
      browsoAPI.ipcRenderer,
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
      browsoAPI.ipcRenderer,
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
      browsoAPI.ipcRenderer,
      "sandbox-state",
      callback,
    );
  },
};

// Expose the BROWSO desktop bridge to the renderer.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("browso", browsoAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.browso = browsoAPI;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}
