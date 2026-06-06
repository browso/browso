import { Menu, app, dialog, MenuItemConstructorOptions } from "electron";
import type { Window } from "./Window";

export class AppMenu {
  private mainWindow: Window;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.createMenu();
  }

  private createMenu(): void {
    const isMac = process.platform === "darwin";
    const viewSubmenu: MenuItemConstructorOptions[] = [
      {
        label: "Reload",
        accelerator: "CmdOrCtrl+R",
        click: () => this.handleReload(),
      },
      {
        label: "Force Reload",
        accelerator: "CmdOrCtrl+Shift+R",
        click: () => this.handleForceReload(),
      },
      { type: "separator" },
      {
        label: "Toggle Sidebar",
        accelerator: "CmdOrCtrl+E",
        click: () => this.handleToggleSidebar(),
      },
      ...(!isMac
        ? [
            {
              label: "Settings…",
              accelerator: "CmdOrCtrl+,",
              click: () => this.handleOpenSettings(),
            } satisfies MenuItemConstructorOptions,
            { type: "separator" } satisfies MenuItemConstructorOptions,
          ]
        : []),
      {
        label: "Toggle Developer Tools",
        accelerator: isMac ? "Alt+Command+I" : "Ctrl+Shift+I",
        click: () => this.handleToggleDevTools(),
      },
      {
        label: "Toggle Fullscreen",
        accelerator: isMac ? "Ctrl+Command+F" : "F11",
        click: () => this.handleToggleFullscreen(),
      },
    ];

    const template: MenuItemConstructorOptions[] = [
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                {
                  label: "About Browso",
                  click: () => this.handleAbout(),
                },
                { type: "separator" },
                {
                  label: "Settings…",
                  accelerator: "CmdOrCtrl+,",
                  click: () => this.handleOpenSettings(),
                },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
              ],
            } satisfies MenuItemConstructorOptions,
          ]
        : []),
      {
        label: "File",
        submenu: [
          {
            label: "New Tab",
            accelerator: "CmdOrCtrl+T",
            click: () => this.handleNewTab(),
          },
          {
            label: "Close Tab",
            accelerator: "CmdOrCtrl+W",
            click: () => this.handleCloseTab(),
          },
          { type: "separator" },
          {
            label: "Quit",
            accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
            click: () => app.quit(),
          },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
          { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
          { type: "separator" },
          { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
          { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
          {
            label: "Select All",
            accelerator: "CmdOrCtrl+A",
            role: "selectAll",
          },
        ],
      },
      {
        label: "View",
        submenu: viewSubmenu,
      },
      {
        label: "Go",
        submenu: [
          {
            label: "Back",
            accelerator: "CmdOrCtrl+Left",
            click: () => this.handleGoBack(),
          },
          {
            label: "Forward",
            accelerator: "CmdOrCtrl+Right",
            click: () => this.handleGoForward(),
          },
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "About Browso",
            click: () => this.handleAbout(),
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  // Menu action handlers
  private handleNewTab(): void {
    this.mainWindow.createTab();
  }

  private handleCloseTab(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.closeTab(this.mainWindow.activeTab.id);
    }
  }

  private handleReload(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.reload();
    }
  }

  private handleForceReload(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.webContents.reloadIgnoringCache();
    }
  }

  private handleToggleSidebar(): void {
    this.mainWindow.sidebar.toggle();
    this.mainWindow.updateAllBounds();
  }

  private handleOpenSettings(): void {
    this.mainWindow.browserSettings.show();
    this.mainWindow.browserSettings.send("browser-settings-opened");
  }

  private handleToggleDevTools(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.webContents.toggleDevTools();
    }
  }

  private handleToggleFullscreen(): void {
    const isFullScreen = this.mainWindow.baseWindow.isFullScreen();
    this.mainWindow.baseWindow.setFullScreen(!isFullScreen);
  }

  private handleGoBack(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.goBack();
    }
  }

  private handleGoForward(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.goForward();
    }
  }

  private handleAbout(): void {
    void dialog.showMessageBox(this.mainWindow.baseWindow, {
      type: "info",
      title: "About Browso",
      message: "Browso",
      detail: `Version ${app.getVersion()}\n\nBrowser controls, automation, and scoped code execution in one place.`,
      buttons: ["OK"],
    });
  }
}
