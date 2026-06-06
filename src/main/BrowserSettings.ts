import { is } from "@electron-toolkit/utils";
import { BaseWindow, BrowserWindow } from "electron";
import { join } from "path";

export class BrowserSettings {
  private readonly parentWindow: BaseWindow;
  private settingsWindow: BrowserWindow | null = null;

  constructor(baseWindow: BaseWindow) {
    this.parentWindow = baseWindow;
  }

  private createWindow(): BrowserWindow {
    const bounds = this.parentWindow.getBounds();
    const width = 1040;
    const height = 720;

    const settingsWindow = new BrowserWindow({
      width,
      height,
      minWidth: 960,
      minHeight: 620,
      show: false,
      autoHideMenuBar: true,
      title: "Browso Settings",
      parent: this.parentWindow,
      backgroundColor: "#0b1020",
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
      x: bounds.x + Math.max(40, Math.round((bounds.width - width) / 2)),
      y: bounds.y + Math.max(40, Math.round((bounds.height - height) / 2)),
      webPreferences: {
        preload: join(__dirname, "../preload/settings.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["BROWSO_RENDERER_URL"]) {
      const settingsUrl = new URL(
        "/settings/",
        process.env["BROWSO_RENDERER_URL"],
      );
      void settingsWindow.loadURL(settingsUrl.toString());
    } else {
      void settingsWindow.loadFile(
        join(__dirname, "../renderer/settings/index.html"),
      );
    }

    settingsWindow.on("closed", () => {
      this.settingsWindow = null;
    });

    return settingsWindow;
  }

  private getOrCreateWindow(): BrowserWindow {
    if (!this.settingsWindow || this.settingsWindow.isDestroyed()) {
      this.settingsWindow = this.createWindow();
    }

    return this.settingsWindow;
  }

  updateBounds(): void {
    // Settings now lives in its own native window, so there are no embedded bounds to update.
  }

  show(): void {
    const settingsWindow = this.getOrCreateWindow();
    if (!settingsWindow.isVisible()) {
      settingsWindow.show();
    }
    settingsWindow.focus();
  }

  hide(): void {
    this.settingsWindow?.hide();
  }

  toggle(): void {
    if (this.getIsVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  send(channel: string, ...args: unknown[]): void {
    if (!this.settingsWindow || this.settingsWindow.isDestroyed()) {
      return;
    }

    this.settingsWindow.webContents.send(channel, ...args);
  }

  getIsVisible(): boolean {
    return (
      !!this.settingsWindow &&
      !this.settingsWindow.isDestroyed() &&
      this.settingsWindow.isVisible()
    );
  }
}
