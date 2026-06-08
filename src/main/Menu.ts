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
import { UpdateManager } from "./UpdateManager";
import { ProfileContextStore } from "./ProfileContextStore";
import { AgentModeRegistry } from "./AgentModes";

export class AppMenu {
  private mainWindow: Window;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.createMenu();
  }

  private createMenu(): void {
    const isMac = process.platform === "darwin";
    const profileStore = ProfileContextStore.getInstance();
    const { profiles, activeProfileId } = profileStore.getState();

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
            label: "New Window",
            accelerator: "CmdOrCtrl+N",
            click: () => this.handleNotImplemented("New Window"),
          },
          { type: "separator" },
          {
            label: "Close Tab",
            accelerator: "CmdOrCtrl+W",
            click: () => this.handleCloseTab(),
          },
          {
            label: "Close Window",
            accelerator: "CmdOrCtrl+Shift+W",
            role: "close",
          },
          { type: "separator" },
          {
            label: "Save Page As…",
            accelerator: "CmdOrCtrl+Shift+S",
            click: () => this.handleNotImplemented("Save Page As"),
          },
          {
            label: "Print…",
            accelerator: "CmdOrCtrl+P",
            click: () => this.handlePrint(),
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
          { type: "separator" },
          {
            label: "Find in Page…",
            accelerator: "CmdOrCtrl+F",
            click: () => this.handleNotImplemented("Find in Page"),
          },
        ],
      },
      {
        label: "View",
        submenu: [
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
            label: "Zoom",
            submenu: [
              {
                label: "Zoom In",
                accelerator: "CmdOrCtrl+Plus",
                role: "zoomIn",
              },
              {
                label: "Zoom Out",
                accelerator: "CmdOrCtrl+-",
                role: "zoomOut",
              },
              {
                label: "Actual Size",
                accelerator: "CmdOrCtrl+0",
                role: "resetZoom",
              },
            ],
          },
          { type: "separator" },
          {
            label: "Appearance",
            submenu: [
              {
                label: "Toggle Sidebar",
                accelerator: "CmdOrCtrl+E",
                click: () => this.handleToggleSidebar(),
              },
              {
                label: "Toggle Split View",
                accelerator: "CmdOrCtrl+\\",
                click: () => this.handleToggleSplitView(),
              },
              { type: "separator" },
              {
                label: "Show Address Bar",
                type: "checkbox",
                checked: true,
                click: () => this.handleNotImplemented("Toggle UI Elements"),
              },
              {
                label: "Show Tab Bar",
                type: "checkbox",
                checked: true,
                click: () => this.handleNotImplemented("Toggle UI Elements"),
              },
            ],
          },
          { type: "separator" },
          {
            label: "Toggle Fullscreen",
            accelerator: isMac ? "Ctrl+Command+F" : "F11",
            click: () => this.handleToggleFullscreen(),
          },
        ],
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
          { type: "separator" },
          {
            label: "History",
            click: () => this.handleNotImplemented("History View"),
          },
          {
            label: "Downloads",
            click: () => this.handleNotImplemented("Downloads View"),
          },
        ],
      },
      {
        label: "Intelligence",
        submenu: [
          {
            label: "Summarize Page",
            accelerator: "CmdOrCtrl+Shift+S",
            click: () => this.handleAIRun("Summarize this page"),
          },
          {
            label: "Research This Topic",
            accelerator: "CmdOrCtrl+Shift+L",
            click: () => this.handleAIDraft("Research this topic: "),
          },
          {
            label: "Compare Current Tabs",
            click: () =>
              this.handleAIRun(
                "Compare the products or source material visible across my open tabs",
              ),
          },
          { type: "separator" },
          {
            label: "Agent Persona",
            submenu: AgentModeRegistry.list().map((mode) => ({
              label: mode.label,
              type: "radio",
              checked: mode.id === "copilot", // Default mode
              click: () =>
                this.handleNotImplemented(`Switching to ${mode.label} persona`),
            })),
          },
          { type: "separator" },
          {
            label: "Advanced Analysis",
            submenu: [
              {
                label: "Analyze Security Risks",
                click: () =>
                  this.handleAIRun(
                    "Analyze the security risks and phishing signals of this website",
                  ),
              },
              {
                label: "Detect Dark Patterns",
                click: () =>
                  this.handleAIRun(
                    "Identify any dark patterns or manipulative UI on this page",
                  ),
              },
              {
                label: "Extract Structured Data",
                click: () =>
                  this.handleAIRun(
                    "Extract all structured records and data entities from this page into a JSON table",
                  ),
              },
            ],
          },
        ],
      },
      {
        label: "Profiles",
        submenu: [
          ...profiles.map((profile) => ({
            label: profile.name,
            type: "radio" as const,
            checked: profile.id === activeProfileId,
            click: () => this.handleSwitchProfile(profile.id),
          })),
          { type: "separator" },
          {
            label: "Manage Profiles…",
            click: () => this.handleOpenSettings(),
          },
          {
            label: "New Private Session",
            accelerator: "CmdOrCtrl+Shift+P",
            click: () => this.handleNotImplemented("Private Session"),
          },
        ],
      },
      {
        label: "Knowledge",
        submenu: [
          {
            label: "Save Page to Library",
            accelerator: "CmdOrCtrl+S",
            click: () => this.handleSavePage(),
          },
          {
            label: "Search Local Library",
            accelerator: "CmdOrCtrl+Option+F",
            click: () => this.handleAIDraft("Search my saved knowledge for "),
          },
          { type: "separator" },
          {
            label: "View All Notes",
            click: () => this.handleAIRun("/notes"),
          },
          {
            label: "Knowledge Graph View",
            click: () => this.handleNotImplemented("Knowledge Graph"),
          },
          { type: "separator" },
          {
            label: "Import from Chrome/Safari…",
            click: () => this.handleNotImplemented("Data Import"),
          },
          {
            label: "Export Library…",
            click: () => this.handleNotImplemented("Data Export"),
          },
        ],
      },
      {
        label: "Security",
        submenu: [
          {
            label: "Security Dashboard",
            click: () => this.handleNotImplemented("Security Dashboard"),
          },
          { type: "separator" },
          {
            label: "Isolation Level",
            submenu: [
              {
                label: "Standard (Fast)",
                type: "radio",
                checked: true,
                click: () => {},
              },
              { label: "Strict (Secure)", type: "radio", click: () => {} },
              { label: "Lockdown (Ultra)", type: "radio", click: () => {} },
            ],
          },
          {
            label: "Navigation Policy",
            submenu: [
              {
                label: "Allow All",
                type: "radio",
                checked: true,
                click: () => {},
              },
              { label: "Block Third-Party", type: "radio", click: () => {} },
              { label: "Allow-List Only", type: "radio", click: () => {} },
            ],
          },
          { type: "separator" },
          {
            label: "View Sandbox State",
            click: () => this.handleNotImplemented("Sandbox Inspector"),
          },
          {
            label: "Clear All Site Data…",
            click: () => this.handleClearData(),
          },
        ],
      },
      {
        label: "Automation",
        submenu: [
          {
            label: "Stop All Tasks",
            accelerator: "Esc",
            click: () => this.handleStopTasks(),
          },
          { type: "separator" },
          {
            label: "Computer Use Sandbox",
            type: "checkbox",
            checked: true,
            click: () => this.handleNotImplemented("Sandbox Toggle"),
          },
          {
            label: "Show Reasoning Trace",
            type: "checkbox",
            checked: false,
            click: () => this.handleNotImplemented("Reasoning Trace"),
          },
          { type: "separator" },
          {
            label: "Automation Logs",
            click: () => this.handleNotImplemented("Automation Logs"),
          },
          {
            label: "Schedule Recurring Task…",
            click: () => this.handleNotImplemented("Scheduling"),
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
            label: "Extensions",
            click: () => this.handleNotImplemented("Extensions"),
          },
          { type: "separator" },
          {
            label: "Developer",
            submenu: [
              {
                label: "Toggle Developer Tools",
                accelerator: isMac ? "Alt+Command+I" : "Ctrl+Shift+I",
                click: () => this.handleToggleDevTools(),
              },
              {
                label: "Inspect SideBar",
                click: () =>
                  this.mainWindow.sidebar.view.webContents.openDevTools({
                    mode: "detach",
                  }),
              },
              {
                label: "Inspect TopBar",
                click: () =>
                  this.mainWindow.topBar.view.webContents.openDevTools({
                    mode: "detach",
                  }),
              },
            ],
          },
          ...(!isMac
            ? [
                { type: "separator" } satisfies MenuItemConstructorOptions,
                {
                  label: "Settings…",
                  accelerator: "CmdOrCtrl+,",
                  click: () => this.handleOpenSettings(),
                } satisfies MenuItemConstructorOptions,
              ]
            : []),
        ],
      },
      {
        label: "Window",
        role: "windowMenu",
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
            label: "Documentation",
            click: () => this.handleDocumentation(),
          },
          {
            label: "Keyboard Shortcuts",
            click: () => this.handleKeyboardShortcuts(),
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
          { type: "separator" },
          {
            label: "Check for Updates…",
            click: () => this.handleCheckForUpdates(),
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  // Menu action handlers
  private handleSwitchProfile(profileId: string): void {
    ProfileContextStore.getInstance().switchProfile(profileId);
    this.mainWindow.switchProfile(profileId);
    this.createMenu(); // Refresh menu state
  }

  private handleAIRun(message: string): void {
    void this.mainWindow.sidebar.openAndRun(message);
  }

  private handleAIDraft(prefix: string): void {
    this.mainWindow.sidebar.openWithDraft(prefix);
  }

  private handleSavePage(): void {
    void this.mainWindow.sidebar.openAndRun("/save");
  }

  private handleStopTasks(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.stop();
    }
  }

  private handleNotImplemented(feature: string): void {
    void dialog.showMessageBox(this.mainWindow.baseWindow, {
      type: "info",
      title: "Coming Soon",
      message: `${feature} is not yet available in the current version of Browso.`,
      detail:
        "We are working hard to bring this feature to you in a future update.",
      buttons: ["OK"],
    });
  }

  private handlePrint(): void {
    if (this.mainWindow.activeTab) {
      this.mainWindow.activeTab.webContents.print();
    }
  }

  private async handleClearData(): Promise<void> {
    const { response } = await dialog.showMessageBox(
      this.mainWindow.baseWindow,
      {
        type: "warning",
        buttons: ["Clear Data", "Cancel"],
        defaultId: 0,
        cancelId: 1,
        title: "Clear Browsing Data",
        message: "Are you sure you want to clear browsing data?",
        detail:
          "This will clear cookies, local storage, and cache for the current profile.",
      },
    );

    if (response === 0) {
      const session = this.mainWindow.activeTab?.webContents.session;
      if (session) {
        await session.clearStorageData();
        await session.clearCache();
        void dialog.showMessageBox(this.mainWindow.baseWindow, {
          type: "info",
          title: "Data Cleared",
          message: "Browsing data has been successfully cleared.",
          buttons: ["OK"],
        });
      }
    }
  }

  private handleDocumentation(): void {
    void this.handleOpenExternal("https://browso.org/docs/");
  }

  private handleKeyboardShortcuts(): void {
    void this.handleOpenExternal("https://browso.org/docs/commands.html");
  }

  private async handleCheckForUpdates(): Promise<void> {
    await UpdateManager.getInstance().checkForUpdates({
      mainWindow: this.mainWindow,
      promptUser: true,
    });
  }

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
