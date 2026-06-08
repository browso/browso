import { NativeImage, WebContentsView, type WebContents } from "electron";
import { AISettingsStore } from "./AISettings";
import {
  BROWSO_AI_HASH_PREFIX,
  BROWSO_AI_REQUEST_URL,
  BROWSO_WELCOME_URL,
  buildWelcomePageHtml,
  isWelcomeUrl,
  parseWelcomeAIRequest,
} from "./WelcomePage";
import { HistoryStore } from "./HistoryStore";

export class Tab {
  private webContentsView: WebContentsView;
  private _id: string;
  private _title: string;
  private _url: string;
  private _isVisible: boolean = false;
  private readonly _profileId: string;

  constructor(
    id: string,
    profileId: string,
    url: string = "https://www.google.com",
    private readonly onAIRequest?: (message: string) => void,
  ) {
    this._id = id;
    this._profileId = profileId;
    this._url = url;
    this._title = "New Tab";

    // Create the WebContentsView for web content only
    this.webContentsView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        partition: `persist:browso-profile-${profileId}`,
      },
    });

    // Set up event listeners
    this.setupEventListeners();

    // Load the initial URL
    this.loadURL(url);
  }

  private setupEventListeners(): void {
    this.webContentsView.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith(BROWSO_AI_REQUEST_URL)) {
        return;
      }

      event.preventDefault();
      const prompt = parseWelcomeAIRequest(url);
      if (prompt) {
        this.onAIRequest?.(prompt);
      }
    });

    // Update title when page title changes
    this.webContentsView.webContents.on("page-title-updated", (_, title) => {
      this._title = title;
      this.recordHistory();
    });

    // Update URL when navigation occurs
    this.webContentsView.webContents.on("did-navigate", (_, url) => {
      if (isWelcomeUrl(this._url) && url.startsWith("data:text/html")) {
        return;
      }
      this._url = url;
      this.recordHistory();
    });

    this.webContentsView.webContents.on("did-navigate-in-page", (_, url) => {
      if (isWelcomeUrl(this._url) && url.startsWith("data:text/html")) {
        const hash = new URL(url).hash;
        if (hash.startsWith(BROWSO_AI_HASH_PREFIX)) {
          this.onAIRequest?.(
            decodeURIComponent(hash.slice(BROWSO_AI_HASH_PREFIX.length)),
          );
          void this.runJs('location.hash = ""');
        }
        return;
      }
      this._url = url;
      this.recordHistory();
    });
  }

  private recordHistory(): void {
    if (this._url && !this._url.startsWith("data:") && !isWelcomeUrl(this._url)) {
      HistoryStore.getInstance().addEntry(this._url, this._title);
    }
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get profileId(): string {
    return this._profileId;
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
    this.focusWelcomeSearch();
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

  private focusWelcomeSearch(): void {
    if (!isWelcomeUrl(this._url)) {
      return;
    }

    const focus = (): void => {
      this.webContentsView.webContents.focus();
      void this.runJs(
        'document.getElementById("search-input")?.focus({ preventScroll: true })',
      ).catch(() => undefined);
    };

    if (this.webContentsView.webContents.isLoading()) {
      this.webContentsView.webContents.once("did-finish-load", focus);
    } else {
      focus();
    }
  }
}
