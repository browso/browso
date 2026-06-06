import { app, dialog, shell } from "electron";
import { logger } from "./Logger";
import type { Window } from "./Window";
import { buildUpdateSnapshot, type ReleaseMetadata } from "./updateState";

const GITHUB_REMOTE_URL = "https://github.com/Xaroq/browso.git";
const RELEASES_URL = "https://github.com/Xaroq/browso/releases/tag/latest";

export interface UpdateState {
  checking: boolean;
  hasUpdate: boolean;
  dismissed: boolean;
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
  private state: UpdateState = {
    checking: false,
    hasUpdate: false,
    dismissed: false,
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseUrl: null,
    releaseName: null,
    publishedAt: null,
    checkedAt: null,
    error: null,
  };
  private listeners = new Set<UpdateStateListener>();
  private promptShown = false;

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
    if (this.state.checking) {
      return this.getState();
    }

    this.setState({ checking: true, error: null });

    try {
      const response = await fetch(this.getLatestReleaseApiUrl(), {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": `browso/${this.state.currentVersion}`,
        },
      });

      if (response.status === 404) {
        logger.info("No GitHub release found for update check");
        this.setState({
          checking: false,
          hasUpdate: false,
          dismissed: false,
          latestVersion: null,
          releaseUrl: RELEASES_URL,
          releaseName: null,
          publishedAt: null,
          checkedAt: Date.now(),
          error: "No published GitHub release found yet.",
        });
        return this.getState();
      }

      if (!response.ok) {
        throw new Error(`GitHub update check failed with ${response.status}`);
      }

      const release = (await response.json()) as {
        html_url?: string;
        name?: string;
        published_at?: string;
        tag_name?: string;
      };

      const snapshot = buildUpdateSnapshot(
        this.state,
        {
          htmlUrl: release.html_url,
          name: release.name,
          publishedAt: release.published_at,
          tagName: release.tag_name,
        } satisfies ReleaseMetadata,
        RELEASES_URL,
        Date.now(),
      );
      this.setState(snapshot);

      if (snapshot.hasUpdate && options?.promptUser) {
        await this.maybePromptForUpdate(options.mainWindow ?? null);
      }
    } catch (error) {
      logger.warn("Update check failed", {
        error:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown error",
      });
      this.setState({
        checking: false,
        checkedAt: Date.now(),
        error: "Could not check GitHub releases right now.",
      });
    }

    return this.getState();
  }

  async openReleasePage(): Promise<void> {
    await shell.openExternal(this.state.releaseUrl || RELEASES_URL);
  }

  private async maybePromptForUpdate(mainWindow: Window | null): Promise<void> {
    if (
      !this.state.hasUpdate ||
      this.state.dismissed ||
      this.promptShown ||
      !mainWindow
    ) {
      return;
    }

    this.promptShown = true;

    const { response } = await dialog.showMessageBox(mainWindow.baseWindow, {
      type: "info",
      buttons: ["Update Now", "Later", "Open Settings"],
      defaultId: 0,
      cancelId: 1,
      title: "Update Available",
      message: `Browso ${this.state.latestVersion} is available.`,
      detail: `You are currently on version ${this.state.currentVersion}.`,
      noLink: true,
    });

    if (response === 0) {
      await this.openReleasePage();
      this.dismissUpdate();
      return;
    }

    if (response === 2) {
      mainWindow.browserSettings.show();
    }

    this.dismissUpdate();
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

  private getLatestReleaseApiUrl(): string {
    const repoPath = this.extractRepoPath(GITHUB_REMOTE_URL);
    return `https://api.github.com/repos/${repoPath}/releases/latest`;
  }

  private extractRepoPath(remoteUrl: string): string {
    const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (!match) {
      throw new Error("Invalid GitHub remote URL");
    }

    return match[1];
  }
}
