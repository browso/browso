import React, { useEffect } from "react";
import { Chat } from "./components/Chat";
import { useDarkMode } from "@common/hooks/useDarkMode";

const SidebarContent: React.FC = () => {
  const { isDarkMode } = useDarkMode();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <div className="flex h-screen flex-col border-l border-border bg-background">
      <Chat />
    </div>
  );
};

export const SidebarApp: React.FC = () => {
  return <SidebarContent />;
};
