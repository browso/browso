import { BaseWindow, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { AISettingsStore } from "./AISettings";
import { BrowserSettings } from "./BrowserSettings";
import { attachExternalWindowOpenHandler } from "./windowOpenHandler";
import { APP_ICON_PATH } from "./appIcon";
import { ProfileContextStore } from "./ProfileContextStore";

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private splitTabIds: [string, string] | null = null;
  private tabCounter: number = 0;
  private _topBar: TopBar;
  private _sideBar: SideBar;
  private _browserSettings: BrowserSettings;
  private activeProfileId: string;

  constructor(options: { show?: boolean } = {}) {
    // Create the browser window.
    this._baseWindow = new BaseWindow({
      width: 1000,
      height: 800,
      show: options.show ?? true,
      autoHideMenuBar: false,
      icon: APP_ICON_PATH,
      titleBarStyle: "hidden",
      ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
      trafficLightPosition: { x: 15, y: 13 },
    });

    this._baseWindow.setMinimumSize(1000, 800);

    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);
    this._browserSettings = new BrowserSettings(this._baseWindow);
    this.activeProfileId =
      ProfileContextStore.getInstance().getState().activeProfileId;

    // Set the window reference on the LLM client to avoid circular dependency
    this._sideBar.client.setWindow(this);
    this._sideBar.initializeFeatureManagers(() => this.activeTab);

    // Create the first tab
    this.createTab();

    // Set up window resize handler
    this._baseWindow.on("resize", () => {
      this.updateTabBounds();
      this._topBar.updateBounds();
      this._sideBar.updateBounds();
      this._browserSettings.updateBounds();
      // Notify renderer of resize through active tab
      const bounds = this._baseWindow.getBounds();
      if (this.activeTab) {
        this.activeTab.webContents.send("window-resized", {
          width: bounds.width,
          height: bounds.height,
        });
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      // Clean up all tabs when window is closed
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });
  }

  // Getters
  get window(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return Array.from(this.tabsMap.values()).filter(
      (tab) => tab.profileId === this.activeProfileId,
    );
  }

  get tabCount(): number {
    return this.allTabs.length;
  }

  // Tab management methods
  createTab(url?: string): Tab {
    const initialUrl =
      url || AISettingsStore.getInstance().getSettings().homepage;
    const tabId = `tab-${++this.tabCounter}`;
    const tab = new Tab(tabId, this.activeProfileId, initialUrl, (message) => {
      this._sideBar.openWithDraft(message);
      this.updateAllBounds();
    });
    attachExternalWindowOpenHandler(tab.webContents, shell.openExternal);
    tab.webContents.on("focus", () => {
      if (this.isTabVisible(tabId)) {
        this.activeTabId = tabId;
        this._baseWindow.setTitle(tab.title || "Browso");
      }
    });

    // Add the tab's WebContentsView to the window
    this._baseWindow.contentView.addChildView(tab.view);

    // Store the tab
    this.tabsMap.set(tabId, tab);

    // If this is the first tab, make it active
    if (this.allTabs.length === 1) {
      this.switchActiveTab(tabId);
    } else {
      // Hide the tab initially if it's not the first one
      tab.hide();
    }

    this.updateTabBounds();
    return tab;
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab || tab.profileId !== this.activeProfileId) {
      return false;
    }

    // Remove the WebContentsView from the window
    this._baseWindow.contentView.removeChildView(tab.view);

    // Destroy the tab
    tab.destroy();

    // Remove from our tabs map
    this.tabsMap.delete(tabId);
    this.removeTabFromSplit(tabId);

    // If this was the active tab, switch to another tab
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = this.allTabs.map((entry) => entry.id);
      if (remainingTabs.length > 0) {
        this.switchActiveTab(remainingTabs[0]);
      }
    }

    if (this.allTabs.length === 0) {
      this.createTab();
    }
    this.updateTabBounds();

    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab || tab.profileId !== this.activeProfileId) {
      return false;
    }

    if (this.splitTabIds && !this.splitTabIds.includes(tabId)) {
      const activeSplitIndex = this.activeTabId === this.splitTabIds[1] ? 1 : 0;
      const replacedTabId = this.splitTabIds[activeSplitIndex];
      const replacedTab = this.tabsMap.get(replacedTabId);
      if (replacedTab) {
        replacedTab.hide();
      }
      this.splitTabIds[activeSplitIndex] = tabId;
    } else if (
      !this.splitTabIds &&
      this.activeTabId &&
      this.activeTabId !== tabId
    ) {
      const currentTab = this.tabsMap.get(this.activeTabId);
      if (currentTab) {
        currentTab.hide();
      }
    }

    // Show the new active tab
    tab.show();
    this.activeTabId = tabId;
    this.updateTabBounds();

    // Update the window title to match the tab title
    this._baseWindow.setTitle(tab.title || "Browso");

    return true;
  }

  toggleSplitView(url?: string): boolean {
    if (this.splitTabIds) {
      const activeTab = this.activeTab;
      this.splitTabIds = null;
      this.tabsMap.forEach((tab) => {
        if (activeTab && tab.id === activeTab.id) {
          tab.show();
        } else {
          tab.hide();
        }
      });
      this.updateTabBounds();
      return false;
    }

    let leftTab = this.activeTab;
    if (!leftTab) {
      leftTab = this.createTab();
    }

    const rightTab = this.createTab(url);
    this.splitTabIds = [leftTab.id, rightTab.id];
    this.activeTabId = rightTab.id;
    leftTab.show();
    rightTab.show();
    this.updateTabBounds();
    this._baseWindow.setTitle(rightTab.title || "Browso");
    return true;
  }

  getSplitState(): { isSplit: boolean; tabIds: string[] } {
    return {
      isSplit: this.splitTabIds !== null,
      tabIds: this.splitTabIds ? [...this.splitTabIds] : [],
    };
  }

  getTab(tabId: string): Tab | null {
    const tab = this.tabsMap.get(tabId);
    return tab?.profileId === this.activeProfileId ? tab : null;
  }

  switchProfile(profileId: string): void {
    if (profileId === this.activeProfileId) {
      return;
    }

    this.tabsMap.forEach((tab) => tab.hide());
    this.activeProfileId = profileId;
    this.activeTabId = null;
    this.splitTabIds = null;

    const profileTabs = this.allTabs;
    const nextTab = profileTabs[0] ?? this.createTab();
    this.switchActiveTab(nextTab.id);
  }

  // Window methods
  show(): void {
    this._baseWindow.show();
  }

  hide(): void {
    this._baseWindow.hide();
  }

  close(): void {
    this._baseWindow.close();
  }

  focus(): void {
    this._baseWindow.focus();
  }

  minimize(): void {
    this._baseWindow.minimize();
  }

  maximize(): void {
    this._baseWindow.maximize();
  }

  unmaximize(): void {
    this._baseWindow.unmaximize();
  }

  isMaximized(): boolean {
    return this._baseWindow.isMaximized();
  }

  setTitle(title: string): void {
    this._baseWindow.setTitle(title);
  }

  setBounds(bounds: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }): void {
    this._baseWindow.setBounds(bounds);
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return this._baseWindow.getBounds();
  }

  // Handle window resize to update tab bounds
  private updateTabBounds(): void {
    const bounds = this._baseWindow.getBounds();
    const sidebarWidth = this.getVisibleSidebarWidth();
    const contentWidth = bounds.width - sidebarWidth;
    const contentHeight = bounds.height - 88;

    if (this.splitTabIds) {
      const [leftTabId, rightTabId] = this.splitTabIds;
      const leftTab = this.tabsMap.get(leftTabId);
      const rightTab = this.tabsMap.get(rightTabId);
      const leftWidth = Math.floor(contentWidth / 2);
      const rightWidth = contentWidth - leftWidth;

      this.tabsMap.forEach((tab) => {
        if (tab.id !== leftTabId && tab.id !== rightTabId) {
          tab.hide();
        }
      });

      if (leftTab) {
        leftTab.view.setBounds({
          x: 0,
          y: 88,
          width: leftWidth,
          height: contentHeight,
        });
        leftTab.show();
      }

      if (rightTab) {
        rightTab.view.setBounds({
          x: leftWidth,
          y: 88,
          width: rightWidth,
          height: contentHeight,
        });
        rightTab.show();
      }

      return;
    }

    this.tabsMap.forEach((tab) => {
      if (tab.profileId !== this.activeProfileId) {
        tab.hide();
        return;
      }
      tab.view.setBounds({
        x: 0,
        y: 88, // Start below the topbar
        width: contentWidth,
        height: contentHeight, // Subtract topbar height
      });
    });
  }

  // Public method to update all bounds when sidebar is toggled
  updateAllBounds(): void {
    this.updateTabBounds();
    this._sideBar.updateBounds();
    this._browserSettings.updateBounds();
  }

  setSidebarWidth(width: number): number {
    const nextWidth = this._sideBar.setWidth(width);
    this.updateAllBounds();
    return nextWidth;
  }

  getSidebarState(): {
    width: number;
    minWidth: number;
    maxWidth: number;
    isVisible: boolean;
  } {
    return {
      width: this._sideBar.getWidth(),
      minWidth: this._sideBar.getMinWidth(),
      maxWidth: this._sideBar.getMaxWidth(),
      isVisible: this._sideBar.getIsVisible(),
    };
  }

  private getVisibleSidebarWidth(): number {
    return this._sideBar.getIsVisible() ? this._sideBar.getWidth() : 0;
  }

  private isTabVisible(tabId: string): boolean {
    if (this.splitTabIds) {
      return this.splitTabIds.includes(tabId);
    }
    return this.activeTabId === tabId;
  }

  private removeTabFromSplit(tabId: string): void {
    if (!this.splitTabIds?.includes(tabId)) {
      return;
    }

    const remainingSplitTabId = this.splitTabIds.find((id) => id !== tabId);
    this.splitTabIds = null;

    if (remainingSplitTabId && this.tabsMap.has(remainingSplitTabId)) {
      this.activeTabId = remainingSplitTabId;
      this.tabsMap.forEach((tab) => {
        if (tab.id === remainingSplitTabId) {
          tab.show();
        } else {
          tab.hide();
        }
      });
    }
  }

  // Getter for sidebar to access from main process
  get sidebar(): SideBar {
    return this._sideBar;
  }

  // Getter for topBar to access from main process
  get topBar(): TopBar {
    return this._topBar;
  }

  get browserSettings(): BrowserSettings {
    return this._browserSettings;
  }

  // Getter for all tabs as array
  get tabs(): Tab[] {
    return this.allTabs;
  }

  // Getter for baseWindow to access from Menu
  get baseWindow(): BaseWindow {
    return this._baseWindow;
  }
}
