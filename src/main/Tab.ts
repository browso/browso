import { NativeImage, WebContentsView, type WebContents } from "electron";
import { AISettingsStore } from "./AISettings";
import {
  BROWSO_WELCOME_URL,
  buildWelcomePageHtml,
  isWelcomeUrl,
} from "./WelcomePage";

export class Tab {
  private webContentsView: WebContentsView;
  private _id: string;
  private _title: string;
  private _url: string;
  private _isVisible: boolean = false;

  constructor(id: string, url: string = "https://www.google.com") {
    this._id = id;
    this._url = url;
    this._title = "New Tab";

    // Create the WebContentsView for web content only
    this.webContentsView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    // Set up event listeners
    this.setupEventListeners();

    // Load the initial URL
    this.loadURL(url);
  }

  private setupEventListeners(): void {
    // Update title when page title changes
    this.webContentsView.webContents.on("page-title-updated", (_, title) => {
      this._title = title;
    });

    // Update URL when navigation occurs
    this.webContentsView.webContents.on("did-navigate", (_, url) => {
      if (isWelcomeUrl(this._url) && url.startsWith("data:text/html")) {
        return;
      }
      this._url = url;
    });

    this.webContentsView.webContents.on("did-navigate-in-page", (_, url) => {
      if (isWelcomeUrl(this._url) && url.startsWith("data:text/html")) {
        return;
      }
      this._url = url;
    });
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get url(): string {
    return this._url;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get webContents(): WebContents {
    return this.webContentsView.webContents;
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  // Public methods
  show(): void {
    this._isVisible = true;
    this.webContentsView.setVisible(true);
  }

  hide(): void {
    this._isVisible = false;
    this.webContentsView.setVisible(false);
  }

  async screenshot(): Promise<NativeImage> {
    return await this.webContentsView.webContents.capturePage();
  }

  async runJs(
    code: string,
  ): Promise<Awaited<ReturnType<WebContents["executeJavaScript"]>>> {
    return await this.webContentsView.webContents.executeJavaScript(code);
  }

  async getTabHtml(): Promise<string> {
    return await this.runJs(`document.documentElement?.outerHTML || ""`);
  }

  async getTabText(): Promise<string> {
    return await this.runJs(`
      (() => {
        const root =
          document.body ||
          document.documentElement;
        return String(root?.innerText || root?.textContent || "")
          .replace(/\\s+/g, " ")
          .trim();
      })()
    `);
  }

  loadURL(url: string): Promise<void> {
    this._url = isWelcomeUrl(url) ? BROWSO_WELCOME_URL : url;
    if (isWelcomeUrl(url)) {
      const settings = AISettingsStore.getInstance().getSettings();
      return this.webContentsView.webContents.loadURL(
        `data:text/html;charset=UTF-8,${encodeURIComponent(
          buildWelcomePageHtml(settings.searchEngine),
        )}`,
      );
    }
    return this.webContentsView.webContents.loadURL(url);
  }

  goBack(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoBack()) {
      this.webContentsView.webContents.navigationHistory.goBack();
    }
  }

  goForward(): void {
    if (this.webContentsView.webContents.navigationHistory.canGoForward()) {
      this.webContentsView.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    this.webContentsView.webContents.reload();
  }

  stop(): void {
    this.webContentsView.webContents.stop();
  }

  destroy(): void {
    this.webContentsView.webContents.close();
  }
}
