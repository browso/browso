import React from "react";
import { Plus, X } from "lucide-react";
import { useBrowser } from "../contexts/BrowserContext";
import { Favicon } from "../components/Favicon";
import { TabBarButton } from "../components/TabBarButton";
import { cn } from "@common/lib/utils";

const INTERNAL_WELCOME_URLS = new Set([
  "browso://welcome",
  "blueberry://welcome",
]);
const BROWSO_ICON_URL = "/icon.png";

interface TabItemProps {
  id: string;
  title: string;
  favicon?: string | null;
  isActive: boolean;
  isSplit: boolean;
  isPinned?: boolean;
  onClose: () => void;
  onActivate: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  title,
  favicon,
  isActive,
  isSplit,
  isPinned = false,
  onClose,
  onActivate,
}) => {
  const baseClassName = cn(
    "relative flex items-center h-8 pl-2 pr-1.5 select-none rounded-xl border",
    "text-primary group/tab transition-colors duration-200 cursor-pointer",
    "app-region-no-drag", // Make tabs clickable
    isActive
      ? "border-border bg-background shadow-sm dark:shadow-none"
      : "border-transparent bg-transparent hover:border-border/80 hover:bg-secondary/70",
    isSplit && !isActive && "border-border/70 bg-background/70",
    isPinned ? "w-8 !px-0 justify-center" : "",
  );

  return (
    <div className="py-1 px-1">
      <div className={baseClassName} onClick={() => !isActive && onActivate()}>
        {/* Favicon */}
        <div className={cn(!isPinned && "mr-2")}>
          <Favicon src={favicon} />
        </div>

        {/* Title (hide for pinned tabs) */}
        {!isPinned && (
          <span className="text-xs truncate max-w-[200px] flex-1">
            {title || "New Tab"}
          </span>
        )}

        {/* Close button (shows on hover) */}
        {!isPinned && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className={cn(
              "flex-shrink-0 p-1 rounded-md transition-opacity",
              "hover:bg-black/5 dark:hover:bg-white/10",
              "opacity-0 group-hover/tab:opacity-100",
              isActive && "opacity-100",
            )}
          >
            <X className="size-3 text-primary dark:text-primary" />
          </div>
        )}
      </div>
    </div>
  );
};

export const TabBar: React.FC = () => {
  const { tabs, createTab, closeTab, switchTab } = useBrowser();

  const handleCreateTab = (): void => {
    createTab("https://www.google.com");
  };

  // Extract favicon from URL (simplified - you might want to improve this)
  const getFavicon = (url: string): string | null => {
    if (INTERNAL_WELCOME_URLS.has(url)) {
      return BROWSO_ICON_URL;
    }

    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden flex items-center rounded-t-2xl border border-border/70 bg-muted/70 px-2 dark:border-border/80 dark:bg-secondary/60">
      {/* macOS traffic lights spacing */}
      <div className="pl-20" />

      {/* Tabs */}
      <div className="flex-1 overflow-x-auto flex">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            id={tab.id}
            title={tab.title}
            favicon={getFavicon(tab.url)}
            isActive={tab.isActive}
            isSplit={tab.isSplit}
            onClose={() => closeTab(tab.id)}
            onActivate={() => switchTab(tab.id)}
          />
        ))}
      </div>

      {/* Add Tab Button */}
      <div className="pl-1 pr-2">
        <TabBarButton Icon={Plus} onClick={handleCreateTab} />
      </div>
    </div>
  );
};
