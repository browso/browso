import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  RefreshCw,
  Loader2,
  Columns2,
} from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { ToolBarButton } from "../components/ToolBarButton";
import { Favicon } from "../components/Favicon";
import { cn } from "@common/lib/utils";

const INTERNAL_WELCOME_URLS = new Set([
  "browso://welcome",
  "blueberry://welcome",
]);

type SearchEngine = "google" | "duckduckgo" | "bing";

interface AddressTab {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface AddressFieldProps {
  tab: AddressTab | null;
  searchEngine: SearchEngine;
  isLoading: boolean;
  isSplitPane?: boolean;
  onActivate: (tabId: string) => Promise<void>;
  onNavigate: (tabId: string, url: string) => Promise<void>;
}

function normalizeNavigationTarget(
  value: string,
  searchEngine: SearchEngine,
): string {
  let finalUrl = value.trim();

  if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
    if (finalUrl.includes(".") && !finalUrl.includes(" ")) {
      finalUrl = `https://${finalUrl}`;
    } else {
      const encoded = encodeURIComponent(finalUrl);
      if (searchEngine === "duckduckgo") {
        finalUrl = `https://duckduckgo.com/?q=${encoded}`;
      } else if (searchEngine === "bing") {
        finalUrl = `https://www.bing.com/search?q=${encoded}`;
      } else {
        finalUrl = `https://www.google.com/search?q=${encoded}`;
      }
    }
  }

  return finalUrl;
}

function getDomain(tab: AddressTab | null): string {
  if (!tab?.url) return "";
  if (INTERNAL_WELCOME_URLS.has(tab.url)) return "Browso";
  try {
    const urlObj = new URL(tab.url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return tab.url;
  }
}

function getPath(tab: AddressTab | null): string {
  if (!tab?.url) return "";
  if (INTERNAL_WELCOME_URLS.has(tab.url)) return "";
  try {
    const urlObj = new URL(tab.url);
    return urlObj.pathname + urlObj.search + urlObj.hash;
  } catch {
    return "";
  }
}

function getFavicon(tab: AddressTab | null): string | null {
  if (!tab?.url) return null;
  if (INTERNAL_WELCOME_URLS.has(tab.url)) return null;
  try {
    const domain = new URL(tab.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

const AddressField: React.FC<AddressFieldProps> = ({
  tab,
  searchEngine,
  isLoading,
  isSplitPane = false,
  onActivate,
  onNavigate,
}) => {
  const [url, setUrl] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setUrl(tab?.url || "");
    }
  }, [tab?.url, isFocused]);

  const activateTab = (): void => {
    if (tab && !tab.isActive) {
      void onActivate(tab.id);
    }
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!tab || !url.trim()) return;

    const finalUrl = normalizeNavigationTarget(url, searchEngine);
    void onNavigate(tab.id, finalUrl);
    setIsFocused(false);
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleFocus = (): void => {
    activateTab();
    setIsFocused(true);
  };

  const handleBlur = (): void => {
    setIsFocused(false);
    setUrl(tab?.url || "");
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "Escape") {
      setIsFocused(false);
      setUrl(tab?.url || "");
      (event.target as HTMLInputElement).blur();
    }
  };

  if (isFocused) {
    return (
      <form
        onSubmit={handleSubmit}
        className={cn("min-w-0 max-w-full", isSplitPane ? "flex-1" : "flex-1")}
      >
        <div
          className={cn(
            "h-8 rounded-md border bg-card px-3 shadow-sm transition-colors",
            tab?.isActive ? "border-primary/45" : "border-border",
          )}
        >
          <input
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-full w-full bg-transparent text-[0.8rem] text-foreground outline-none"
            placeholder={tab ? "Enter URL or search term" : "No active tab"}
            disabled={!tab || isLoading}
            spellCheck={false}
            autoFocus
          />
        </div>
      </form>
    );
  }

  return (
    <div
      onClick={handleFocus}
      className={cn(
        "min-w-0 px-3 h-8 rounded-md border cursor-text group/address-bar",
        "bg-card text-muted-foreground app-region-no-drag shadow-sm",
        "hover:bg-card transition-colors duration-200",
        isSplitPane ? "flex-1" : "flex-1",
        tab?.isActive ? "border-primary/45" : "border-border",
      )}
    >
      <div className="flex h-full items-center">
        <div className="size-4 mr-2">
          <Favicon src={getFavicon(tab)} />
        </div>

        <div className="text-[0.8rem] leading-normal truncate flex-1">
          {tab ? (
            <>
              <span className="text-foreground dark:text-foreground">
                {getDomain(tab)}
              </span>
              <span className="group-hover/address-bar:hidden text-muted-foreground/60">
                {tab.title && ` / ${tab.title}`}
              </span>
              <span className="group-hover/address-bar:inline hidden text-muted-foreground/60">
                {getPath(tab)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No active tab</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const AddressBar: React.FC = () => {
  const {
    activeTab,
    splitTabs,
    isSplitView,
    navigateTabToUrl,
    goBack,
    goForward,
    reload,
    switchTab,
    toggleSplitView,
    isLoading,
  } = useBrowser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchEngine, setSearchEngine] = useState<SearchEngine>("google");

  useEffect(() => {
    const removeAppSettingsListener = window.topBarAPI.onAppSettingsUpdated(
      (settings) => setSearchEngine(settings.searchEngine),
    );
    const loadState = async (): Promise<void> => {
      try {
        const settings = await window.topBarAPI.getAppSettings();
        setSearchEngine(settings.searchEngine);
      } catch (error) {
        console.error("Failed to load top bar state:", error);
      }
    };

    void loadState();

    return () => {
      removeAppSettingsListener();
    };
  }, []);

  const canGoBack = Boolean(activeTab?.canGoBack);
  const canGoForward = Boolean(activeTab?.canGoForward);

  const toggleSidebar = (): void => {
    setIsSidebarOpen(!isSidebarOpen);
    if (window.topBarAPI) {
      void window.topBarAPI.toggleSidebar();
    }
  };

  const addressTabs = isSplitView ? splitTabs : [activeTab];

  return (
    <>
      <div className="flex gap-1.5 app-region-no-drag">
        <ToolBarButton
          Icon={ArrowLeft}
          onClick={goBack}
          active={canGoBack && !isLoading}
        />
        <ToolBarButton
          Icon={ArrowRight}
          onClick={goForward}
          active={canGoForward && !isLoading}
        />
        <ToolBarButton
          onClick={reload}
          active={activeTab !== null && !isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-4.5 animate-spin" />
          ) : (
            <RefreshCw className="size-4.5" />
          )}
        </ToolBarButton>
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-1 gap-1.5",
          isSplitView && "rounded-md",
        )}
      >
        {addressTabs.map((tab, index) => (
          <AddressField
            key={tab?.id ?? `empty-${index}`}
            tab={tab}
            searchEngine={searchEngine}
            isLoading={isLoading}
            isSplitPane={isSplitView}
            onActivate={switchTab}
            onNavigate={navigateTabToUrl}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 app-region-no-drag">
        <ToolBarButton
          Icon={Columns2}
          onClick={toggleSplitView}
          toggled={isSplitView}
          active={activeTab !== null && !isLoading}
        />
        <ToolBarButton
          Icon={Bot}
          onClick={toggleSidebar}
          toggled={isSidebarOpen}
        />
      </div>
    </>
  );
};
