import { useState, useEffect } from "react";

interface DarkModeState {
  isDarkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleDarkMode: () => void;
}

export const useDarkMode = (): DarkModeState => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check if dark mode preference exists in localStorage
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      return JSON.parse(savedMode) as boolean;
    }
    // Otherwise check system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    // Apply or remove dark class on document root
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Save preference to localStorage
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));

    // Broadcast dark mode change to main process
    window.darkModeAPI.setDarkMode(isDarkMode);
  }, [isDarkMode]);

  // Listen for dark mode changes from other windows
  useEffect(() => {
    return window.darkModeAPI.onDarkModeChanged(setIsDarkMode);
  }, []);

  const toggleDarkMode = (): void => {
    setIsDarkMode(!isDarkMode);
  };

  return { isDarkMode, setDarkMode: setIsDarkMode, toggleDarkMode };
};
