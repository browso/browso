import { ipcMain, WebContents } from "electron";
import type { Window } from "./Window";
import { AISettingsStore } from "./AISettings";
import { logger } from "./Logger";
import { MemoryStore } from "./MemoryStore";
import { UpdateManager } from "./UpdateManager";
import { ipcSchemas, parseIpcInput } from "./ipcSchemas";
import { BrowserContextService } from "./BrowserContextService";
import { KnowledgeStore } from "./KnowledgeStore";
import { AgentModeRegistry } from "./AgentModes";

const SENSITIVE_CHANNELS = new Set([
  "sidebar-chat-message",
  "sidebar-get-messages",
  "get-page-content",
  "get-page-text",
  "get-current-url",
]);

export class EventManager {
  private static readonly HANDLE_CHANNELS = [
    "create-tab",
    "close-tab",
    "switch-tab",
    "get-tabs",
    "toggle-split-view",
    "get-split-state",
    "navigate-to",
    "navigate-tab",
    "go-back",
    "go-forward",
    "reload",
    "tab-go-back",
    "tab-go-forward",
    "tab-reload",
    "tab-screenshot",
    "get-active-tab-info",
    "toggle-sidebar",
    "open-browser-settings",
    "close-browser-settings",
    "sidebar-get-layout",
    "sidebar-set-width",
    "sidebar-chat-message",
    "sidebar-clear-chat",
    "sidebar-get-messages",
    "computer-use-get-state",
    "computer-use-start",
    "computer-use-generate-script",
    "sandbox-get-state",
    "sandbox-create-file",
    "sandbox-update-file",
    "sandbox-delete-file",
    "sandbox-set-active-file",
    "sandbox-set-entry-file",
    "sandbox-run",
    "ai-settings-get",
    "ai-settings-update",
    "ollama-models-list",
    "app-settings-get",
    "app-settings-update",
    "update-state-get",
    "update-check",
    "update-download",
    "update-install",
    "update-dismiss",
    "update-open-release-page",
    "get-page-content",
    "get-page-text",
    "get-current-url",
    "memory-get",
    "memory-delete",
    "memory-clear",
    "browser-context-current",
    "browser-context-tabs",
    "agent-modes-list",
    "knowledge-list",
    "knowledge-save-current",
    "knowledge-search",
    "knowledge-delete",
  ] as const;
  private readonly getMainWindow: () => Window | null;
  private settingsStore: AISettingsStore;
  private memoryStore: MemoryStore;
  private updateManager: UpdateManager;
  private browserContext: BrowserContextService;
  private knowledgeStore: KnowledgeStore;
  private removeUpdateListener: (() => void) | null = null;

  constructor(getMainWindow: () => Window | null) {
    this.getMainWindow = getMainWindow;
    this.settingsStore = AISettingsStore.getInstance();
    this.memoryStore = MemoryStore.getInstance();
    this.updateManager = UpdateManager.getInstance();
    this.browserContext = new BrowserContextService(this.getMainWindow);
    this.knowledgeStore = KnowledgeStore.getInstance();
    this.removeRegisteredHandlers();
    this.setupEventHandlers();
    this.removeUpdateListener = this.updateManager.onStateChange(() =>
      this.broadcastUpdateState(),
    );
  }

  private getAvailableMainWindow(): Window | null {
    return this.getMainWindow();
  }

  private requireMainWindow(): Window {
    const mainWindow = this.getAvailableMainWindow();
    if (!mainWindow) {
      logger.error("Main window required but unavailable");
      throw new Error("Main window is not available.");
    }
    return mainWindow;
  }

  private logChannel(channel: string): void {
    if (SENSITIVE_CHANNELS.has(channel)) {
      return;
    }

    logger.info("IPC request", { channel });
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Computer use and sandbox events
    this.handleFeatureWorkspaceEvents();

    // AI settings
    this.handleAISettingsEvents();

    // Update events
    this.handleUpdateEvents();

    // Memory events
    this.handleMemoryEvents();

    // Page content events
    this.handlePageContentEvents();
    this.handlePlatformLayerEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // Debug events
    this.handleDebugEvents();
  }

