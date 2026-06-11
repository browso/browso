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

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface ComputerUseState {
  sessions: Array<{
    id: string;
    goal: string;
    summary: string;
    status: "planning" | "running" | "completed" | "failed";
    createdAt: number;
    currentUrl: string | null;
    screenshot: string | null;
    logs: string[];
    steps: Array<{
      id: string;
      action:
        | "navigate"
        | "click"
        | "type"
        | "extract_text"
        | "wait"
        | "run_script";
      label: string;
      status: "pending" | "running" | "completed" | "failed";
      result?: string;
      url?: string;
      selector?: string;
      text?: string;
      script?: string;
      ms?: number;
    }>;
    generatedScript: {
      goal: string;
      code: string;
      createdAt: number;
    } | null;
  }>;
  activeSessionId: string | null;
  isRunning: boolean;
}

interface SandboxState {
  files: Array<{
    id: string;
    name: string;
    content: string;
    isScoped: boolean;
    createdAt: number;
  }>;
  activeFileId: string | null;
  entryFileId: string | null;
  runs: Array<{
    id: string;
    entryFileId: string | null;
    scopedFileIds: string[];
    status: "idle" | "running" | "completed" | "failed";
    startedAt: number;
    finishedAt: number | null;
    lines: Array<{
      id: string;
      stream: "stdout" | "stderr" | "system" | "event";
      text: string;
    }>;
    notifications: Array<{
      id: string;
      message: string;
      createdAt: number;
    }>;
  }>;
  isRunning: boolean;
}

interface SidebarLayout {
  width: number;
  minWidth: number;
  maxWidth: number;
  isVisible: boolean;
}

interface AISettings {
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

interface ProfileContextState {
  activeProfileId: string;
  activeContextId: string;
  profiles: Array<{
    id: string;
    name: string;
    icon: "person" | "briefcase" | "graduation" | "globe";
    color: "blue" | "purple" | "green" | "orange" | "red" | "gray";
  }>;
  contexts: Array<{
    id: string;
    profileId: string;
    name: string;
    description: string;
  }>;
}

interface BrowserPageContext {
  tabId: string;
  title: string;
  url: string;
  selection: string;
  text: string;
  capturedAt: number;
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

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) => Promise<void>;
  clearChat: () => Promise<void>;
  getMessages: () => Promise<
    Array<{
      role: "user" | "assistant" | "system";
      content:
        | string
        | Array<
            | string
            | {
                type?: string;
                text?: string;
                image?: string;
              }
          >;
    }>
  >;
  onChatResponse: (callback: (data: ChatResponse) => void) => () => void;
  onMessagesUpdated: (
    callback: (
      messages: Array<{
        role: "user" | "assistant" | "system";
        content:
          | string
          | Array<
              | string
              | {
                  type?: string;
                  text?: string;
                  image?: string;
                }
            >;
      }>,
    ) => void,
  ) => () => void;
  onAIDraftRequested: (callback: (message: string) => void) => () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;
  getCurrentPageContext: () => Promise<BrowserPageContext | null>;
  getOpenTabContexts: () => Promise<BrowserPageContext[]>;
  listKnowledge: () => Promise<KnowledgePage[]>;
  saveCurrentPage: (note?: string) => Promise<KnowledgePage>;
  searchKnowledge: (
    query: string,
    limit?: number,
  ) => Promise<Array<KnowledgePage & { score: number; excerpt: string }>>;
  deleteKnowledge: (id: string) => Promise<KnowledgePage[]>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;
  getSidebarLayout: () => Promise<SidebarLayout>;
  setSidebarWidth: (width: number) => Promise<number>;
  getAISettings: () => Promise<AISettings>;
  updateAISettings: (settings: Partial<AISettings>) => Promise<AISettings>;
  listOllamaModels: () => Promise<{
    ok: boolean;
    models: string[];
    error: string | null;
  }>;
  getAppSettings: () => Promise<AISettings>;
  updateAppSettings: (settings: Partial<AISettings>) => Promise<AISettings>;
  getProfilesAndContexts: () => Promise<ProfileContextState>;
  openSettings: () => Promise<void>;
  onProfilesAndContextsUpdated: (
    callback: (state: ProfileContextState) => void,
  ) => () => void;
  onAISettingsUpdated: (callback: (settings: AISettings) => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;

  // Computer use
  getComputerUseState: () => Promise<ComputerUseState>;
  startComputerUse: (request: { goal: string }) => Promise<ComputerUseState>;
  generateComputerUseScript: (request: {
    goal: string;
  }) => Promise<ComputerUseState>;
  onComputerUseState: (
    callback: (state: ComputerUseState) => void,
  ) => () => void;

  // Sandbox
  getSandboxState: () => Promise<SandboxState>;
  createSandboxFile: (input: {
    name: string;
    content?: string;
  }) => Promise<SandboxState>;
  updateSandboxFile: (
    fileId: string,
    patch: { name?: string; content?: string; isScoped?: boolean },
  ) => Promise<SandboxState>;
  deleteSandboxFile: (fileId: string) => Promise<SandboxState>;
  setActiveSandboxFile: (fileId: string) => Promise<SandboxState>;
  setSandboxEntryFile: (fileId: string) => Promise<SandboxState>;
  runSandbox: (request?: {
    entryFileId?: string | null;
  }) => Promise<SandboxState>;
  onSandboxState: (callback: (state: SandboxState) => void) => () => void;
}

interface DarkModeAPI {
  setDarkMode: (isDarkMode: boolean) => void;
  onDarkModeChanged: (callback: (isDarkMode: boolean) => void) => () => void;
}

declare global {
  interface Window {
    sidebarAPI: SidebarAPI;
    darkModeAPI: DarkModeAPI;
  }
}

export {};
