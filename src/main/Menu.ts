import {
  Menu,
  app,
  dialog,
  shell,
  clipboard,
  MenuItemConstructorOptions,
} from "electron";
import type { Window } from "./Window";
import { AISettingsStore } from "./AISettings";

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
      { type: "separator" },
      { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", role: "zoomIn" },
      { label: "Zoom Out", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
      { label: "Actual Size", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
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
        label: "Tools",
        submenu: [
          {
            label: "Duplicate Tab",
            accelerator: "CmdOrCtrl+Shift+D",
            click: () => this.handleDuplicateTab(),
          },
          {
            label: "Open Welcome Page",
            accelerator: "CmdOrCtrl+Shift+N",
            click: () => this.handleOpenWelcomePage(),
          },
          { type: "separator" },
          {
            label: "Copy Current URL",
            accelerator: "CmdOrCtrl+Shift+C",
            click: () => this.handleCopyCurrentUrl(),
          },
          {
            label: "Open Current Page in Default Browser",
            click: () => this.handleOpenCurrentPageInDefaultBrowser(),
          },
          { type: "separator" },
          {
            label: "Toggle Split View",
            accelerator: "CmdOrCtrl+\\",
            click: () => this.handleToggleSplitView(),
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
          { type: "separator" },
          {
            label: "Home",
            accelerator: "CmdOrCtrl+Shift+H",
            click: () => this.handleOpenHomepage(),
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
          { type: "separator" },
          {
            label: "Browso on GitHub",
            click: () =>
              this.handleOpenExternal("https://github.com/browso/browso"),
          },
          {
            label: "Report an Issue",
            click: () => this.handleReportIssue(),
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  // Menu action handlers
  private handleReportIssue(): void {
    const version = app.getVersion();
    const platform = process.platform;
    const arch = process.arch;

    const body = `
<!-- Please provide a clear and concise description of the issue -->

### Environment
- **Version:** ${version}
- **Platform:** ${platform}
- **Architecture:** ${arch}

### Description
<!-- A clear and concise description of what the issue is. -->

### Steps to Reproduce
1.
2.
3.

### Expected Behavior
<!-- What you expected to happen. -->

### Actual Behavior
<!-- What actually happened. -->

### Additional Context
<!-- Add any other context or screenshots about the problem here. -->
`.trim();

    const url = new URL("https://github.com/browso/browso/issues/new");
    url.searchParams.set("title", "Issue: [Brief Description]");
    url.searchParams.set("body", body);

    void shell.openExternal(url.toString());
  }

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

  private handleOpenHomepage(): void {
    const homepage = AISettingsStore.getInstance().getSettings().homepage;
    if (this.mainWindow.activeTab) {
      void this.mainWindow.activeTab.loadURL(homepage);
      return;
    }
    this.mainWindow.createTab(homepage);
  }

  private handleDuplicateTab(): void {
    const currentUrl = this.mainWindow.activeTab?.url;
    this.mainWindow.createTab(currentUrl);
  }

  private handleOpenWelcomePage(): void {
    if (this.mainWindow.activeTab) {
      void this.mainWindow.activeTab.loadURL("browso://welcome");
      return;
    }
    this.mainWindow.createTab("browso://welcome");
  }

  private handleCopyCurrentUrl(): void {
    const currentUrl = this.mainWindow.activeTab?.url;
    if (!currentUrl) {
      return;
    }
    clipboard.writeText(currentUrl);
  }

  private handleOpenCurrentPageInDefaultBrowser(): void {
    const currentUrl = this.mainWindow.activeTab?.url;
    if (!currentUrl || !/^https?:\/\//.test(currentUrl)) {
      return;
    }
    void shell.openExternal(currentUrl);
  }

  private handleToggleSplitView(): void {
    this.mainWindow.toggleSplitView();
  }

  private handleOpenExternal(url: string): void {
    void shell.openExternal(url);
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