  private handleMemoryEvents(): void {
    ipcMain.handle("memory-get", () => {
      this.logChannel("memory-get");
      return this.memoryStore.getMemories();
    });

    ipcMain.handle("memory-delete", (_, id: string) => {
      logger.info("Memory deleted");
      return this.memoryStore.deleteMemory(id);
    });

    ipcMain.handle("memory-clear", () => {
      logger.info("Memory cleared");
      return this.memoryStore.clear();
    });
  }

  private handleUpdateEvents(): void {
    ipcMain.handle("update-state-get", () => {
      this.logChannel("update-state-get");
      return this.updateManager.getState();
    });

    ipcMain.handle("update-check", async () => {
      this.logChannel("update-check");
      return this.updateManager.checkForUpdates({
        mainWindow: this.getAvailableMainWindow(),
        promptUser: false,
      });
    });

    ipcMain.handle("update-dismiss", () => {
      this.logChannel("update-dismiss");
      return this.updateManager.dismissUpdate();
    });

    ipcMain.handle("update-download", async () => {
      this.logChannel("update-download");
      return this.updateManager.downloadUpdate();
    });

    ipcMain.handle("update-install", () => {
      this.logChannel("update-install");
      return this.updateManager.installUpdate();
    });

    ipcMain.handle("update-open-release-page", async () => {
      this.logChannel("update-open-release-page");
      await this.updateManager.openReleasePage();
    });
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      this.logChannel("create-tab");
      const validatedUrl = parseIpcInput(
        ipcSchemas.optionalNavigationTarget,
        url,
        "create-tab",
      );
      const newTab = this.requireMainWindow().createTab(validatedUrl);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.logChannel("close-tab");
      const validatedTabId = parseIpcInput(ipcSchemas.tabId, id, "close-tab");
      this.requireMainWindow().closeTab(validatedTabId);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.logChannel("switch-tab");
      const validatedTabId = parseIpcInput(ipcSchemas.tabId, id, "switch-tab");
      this.requireMainWindow().switchActiveTab(validatedTabId);
    });

    // Get tabs
    ipcMain.handle("get-tabs", () => {
      this.logChannel("get-tabs");
      const mainWindow = this.getAvailableMainWindow();
      if (!mainWindow) {
        return [];
      }
      const activeTabId = mainWindow.activeTab?.id;
      const splitState = mainWindow.getSplitState();
      return mainWindow.allTabs.map((tab) => {
        const splitIndex = splitState.tabIds.indexOf(tab.id);
        return {
          id: tab.id,
          title: tab.title,
          url: tab.url,
          isActive: activeTabId === tab.id,
          isSplit: splitState.tabIds.includes(tab.id),
          splitIndex: splitIndex >= 0 ? splitIndex : null,
          canGoBack: tab.webContents.navigationHistory.canGoBack(),
          canGoForward: tab.webContents.navigationHistory.canGoForward(),
        };
      });
    });

    ipcMain.handle("toggle-split-view", (_, url?: string) => {
      this.logChannel("toggle-split-view");
      const validatedUrl = parseIpcInput(
        ipcSchemas.optionalNavigationTarget,
        url,
        "toggle-split-view",
      );
      return this.requireMainWindow().toggleSplitView(validatedUrl);
    });

    ipcMain.handle("get-split-state", () => {
      this.logChannel("get-split-state");
      return (
        this.getAvailableMainWindow()?.getSplitState() ?? {
          isSplit: false,
          tabIds: [],
        }
      );
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      this.logChannel("navigate-to");
      const validatedUrl = parseIpcInput(
        ipcSchemas.optionalNavigationTarget,
        url,
        "navigate-to",
      );
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab && validatedUrl) {
        mainWindow.activeTab.loadURL(validatedUrl);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      this.logChannel("navigate-tab");
      const payload = parseIpcInput(
        ipcSchemas.navigation,
        { tabId, url },
        "navigate-tab",
      );
      const tab = this.requireMainWindow().getTab(payload.tabId);
      if (tab) {
        await tab.loadURL(payload.url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      this.logChannel("go-back");
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab) {
        mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      this.logChannel("go-forward");
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab) {
        mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      this.logChannel("reload");
      const mainWindow = this.requireMainWindow();
      if (mainWindow.activeTab) {
        mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const validatedTabId = parseIpcInput(
        ipcSchemas.tabId,
        tabId,
        "tab-go-back",
      );
      const tab = this.requireMainWindow().getTab(validatedTabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const validatedTabId = parseIpcInput(
        ipcSchemas.tabId,
        tabId,
        "tab-go-forward",
      );
      const tab = this.requireMainWindow().getTab(validatedTabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const validatedTabId = parseIpcInput(
        ipcSchemas.tabId,
        tabId,
        "tab-reload",
      );
      const tab = this.requireMainWindow().getTab(validatedTabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const validatedTabId = parseIpcInput(
        ipcSchemas.tabId,
        tabId,
        "tab-screenshot",
      );
      const tab = this.requireMainWindow().getTab(validatedTabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const mainWindow = this.getAvailableMainWindow();
      const activeTab = mainWindow?.activeTab ?? null;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.navigationHistory.canGoBack(),
          canGoForward: activeTab.webContents.navigationHistory.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      this.logChannel("toggle-sidebar");
      const mainWindow = this.requireMainWindow();
      mainWindow.sidebar.toggle();
      mainWindow.updateAllBounds();
      return true;
    });

    ipcMain.handle("open-browser-settings", () => {
      this.logChannel("open-browser-settings");
      const mainWindow = this.requireMainWindow();
      mainWindow.browserSettings.show();
      mainWindow.browserSettings.send("browser-settings-opened");
      return true;
    });

    ipcMain.handle("close-browser-settings", () => {
      this.logChannel("close-browser-settings");
      const mainWindow = this.requireMainWindow();
      mainWindow.browserSettings.hide();
      return true;
    });

    ipcMain.handle("sidebar-get-layout", () => {
      this.logChannel("sidebar-get-layout");
      return this.requireMainWindow().getSidebarState();
    });

    ipcMain.handle("sidebar-set-width", (_, width: number) => {
      this.logChannel("sidebar-set-width");
      const validatedWidth = parseIpcInput(
        ipcSchemas.sidebarWidth,
        width,
        "sidebar-set-width",
      );
      return this.requireMainWindow().setSidebarWidth(validatedWidth);
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      const validatedRequest = parseIpcInput(
        ipcSchemas.chatRequest,
        request,
        "sidebar-chat-message",
      );
      await this.requireMainWindow().sidebar.client.sendChatMessage(
        validatedRequest,
      );
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      logger.info("Chat cleared");
      this.requireMainWindow().sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.requireMainWindow().sidebar.client.getMessages();
    });
  }

  private handleFeatureWorkspaceEvents(): void {
    ipcMain.handle("computer-use-get-state", () => {
      this.logChannel("computer-use-get-state");
      const mainWindow = this.getAvailableMainWindow();
      return (
        mainWindow?.sidebar.computerUse.getState() ?? {
          sessions: [],
          activeSessionId: null,
          isRunning: false,
        }
      );
    });

    ipcMain.handle("computer-use-start", async (_, request) => {
      logger.info("Computer use started");
      const validatedRequest = parseIpcInput(
        ipcSchemas.computerUseRequest,
        request,
        "computer-use-start",
      );
      return this.requireMainWindow().sidebar.computerUse.startSession(
        validatedRequest,
      );
    });

    ipcMain.handle("computer-use-generate-script", async (_, request) => {
      logger.info("Computer use script generation started");
      const validatedRequest = parseIpcInput(
        ipcSchemas.computerUseRequest,
        request,
        "computer-use-generate-script",
      );
      return this.requireMainWindow().sidebar.computerUse.generateScript(
        validatedRequest,
      );
    });

    ipcMain.handle("sandbox-get-state", () => {
      this.logChannel("sandbox-get-state");
      const mainWindow = this.getAvailableMainWindow();
      return (
        mainWindow?.sidebar.sandbox.getState() ?? {
          files: [],
          activeFileId: null,
          entryFileId: null,
          runs: [],
          isRunning: false,
        }
      );
    });

    ipcMain.handle("sandbox-create-file", (_, input) => {
      this.logChannel("sandbox-create-file");
      const validatedInput = parseIpcInput(
        ipcSchemas.sandboxFileInput,
        input,
        "sandbox-create-file",
      );
      return this.requireMainWindow().sidebar.sandbox.createFile(
        validatedInput,
      );
    });

    ipcMain.handle("sandbox-update-file", (_, fileId: string, patch) => {
      this.logChannel("sandbox-update-file");
      const validatedTabId = parseIpcInput(
        ipcSchemas.tabId,
        fileId,
        "sandbox-update-file",
      );
      const validatedPatch = parseIpcInput(
        ipcSchemas.sandboxFilePatch,
        patch,
        "sandbox-update-file",
      );
      return this.requireMainWindow().sidebar.sandbox.updateFile(
        validatedTabId,
        validatedPatch,
      );
    });

    ipcMain.handle("sandbox-delete-file", (_, fileId: string) => {
      this.logChannel("sandbox-delete-file");
      const validatedFileId = parseIpcInput(
        ipcSchemas.tabId,
        fileId,
        "sandbox-delete-file",
      );
      return this.requireMainWindow().sidebar.sandbox.deleteFile(
        validatedFileId,
      );
    });

    ipcMain.handle("sandbox-set-active-file", (_, fileId: string) => {
      this.logChannel("sandbox-set-active-file");
      const validatedFileId = parseIpcInput(
        ipcSchemas.tabId,
        fileId,
        "sandbox-set-active-file",
      );
      return this.requireMainWindow().sidebar.sandbox.setActiveFile(
        validatedFileId,
      );
    });

    ipcMain.handle("sandbox-set-entry-file", (_, fileId: string) => {
      this.logChannel("sandbox-set-entry-file");
      const validatedFileId = parseIpcInput(
        ipcSchemas.tabId,
        fileId,
        "sandbox-set-entry-file",
      );
      return this.requireMainWindow().sidebar.sandbox.setEntryFile(
        validatedFileId,
      );
    });

    ipcMain.handle("sandbox-run", async (_, request) => {
      logger.info("Sandbox run started");
      const validatedRequest = parseIpcInput(
        ipcSchemas.sandboxRunRequest,
        request,
        "sandbox-run",
      );
      return this.requireMainWindow().sidebar.sandbox.run(validatedRequest);
    });
  }

  private handleAISettingsEvents(): void {
    ipcMain.handle("ai-settings-get", () => {
      this.logChannel("ai-settings-get");
      return this.settingsStore.getSettings();
    });

    ipcMain.handle("ai-settings-update", (_, settings) => {
      const validatedSettings = parseIpcInput(
        ipcSchemas.settingsPatch,
        settings,
        "ai-settings-update",
      );
      logger.info("AI settings updated", {
        provider: validatedSettings.provider,
        hasModel:
          typeof validatedSettings.model === "string" &&
          validatedSettings.model.length > 0,
      });
      const updated = this.settingsStore.updateSettings(validatedSettings);
      this.requireMainWindow().sidebar.view.webContents.send(
        "ai-settings-updated",
        updated,
      );
      return updated;
    });

    ipcMain.handle("app-settings-get", () => {
      this.logChannel("app-settings-get");
      return this.settingsStore.getSettings();
    });

    ipcMain.handle("app-settings-update", (_, settings) => {
      const validatedSettings = parseIpcInput(
        ipcSchemas.settingsPatch,
        settings,
        "app-settings-update",
      );
      logger.info("App settings updated", {
        provider: validatedSettings.provider,
        hasModel:
          typeof validatedSettings.model === "string" &&
          validatedSettings.model.length > 0,
        searchEngine: validatedSettings.searchEngine,
      });
      const updated = this.settingsStore.updateSettings(validatedSettings);
      const mainWindow = this.requireMainWindow();
      mainWindow.sidebar.view.webContents.send("ai-settings-updated", updated);
      mainWindow.topBar.view.webContents.send("app-settings-updated", updated);
      mainWindow.browserSettings.send("app-settings-updated", updated);
      return updated;
    });

    ipcMain.handle("ollama-models-list", async () => {
      this.logChannel("ollama-models-list");
      const settings = this.settingsStore.getSettings();
      const baseUrl = (
        settings.ollamaBaseUrl || "http://127.0.0.1:11434"
      ).trim();

      const normalizedBaseUrl = baseUrl
        .replace(/\/(?:v1|api)\/?$/, "")
        .replace(/\/+$/, "");

      try {
        const response = await fetch(`${normalizedBaseUrl}/api/tags`);
        if (!response.ok) {
          return {
            ok: false,
            models: [],
            error: `Ollama responded with ${response.status}.`,
          };
        }

        const data = (await response.json()) as {
          models?: Array<{ name?: string; model?: string }>;
        };

        const models = (data.models ?? [])
          .map((entry) => entry.name || entry.model || "")
          .filter((name) => name.length > 0);

        return { ok: true, models, error: null };
      } catch {
        logger.warn("Ollama model list failed");
        return {
          ok: false,
          models: [],
          error: "Ollama is offline. Try to launch Ollama.",
        };
      }
    });
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      const mainWindow = this.getAvailableMainWindow();
      if (mainWindow?.activeTab) {
        try {
          return await mainWindow.activeTab.getTabHtml();
        } catch (error) {
          logger.error("Error getting page content", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      const mainWindow = this.getAvailableMainWindow();
      if (mainWindow?.activeTab) {
        try {
          return await mainWindow.activeTab.getTabText();
        } catch (error) {
          logger.error("Error getting page text", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      const mainWindow = this.getAvailableMainWindow();
      if (mainWindow?.activeTab) {
        return mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handlePlatformLayerEvents(): void {
    ipcMain.handle("browser-context-current", async () => {
      return this.browserContext.getActivePageContext();
    });

    ipcMain.handle("browser-context-tabs", async () => {
      return this.browserContext.getOpenTabContexts();
    });

    ipcMain.handle("agent-modes-list", () => {
      return AgentModeRegistry.list();
    });

    ipcMain.handle("knowledge-list", () => {
      return this.knowledgeStore.list();
    });

    ipcMain.handle("knowledge-save-current", async (_, request) => {
      const payload = parseIpcInput(
        ipcSchemas.knowledgeSaveRequest,
        request,
        "knowledge-save-current",
      );
      const context = await this.browserContext.getActivePageContext();
      if (!context) {
        throw new Error("No readable active page is available.");
      }
      logger.info("Page saved to local knowledge", { url: context.url });
      return this.knowledgeStore.savePage(context, payload?.note);
    });

    ipcMain.handle("knowledge-search", (_, request) => {
      const payload = parseIpcInput(
        ipcSchemas.knowledgeSearchRequest,
        request,
        "knowledge-search",
      );
      return this.knowledgeStore.search(payload.query, payload.limit);
    });

    ipcMain.handle("knowledge-delete", (_, id: string) => {
      const validatedId = parseIpcInput(
        ipcSchemas.tabId,
        id,
        "knowledge-delete",
      );
      return this.knowledgeStore.delete(validatedId);
    });
  }

  private handleDarkModeEvents(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleDebugEvents(): void {
    // Ping test
    ipcMain.on("ping", () => logger.info("Ping received"));
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    const mainWindow = this.getMainWindow();
    if (!mainWindow) {
      return;
    }

    // Send to topbar
    if (mainWindow.topBar.view.webContents !== sender) {
      mainWindow.topBar.view.webContents.send("dark-mode-updated", isDarkMode);
    }

    // Send to sidebar
    if (mainWindow.sidebar.view.webContents !== sender) {
      mainWindow.sidebar.view.webContents.send("dark-mode-updated", isDarkMode);
    }

    // Send to standalone settings window if it exists
    mainWindow.browserSettings.send("dark-mode-updated", isDarkMode);

    // Send to all tabs
    mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  // Clean up event listeners
  public cleanup(): void {
    ipcMain.removeAllListeners("dark-mode-changed");
    ipcMain.removeAllListeners("ping");
    this.removeUpdateListener?.();
    this.removeUpdateListener = null;
  }

  private removeRegisteredHandlers(): void {
    for (const channel of EventManager.HANDLE_CHANNELS) {
      ipcMain.removeHandler(channel);
    }
  }

  private broadcastUpdateState(): void {
    const mainWindow = this.getAvailableMainWindow();
    if (!mainWindow) {
      return;
    }

    const state = this.updateManager.getState();
    mainWindow.topBar.view.webContents.send("update-state-changed", state);
    mainWindow.browserSettings.send("update-state-changed", state);
  }
}
