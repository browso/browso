import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { randomUUID } from "node:crypto";
import { join } from "path";
import { LLMClient } from "./LLMClient.ts";
import { ComputerUseManager } from "./ComputerUseManager.ts";
import { SandboxManager } from "./SandboxManager.ts";
import type { Tab } from "./Tab.ts";
import { AISettingsStore } from "./AISettings.ts";

export class SideBar {
  private static readonly DEFAULT_WIDTH = 400;
  private static readonly MIN_WIDTH = 320;
  private static readonly MAX_WIDTH = 720;
  private webContentsView: WebContentsView;
  private loadPromise: Promise<void>;
  private baseWindow: BaseWindow;
  private llmClient: LLMClient;
  private computerUseManager: ComputerUseManager | null = null;
  private sandboxManager: SandboxManager | null = null;
  private isVisible: boolean = true;
  private width: number = SideBar.DEFAULT_WIDTH;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.width = AISettingsStore.getInstance().getSettings().sidebarWidth;
    this.webContentsView = this.createWebContentsView();
    this.loadPromise = this.loadRenderer();
    baseWindow.contentView.addChildView(this.webContentsView);
    this.setupBounds();

    // Initialize LLM client
    this.llmClient = new LLMClient(this.webContentsView.webContents);
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/sidebar.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    return webContentsView;
  }

  private loadRenderer(): Promise<void> {
    if (is.dev && process.env["BROWSO_RENDERER_URL"]) {
      const sidebarUrl = new URL(
        "/sidebar/",
        process.env["BROWSO_RENDERER_URL"],
      );
      return this.webContentsView.webContents.loadURL(sidebarUrl.toString());
    }

    return this.webContentsView.webContents.loadFile(
      join(__dirname, "../renderer/sidebar/index.html"),
    );
  }

  private setupBounds(): void {
    if (!this.isVisible) return;

    const bounds = this.baseWindow.getBounds();
    const width = this.getWidth();
    this.webContentsView.setBounds({
      x: bounds.width - width,
      y: 88, // Start below the topbar
      width,
      height: bounds.height - 88, // Subtract topbar height
    });
  }

  updateBounds(): void {
    if (this.isVisible) {
      this.setupBounds();
    } else {
      // Hide the sidebar
      this.webContentsView.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    }
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  waitUntilLoaded(): Promise<void> {
    return this.loadPromise;
  }

  get client(): LLMClient {
    return this.llmClient;
  }

  initializeFeatureManagers(getActiveTab: () => Tab | null): void {
    this.computerUseManager = new ComputerUseManager(
      this.webContentsView.webContents,
      getActiveTab,
    );
    this.sandboxManager = new SandboxManager(
      this.webContentsView.webContents,
      getActiveTab,
    );
  }

  get computerUse(): ComputerUseManager {
    if (!this.computerUseManager) {
      throw new Error("Computer use manager has not been initialized.");
    }
    return this.computerUseManager;
  }

  get sandbox(): SandboxManager {
    if (!this.sandboxManager) {
      throw new Error("Sandbox manager has not been initialized.");
    }
    return this.sandboxManager;
  }

  show(): void {
    this.isVisible = true;
    this.setupBounds();
  }

  openWithDraft(message: string): void {
    this.show();
    const sendDraft = (): void => {
      this.webContentsView.webContents.send("ai-draft-requested", message);
    };
    if (this.webContentsView.webContents.isLoading()) {
      this.webContentsView.webContents.once("did-finish-load", sendDraft);
    } else {
      sendDraft();
    }
  }

  async openAndRun(message: string): Promise<void> {
    const prompt = message.trim();
    if (!prompt) {
      return;
    }

    this.show();
    await this.llmClient.sendChatMessage({
      message: prompt,
      messageId: randomUUID(),
    });
  }

  hide(): void {
    this.isVisible = false;
    this.webContentsView.setBounds({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  getWidth(): number {
    return SideBar.clampWidth(this.width);
  }

  setWidth(width: number): number {
    this.width = SideBar.clampWidth(width);
    AISettingsStore.getInstance().updateSettings({ sidebarWidth: this.width });
    this.updateBounds();
    return this.width;
  }

  getMinWidth(): number {
    return SideBar.MIN_WIDTH;
  }

  getMaxWidth(): number {
    return SideBar.MAX_WIDTH;
  }

  private static clampWidth(width: number): number {
    return Math.max(
      SideBar.MIN_WIDTH,
      Math.min(SideBar.MAX_WIDTH, Math.round(width)),
    );
  }
}
