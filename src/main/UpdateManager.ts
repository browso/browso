import { app, dialog, shell } from "electron";
import {
  autoUpdater,
  type AppUpdater,
  type UpdateInfo,
} from "electron-updater";
import { logger } from "./Logger";
import type { Window } from "./Window";

const RELEASES_URL = "https://github.com/Browso/browso/releases";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "unsupported"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
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

type UpdateStateListener = (state: UpdateState) => void;

export class UpdateManager {
  private static instance: UpdateManager | null = null;
  private readonly updater: AppUpdater;
  private state: UpdateState;
  private listeners = new Set<UpdateStateListener>();
  private promptShown = false;
  private restartPromptShown = false;
  private mainWindow: Window | null = null;

  private constructor(updater: AppUpdater = autoUpdater) {
    this.updater = updater;
    const canAutoUpdate = this.getCanAutoUpdate();
    this.state = {
      status: canAutoUpdate ? "idle" : "unsupported",
      checking: false,
      hasUpdate: false,
      dismissed: false,
      canAutoUpdate,
      downloadPercent: null,
      currentVersion: app.getVersion(),
      latestVersion: null,
      releaseUrl: null,
      releaseName: null,
      publishedAt: null,
      checkedAt: null,
      error: null,
    };

    this.configureUpdater();
  }

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }

    return UpdateManager.instance;
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  onStateChange(listener: UpdateStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dismissUpdate(): UpdateState {
    if (!this.state.hasUpdate) {
      return this.getState();
    }

    this.setState({ dismissed: true });
    return this.getState();
  }

  async checkForUpdates(options?: {
    mainWindow?: Window | null;
    promptUser?: boolean;
  }): Promise<UpdateState> {
    this.mainWindow = options?.mainWindow ?? this.mainWindow;

    if (!this.state.canAutoUpdate) {
      this.setState({
        status: "unsupported",
        checking: false,
        checkedAt: Date.now(),
        error: app.isPackaged
          ? "Automatic updates are unavailable for this installation. Open the release page to update manually."
          : "Automatic updates are available only in an installed application.",
      });
      return this.getState();
    }

    if (this.state.checking || this.state.status === "downloading") {
      return this.getState();
    }

    this.promptShown = false;
    this.setState({
      status: "checking",
      checking: true,
      error: null,
      checkedAt: Date.now(),
    });

    try {
      await this.updater.checkForUpdates();
      if (
        options?.promptUser &&
        this.state.hasUpdate &&
        this.state.status === "available"
      ) {
        await this.maybePromptForUpdate();
      }
    } catch (error) {
      this.handleError(error);
    }

    return this.getState();
  }

  async downloadUpdate(): Promise<UpdateState> {
    if (!this.state.canAutoUpdate) {
      await this.openReleasePage();
      return this.getState();
    }

    if (this.state.status === "downloaded") {
      return this.getState();
    }

    if (!this.state.hasUpdate) {
      return this.checkForUpdates({ mainWindow: this.mainWindow });
    }

    this.setState({
      status: "downloading",
      checking: false,
      dismissed: false,
      downloadPercent: 0,
      error: null,
    });

    try {
      await this.updater.downloadUpdate();
    } catch (error) {
      this.handleError(error);
    }

    return this.getState();
  }

  installUpdate(): UpdateState {
    if (!this.state.canAutoUpdate || this.state.status !== "downloaded") {
      return this.getState();
    }

    this.setState({ status: "installing", error: null });
    this.updater.quitAndInstall(false, true);
    return this.getState();
  }

  async openReleasePage(): Promise<void> {
    await shell.openExternal(this.state.releaseUrl || RELEASES_URL);
  }

  private configureUpdater(): void {
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = true;
    this.updater.allowPrerelease = false;
    this.updater.channel = this.getUpdateChannel();
    this.updater.allowDowngrade = false;
    this.updater.logger = {
      info: (message?: unknown): void =>
        logger.info("Updater", { message: String(message ?? "") }),
      warn: (message?: unknown): void =>
        logger.warn("Updater", { message: String(message ?? "") }),
      error: (message?: unknown): void => logger.error("Updater", message),
      debug: (message?: unknown): void =>
        logger.info("Updater debug", { message: String(message ?? "") }),
    };

    this.updater.on("checking-for-update", () => {
      this.setState({
        status: "checking",
        checking: true,
        error: null,
      });
    });

    this.updater.on("update-available", (info) => {
      this.applyUpdateInfo(info, {
        status: "available",
        checking: false,
        hasUpdate: true,
        dismissed:
          this.state.latestVersion === info.version && this.state.dismissed,
        downloadPercent: null,
        checkedAt: Date.now(),
        error: null,
      });
    });

    this.updater.on("update-not-available", (info) => {
      this.applyUpdateInfo(info, {
        status: "idle",
        checking: false,
        hasUpdate: false,
        dismissed: false,
        downloadPercent: null,
        checkedAt: Date.now(),
        error: null,
      });
    });

    this.updater.on("download-progress", (progress) => {
      this.setState({
        status: "downloading",
        checking: false,
        downloadPercent: Math.max(0, Math.min(100, progress.percent)),
      });
    });

    this.updater.on("update-downloaded", (info) => {
      this.applyUpdateInfo(info, {
        status: "downloaded",
        checking: false,
        hasUpdate: true,
        dismissed: false,
        downloadPercent: 100,
        error: null,
      });
      void this.maybePromptForRestart();
    });

    this.updater.on("update-cancelled", () => {
      this.setState({
        status: "available",
        checking: false,
        downloadPercent: null,
        error: "The update download was cancelled.",
      });
    });

    this.updater.on("error", (error) => {
      this.handleError(error);
    });
  }

  private async maybePromptForUpdate(): Promise<void> {
    if (
      !this.state.hasUpdate ||
      this.state.dismissed ||
      this.promptShown ||
      !this.mainWindow
    ) {
      return;
    }

    this.promptShown = true;
    const { response } = await dialog.showMessageBox(
      this.mainWindow.baseWindow,
      {
        type: "info",
        buttons: ["Download Update", "Later", "Open Settings"],
        defaultId: 0,
        cancelId: 1,
        title: "Update Available",
        message: `Browso ${this.state.latestVersion} is available.`,
        detail:
          "The update can be downloaded and installed without removing the current application.",
        noLink: true,
      },
    );

    if (response === 0) {
      await this.downloadUpdate();
      return;
    }

    if (response === 2) {
      this.mainWindow.browserSettings.show();
    }

    this.dismissUpdate();
  }

  private async maybePromptForRestart(): Promise<void> {
    if (this.restartPromptShown || !this.mainWindow) {
      return;
    }

    this.restartPromptShown = true;
    const { response } = await dialog.showMessageBox(
      this.mainWindow.baseWindow,
      {
        type: "info",
        buttons: ["Restart and Install", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update Ready",
        message: `Browso ${this.state.latestVersion} is ready to install.`,
        detail:
          "Restart now to replace the installed application while keeping your settings and data.",
        noLink: true,
      },
    );

    if (response === 0) {
      this.installUpdate();
    }
  }

  private applyUpdateInfo(info: UpdateInfo, patch: Partial<UpdateState>): void {
    this.setState({
      latestVersion: info.version,
      releaseUrl: this.getReleaseUrl(info.version),
      releaseName: info.releaseName || `v${info.version}`,
      publishedAt: info.releaseDate || null,
      ...patch,
    });
  }

  private handleError(error: unknown): void {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    logger.warn("Automatic update failed", { error: message });
    this.setState({
      status: "error",
      checking: false,
      downloadPercent: null,
      checkedAt: Date.now(),
      error: `${message} You can still update from the release page.`,
    });
  }

  private setState(patch: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };

    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  private getCanAutoUpdate(): boolean {
    if (!app.isPackaged) {
      return false;
    }

    if (process.platform === "darwin" || process.platform === "win32") {
      return true;
    }

    return process.platform === "linux" && Boolean(process.env.APPIMAGE);
  }

  private getUpdateChannel(): string {
    if (process.platform === "darwin") {
      return `mac-${process.arch}`;
    }

    if (process.platform === "win32") {
      return `win-${process.arch}`;
    }

    return `linux-${process.arch}`;
  }

  private getReleaseUrl(version: string): string {
    return `https://github.com/Browso/browso/releases/tag/v${version}`;
  }
}
