import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
  isSplit: boolean;
  splitIndex: number | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface BrowserContextType {
  tabs: TabInfo[];
  activeTab: TabInfo | null;
  splitTabs: TabInfo[];
  isSplitView: boolean;
  isLoading: boolean;

  // Tab management
  createTab: (url?: string) => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  switchTab: (tabId: string) => Promise<void>;
  toggleSplitView: () => Promise<void>;
  refreshTabs: () => Promise<void>;

  // Navigation
  navigateToUrl: (url: string) => Promise<void>;
  navigateTabToUrl: (tabId: string, url: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;

  // Tab actions
  takeScreenshot: (tabId: string) => Promise<string | null>;
}

const BrowserContext = createContext<BrowserContextType | null>(null);

export const useBrowser = (): BrowserContextType => {
  const context = useContext(BrowserContext);
  if (!context) {
    throw new Error("useBrowser must be used within a BrowserProvider");
  }
  return context;
};

export const BrowserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeTab = tabs.find((tab) => tab.isActive) || null;
  const splitTabs = tabs
    .filter((tab) => tab.isSplit)
    .sort((left, right) => (left.splitIndex ?? 0) - (right.splitIndex ?? 0));
  const isSplitView = splitTabs.length > 1;

  const refreshTabs = useCallback(async () => {
    try {
      const tabsData = await window.topBarAPI.getTabs();
      setTabs(tabsData);
    } catch (error) {
      console.error("Failed to refresh tabs:", error);
    }
  }, []);

  const createTab = useCallback(
    async (url?: string) => {
      setIsLoading(true);
      try {
        await window.topBarAPI.createTab(url);
        await refreshTabs();
      } catch (error) {
        console.error("Failed to create tab:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshTabs],
  );

  const closeTab = useCallback(
    async (tabId: string) => {
      setIsLoading(true);
      try {
        await window.topBarAPI.closeTab(tabId);
        await refreshTabs();
      } catch (error) {
        console.error("Failed to close tab:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshTabs],
  );

  const switchTab = useCallback(
    async (tabId: string) => {
      setIsLoading(true);
      try {
        await window.topBarAPI.switchTab(tabId);
        await refreshTabs();
      } catch (error) {
        console.error("Failed to switch tab:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshTabs],
  );

  const toggleSplitView = useCallback(async () => {
    setIsLoading(true);
    try {
      await window.topBarAPI.toggleSplitView();
      await refreshTabs();
    } catch (error) {
      console.error("Failed to toggle split view:", error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshTabs]);

  const navigateToUrl = useCallback(
    async (url: string) => {
      if (!activeTab) return;

      setIsLoading(true);
      try {
        await window.topBarAPI.navigateTab(activeTab.id, url);
        // Wait a bit for navigation to start, then refresh tabs to get updated URL
        setTimeout(() => refreshTabs(), 500);
      } catch (error) {
        console.error("Failed to navigate:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab, refreshTabs],
  );

  const navigateTabToUrl = useCallback(
    async (tabId: string, url: string) => {
      setIsLoading(true);
      try {
        await window.topBarAPI.switchTab(tabId);
        await window.topBarAPI.navigateTab(tabId, url);
        setTimeout(() => refreshTabs(), 500);
      } catch (error) {
        console.error("Failed to navigate tab:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshTabs],
  );

  const goBack = useCallback(async () => {
    if (!activeTab) return;

    try {
      await window.topBarAPI.goBack(activeTab.id);
      setTimeout(() => refreshTabs(), 500);
    } catch (error) {
      console.error("Failed to go back:", error);
    }
  }, [activeTab, refreshTabs]);

  const goForward = useCallback(async () => {
    if (!activeTab) return;

    try {
      await window.topBarAPI.goForward(activeTab.id);
      setTimeout(() => refreshTabs(), 500);
    } catch (error) {
      console.error("Failed to go forward:", error);
    }
  }, [activeTab, refreshTabs]);

  const reload = useCallback(async () => {
    if (!activeTab) return;

    try {
      await window.topBarAPI.reload(activeTab.id);
      setTimeout(() => refreshTabs(), 500);
    } catch (error) {
      console.error("Failed to reload:", error);
    }
  }, [activeTab, refreshTabs]);

  const takeScreenshot = useCallback(async (tabId: string) => {
    try {
      return await window.topBarAPI.tabScreenshot(tabId);
    } catch (error) {
      console.error("Failed to take screenshot:", error);
      return null;
    }
  }, []);

  // Initialize tabs on mount
  useEffect(() => {
    refreshTabs();
  }, [refreshTabs]);

  // Periodic refresh to keep tabs in sync
  useEffect(() => {
    const interval = setInterval(refreshTabs, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, [refreshTabs]);

  const value: BrowserContextType = {
    tabs,
    activeTab,
    splitTabs,
    isSplitView,
    isLoading,
    createTab,
    closeTab,
    switchTab,
    toggleSplitView,
    refreshTabs,
    navigateToUrl,
    navigateTabToUrl,
    goBack,
    goForward,
    reload,
    takeScreenshot,
  };

  return (
    <BrowserContext.Provider value={value}>{children}</BrowserContext.Provider>
  );
};
