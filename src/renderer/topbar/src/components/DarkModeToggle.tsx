import React from "react";
import { Moon, Sun } from "lucide-react";
import { ToolBarButton } from "../components/ToolBarButton";
import { useDarkMode } from "../../../common/hooks/useDarkMode";

export const DarkModeToggle: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <ToolBarButton
      Icon={isDarkMode ? Sun : Moon}
      onClick={toggleDarkMode}
      className="transition-transform"
    />
  );
};
